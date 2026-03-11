import { Worker, Job } from 'bullmq';
import Redis from 'ioredis';
import { chromium } from 'playwright-extra';
const stealthPlugin = require('puppeteer-extra-plugin-stealth');
import { prisma } from '../server';
import { ActionType, WorkflowJson } from '@repo/types';
import { generateIcebreaker } from '../services/ai.service';
import { canWorkNow, applyJitter, getRandomUserAgent } from '../services/safety.service';
import { triggerWebhook } from '../services/webhook.service';

chromium.use(stealthPlugin());

let redisConnection: any;
try {
    redisConnection = new Redis(process.env.REDIS_URL || 'redis://localhost:6379', { maxRetriesPerRequest: null });
    redisConnection.on('error', (err: any) => console.log('Redis Worker Error:', err.message));
} catch (e) {
    console.error('Failed to init Redis:', e);
}

const randomDelay = (min = 2000, max = 5000) =>
    new Promise(resolve => setTimeout(resolve, Math.floor(Math.random() * (max - min + 1) + min)));

const injectVariables = (template: string, lead: any, icebreaker?: string | null) => {
    if (!template) return '';
    return template
        .replace(/{firstName}/g, lead?.firstName || '')
        .replace(/{lastName}/g, lead?.lastName || '')
        .replace(/{company}/g, lead?.company || '')
        .replace(/{jobTitle}/g, lead?.jobTitle || '')
        .replace(/{icebreaker}/g, icebreaker || '');
};

export const processWorkflowStep = async (data: any) => {
    const { campaignLeadId, userId, leadId, campaignId, currentStepId, workflowJson } = data;
    const workflow = workflowJson as WorkflowJson;

    console.log(`Executing step ${currentStepId} for lead ${leadId}`);

    // --- SAFETY ENGINE: WORKING HOURS CHECK ---
    const workStatus = await canWorkNow(userId);
    if (!workStatus.allowed) {
        console.log(`[SAFETY] Outside working hours for user ${userId}. Rescheduling to ${workStatus.nextStartTime?.toISOString()}`);
        await prisma.campaignLead.update({
            where: { id: campaignLeadId },
            data: { nextActionDate: workStatus.nextStartTime }
        });
        return;
    }

    // 1. Find the current node in the workflow
    const currentNode = workflow.nodes.find(n => n.id === currentStepId);
    if (!currentNode) return;

    try {
        // 2. Execute the action
        let lead: any = await prisma.lead.findUnique({ where: { id: leadId } });
        const campaignLead = await prisma.campaignLead.findUnique({ where: { id: campaignLeadId } });

        if (!lead || !campaignLead || campaignLead.isCompleted) return;

        // Waalaxy Strategy: Exit on Reply
        if (lead.status === 'REPLIED') {
            console.log(`[Worker] Lead ${leadId} has REPLIED. Stopping campaign for them.`);
            await prisma.campaignLead.update({
                where: { id: campaignLeadId },
                data: { isCompleted: true }
            });
            return;
        }

        // Waalaxy Strategy: Duplicate Shield
        // Avoid processing the same lead in multiple active campaigns at the same time.
        const otherActiveLead = await prisma.campaignLead.findFirst({
            where: {
                leadId,
                isCompleted: false,
                NOT: { id: campaignLeadId },
                campaign: { userId }
            }
        });

        if (otherActiveLead) {
            console.log(`[SHIELD] Lead ${leadId} is already active in another campaign. Postponing.`);
            const tomorrow = new Date();
            tomorrow.setHours(tomorrow.getHours() + 24);
            await prisma.campaignLead.update({
                where: { id: campaignLeadId },
                data: { nextActionDate: applyJitter(tomorrow, 60, 240) }
            });
            return;
        }

        const user = await prisma.user.findUnique({
            where: { id: userId },
            include: { proxy: true }
        });

        // --- WAALAXY STRATEGY: CONCURRENCY LOCK ---
        // Prevents multiple chromium instances for the same user account.
        const LOCK_TIMEOUT_MINUTES = 10;
        const isLockStale = user?.lastCloudActionAt
            ? (new Date().getTime() - new Date(user.lastCloudActionAt).getTime()) > (LOCK_TIMEOUT_MINUTES * 60 * 1000)
            : true;

        if (user?.cloudWorkerActive && !isLockStale) {
            console.log(`[CONCURRENCY] Worker already active for user ${userId}. Rescheduling task.`);
            const waitTime = applyJitter(new Date(Date.now() + 15 * 60 * 1000), 5, 10);
            await prisma.campaignLead.update({
                where: { id: campaignLeadId },
                data: { nextActionDate: waitTime }
            });
            return;
        }

        // Daily Rate Limiting for INVITE (Warmup Engine)
        if (currentNode.subType === 'INVITE') {
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            const inviteCount = await prisma.actionLog.count({
                where: {
                    userId,
                    actionType: 'INVITE',
                    status: 'SUCCESS',
                    executedAt: { gte: today }
                }
            });

            const currentLimit = user?.dailyInviteLimit || 10;
            const targetLimit = user?.maxInviteLimit || 80;

            if (inviteCount >= currentLimit) {
                console.log(`[RATE LIMIT] User ${userId} reached current limit of ${currentLimit}.`);

                // Waalaxy Strategy: Warmup Engine
                if (user?.warmupEnabled && currentLimit < targetLimit) {
                    const newLimit = currentLimit + 1;
                    console.log(`[WARMUP] Incrementing daily limit for user ${userId} to ${newLimit}.`);
                    await prisma.user.update({
                        where: { id: userId },
                        data: { dailyInviteLimit: newLimit }
                    });
                }

                const tomorrow = new Date();
                tomorrow.setDate(tomorrow.getDate() + 1);
                tomorrow.setHours(9, 0, 0, 0);
                const rescheduledDate = applyJitter(tomorrow, 10, 120);
                await prisma.campaignLead.update({
                    where: { id: campaignLeadId },
                    data: { nextActionDate: rescheduledDate }
                });
                return;
            }
        }

        const isConnectedKnown = lead?.status === 'CONNECTED' || lead?.status === 'REPLIED';

        if (
            currentNode.type === 'DELAY' ||
            (currentNode.type === 'CONDITION' && currentNode.subType === 'IF_REPLIED') ||
            (currentNode.type === 'CONDITION' && currentNode.subType === 'IF_CONNECTED' && isConnectedKnown)
        ) {
            // These nodes don't require a live headless browser, they just evaluate instantly.
            console.log(`[FLOW NODE] Processing ${currentNode.type} node instantly using local state.`);
        } else if (currentNode.subType === 'TAG_LEAD') {
            const tag = currentNode.data?.tag;
            if (tag) {
                const currentTags = lead?.tags || [];
                if (!currentTags.includes(tag)) {
                    await prisma.lead.update({
                        where: { id: leadId },
                        data: { tags: [...currentTags, tag] }
                    });
                }
                await prisma.actionLog.create({
                    data: { userId, leadId, campaignId, actionType: 'PROFILE_VISIT' as ActionType, status: 'SUCCESS' } // Hack until custom ActionType is added
                });
            }
        } else if (currentNode.subType === 'AI_PERSONALIZE') {
            console.log(`[AI] Generating personalization for ${lead?.firstName}`);
            const icebreaker = await generateIcebreaker(lead);
            await prisma.campaignLead.update({
                where: { id: campaignLeadId },
                data: { personalization: icebreaker }
            });
            await prisma.actionLog.create({
                data: { userId, leadId, campaignId, actionType: 'PROFILE_VISIT' as ActionType, status: 'SUCCESS' }
            });
        } else {
            const message = injectVariables(currentNode.data?.message || '', lead, campaignLead?.personalization);

            // MOCK MODE: If no cookies, we just log and succeed for testing
            if (!user?.linkedinCookie || process.env.MOCK_PLAYWRIGHT === 'true') {
                console.log(`[MOCK MODE] Executing ${currentNode.subType} for ${lead?.firstName} ${lead?.lastName}`);
                if (message) console.log(`[MOCK MODE] Message Content: "${message}"`);
                await randomDelay(500, 1000);
                await prisma.actionLog.create({
                    data: { userId, leadId, campaignId, actionType: currentNode.subType as ActionType, status: 'SUCCESS' }
                });

                // Mock lead status updates
                if (currentNode.subType === 'INVITE') {
                    await prisma.lead.update({ where: { id: leadId }, data: { status: 'INVITE_PENDING' } });
                } else if (currentNode.subType === 'MESSAGE' && lead?.status === 'UNCONNECTED') {
                    await prisma.lead.update({ where: { id: leadId }, data: { status: 'CONNECTED' } });
                }

            } else {
                if (!lead?.linkedinUrl) throw new Error('Missing lead data');

                // Signal to Extension: Cloud Worker is starting for this user
                await prisma.user.update({
                    where: { id: userId },
                    data: { cloudWorkerActive: true, lastCloudActionAt: new Date() }
                });

                let browser;
                try {
                    const launchOptions: any = {
                        headless: true,
                        args: ['--no-sandbox', '--disable-setuid-sandbox']
                    };

                    // @ts-ignore Let's ignore this until TS catches up with Prisma output
                    if (user.proxy) {
                        launchOptions.proxy = {
                            server: `http://${(user as any).proxy.proxyHost}:${(user as any).proxy.proxyPort}`,
                            username: (user as any).proxy.proxyUsername || undefined,
                            password: (user as any).proxy.proxyPassword || undefined
                        };
                    }

                    browser = await chromium.launch(launchOptions);
                    const context = await browser.newContext({
                        userAgent: getRandomUserAgent()
                    });

                    // 1. Proxy Bandwidth & Server RAM Optimizer
                    await context.route('**/*', (route) => {
                        const type = route.request().resourceType();
                        if (['image', 'media', 'font', 'stylesheet'].includes(type) || route.request().url().includes('google-analytics')) {
                            route.abort();
                        } else {
                            route.continue();
                        }
                    });

                    let cookies;
                    try {
                        cookies = JSON.parse(user.linkedinCookie as string);
                    } catch (e) {
                        // Fallback for old single-string cookie format
                        cookies = [{
                            name: 'li_at',
                            value: user.linkedinCookie,
                            domain: '.linkedin.com',
                            path: '/',
                            secure: true,
                            httpOnly: true,
                            sameSite: 'None'
                        }];
                    }

                    // Playwright expects an array of cookie objects
                    await context.addCookies(Array.isArray(cookies) ? cookies : [cookies]);

                    const page = await context.newPage();
                    await page.goto(lead.linkedinUrl);

                    const getRobustButton = async (page: any, selectors: string[]) => {
                        for (const selector of selectors) {
                            const locator = page.locator(selector).first();
                            if (await locator.isVisible()) {
                                console.log(`[Worker] Found button using selector: ${selector}`);
                                return locator;
                            }
                        }
                        return null;
                    };

                    const MESSAGE_SELECTORS = [
                        '[data-view-name="profile-primary-message"]',
                        'button:has(svg[data-test-icon="send-privately-small"])',
                        'a[href*="/messaging/thread/"]',
                        'button:has-text("Message")',
                        'button[aria-label^="Message"]'
                    ];

                    const CONNECT_SELECTORS = [
                        'button:has(svg[data-test-icon="connect-small"])',
                        'button:has(svg[data-test-icon="connect-medium"])',
                        'button:has(svg[data-test-icon="connect"])',
                        'button:has-text("Connect")',
                        'button[aria-label^="Invite"]',
                        'button[aria-label^="Connect"]'
                    ];

                    const MORE_BTN_SELECTORS = [
                        'button:has(svg[data-test-icon="more-v2-small"])',
                        'button[aria-label="More actions"]',
                        'button:has-text("More")'
                    ];

                    const PENDING_SELECTORS = [
                        'button:has(svg[data-test-icon="clock-small"])',
                        'button:has(svg[data-test-icon="clock-medium"])',
                        'button:has-text("Pending")',
                        'button:has-text("Withdraw")'
                    ];

                    if (currentNode.subType === 'INVITE') {
                        // 1. Check if already invited or connected
                        const isConnected = await getRobustButton(page, MESSAGE_SELECTORS);
                        if (isConnected) {
                            console.log('[Worker] Already connected with lead ', leadId);
                        } else {
                            // 2. Click Connect
                            let connectBtn = await getRobustButton(page, CONNECT_SELECTORS);

                            if (!connectBtn) {
                                console.log('[Worker] Connect button not directly visible. Checking More menu...');
                                const moreBtn = await getRobustButton(page, MORE_BTN_SELECTORS);
                                if (moreBtn) {
                                    await moreBtn.click();
                                    await randomDelay(1000, 2000);
                                    connectBtn = await getRobustButton(page, CONNECT_SELECTORS);
                                }
                            }

                            if (connectBtn) {
                                await connectBtn.click();
                                await randomDelay();
                                // Waalaxy Strategy: Note Restriction Fallback
                                // If restricted, we skip the note entirely to ensure the invite goes through.
                                if (message && !user?.isNoteRestricted) {
                                    const addNoteBtn = page.locator('button:has-text("Add a note"), button[aria-label="Add a note"]').first();
                                    if (await addNoteBtn.isVisible()) {
                                        await addNoteBtn.click();
                                        await randomDelay(500, 1500);
                                        await page.type('textarea[name="message"]', message, { delay: Math.floor(Math.random() * 50) + 30 });
                                    }
                                }

                                await page.mouse.wheel(0, Math.floor(Math.random() * 500) + 300);
                                await randomDelay(1000, 2500);

                                const sendBtn = page.locator('button:has-text("Send"), button[aria-label="Send now"]').first();
                                if (await sendBtn.isVisible()) {
                                    await sendBtn.click();
                                } else {
                                    await page.keyboard.press('Enter');
                                }

                                // 4. LinkedIn Ban, Limit & Note Restriction Detection
                                await randomDelay(1500, 3000);
                                const modals = await page.$$('.artdeco-modal');
                                for (const modal of modals) {
                                    const text = await modal.innerText();
                                    const lower = text.toLowerCase();

                                    // Detect Personalized Invite Limit (Waalaxy Note Fallback)
                                    if (lower.includes('personalized') && lower.includes('limit')) {
                                        console.log(`[RESTRICTION] User ${userId} detected as Note Restricted. Enabling fallback.`);
                                        await prisma.user.update({
                                            where: { id: userId },
                                            data: { isNoteRestricted: true }
                                        });
                                        throw new Error(`LINKEDIN_NOTE_RESTRICTED|${text.substring(0, 100)}`);
                                    }

                                    if (lower.includes('limit') || lower.includes('restricted') || lower.includes('email') || lower.includes('captcha') || lower.includes('security')) {
                                        throw new Error(`LINKEDIN_LIMIT_REACHED|${text.substring(0, 100)}`);
                                    }
                                }

                                await prisma.actionLog.create({
                                    data: { userId, leadId, campaignId, actionType: 'INVITE', status: 'SUCCESS' }
                                });
                                await prisma.lead.update({ where: { id: leadId }, data: { status: 'INVITE_PENDING' } });
                            } else {
                                throw new Error('Connect button not visible even after checking More menu.');
                            }
                        }
                    } else if (currentNode.subType === 'MESSAGE') {
                        console.log(`[Worker] Attempting to send message to lead ${leadId}`);

                        // Ensure page is ready
                        await page.waitForLoadState('networkidle');
                        await page.mouse.wheel(0, 300); // Trigger lazy loads
                        await randomDelay(1000, 2000);

                        // 1. Try to find Message button using Waalaxy selectors
                        let messageBtn = await getRobustButton(page, MESSAGE_SELECTORS);

                        if (!messageBtn) {
                            console.log(`[Worker] Message button not immediately visible. Checking 'More' menu...`);
                            const moreBtn = await getRobustButton(page, MORE_BTN_SELECTORS);
                            if (moreBtn) {
                                await moreBtn.click();
                                await randomDelay(1000, 2000);
                                messageBtn = await getRobustButton(page, MESSAGE_SELECTORS);
                            }
                        }

                        if (messageBtn) {
                            await messageBtn.click();
                            await randomDelay(1500, 2500);

                            // Waalaxy-style: Support Subject field (InMail/Message Requests)
                            const subjectBox = page.locator('input[name="subject"], .msg-form__subject-typeahead input').first();
                            if (await subjectBox.isVisible()) {
                                console.log('[Worker] InMail/Request modal detected. Adding subject...');
                                await subjectBox.fill('Hello!'); // Default subject if none provided
                                await subjectBox.dispatchEvent('input', { bubbles: true });
                            }

                            const textBox = page.locator('form[class*=msg-form] [contenteditable=true], div[role="textbox"]').first();
                            if (await textBox.isVisible()) {
                                await textBox.click(); // Focus
                                await textBox.fill(''); // Clear

                                // Type message with human-like delay
                                await textBox.pressSequentially(message, { delay: Math.floor(Math.random() * 50) + 30 });

                                // Waalaxy Strategy: Dispatch events to wake up React state
                                await textBox.dispatchEvent('input', { bubbles: true });
                                await textBox.dispatchEvent('change', { bubbles: true });
                                await textBox.evaluate((el: HTMLElement) => {
                                    el.dispatchEvent(new Event('input', { bubbles: true }));
                                    el.dispatchEvent(new Event('blur', { bubbles: true }));
                                });

                                await randomDelay(1000, 2000);

                                // Check if "Enter to send" is hints are visible
                                const hasEnterHint = await page.isVisible('form[class*=msg-form] .msg-form__send-button:disabled');
                                const sendBtn = page.locator('button.msg-form__send-button, button[type="submit"]').first();

                                if (await sendBtn.isVisible() && !(await sendBtn.isDisabled())) {
                                    await sendBtn.click();
                                } else {
                                    console.log('[Worker] Send button disabled or not found. Pressing Enter...');
                                    await page.keyboard.press('Enter');
                                }

                                // Waalaxy Strategy: Verification
                                await randomDelay(2000, 3000);
                                const currentContent = await textBox.innerText();
                                if (currentContent.trim().length > 0) {
                                    // If message is still in the box, it often means a "Duplicate Message" 
                                    // or "Rate Limit" warning appeared and blocked the send.
                                    const errorVisible = await page.isVisible('.artdeco-inline-feedback--error, .msg-form__error-feedback');
                                    if (errorVisible) {
                                        const errorText = await page.locator('.artdeco-inline-feedback--error, .msg-form__error-feedback').first().innerText();
                                        throw new Error(`MESSAGE_SEND_BLOCKED|${errorText}`);
                                    }
                                    throw new Error('MESSAGE_NOT_CLEARED|Message remained in box after send attempt. Possible block.');
                                }

                                console.log(`[Worker] Message successfully sent and verified for lead ${leadId}`);
                            } else {
                                throw new Error('Message textbox not found after clicking Message button');
                            }
                        } else {
                            // 2. CHECK FOR PENDING (Waiting for acceptance)
                            const pendingBtn = await getRobustButton(page, PENDING_SELECTORS);
                            if (await pendingBtn.isVisible()) {
                                console.log(`[Worker] Lead ${leadId} invitation is still PENDING. Rescheduling message for 24 hours.`);
                                const tomorrow = new Date();
                                tomorrow.setHours(tomorrow.getHours() + 24);
                                await prisma.campaignLead.update({
                                    where: { id: campaignLeadId },
                                    data: { nextActionDate: applyJitter(tomorrow, 60, 240) }
                                });
                                return;
                            }

                            // 3. FALLBACK: Check if we are even connected
                            console.log(`[Worker] Still no Message/Pending button for ${leadId}. Checking for 'Connect' button...`);
                            let connectBtn = page.locator('button:has-text("Connect"), button[aria-label^="Invite"]').first();

                            if (await connectBtn.isVisible()) {
                                console.log(`[Worker] Not connected to ${leadId}. Redirecting to INVITE flow logic.`);
                                await connectBtn.click();
                                await randomDelay(1000, 2000);
                                if (message) {
                                    const addNoteBtn = page.locator('button:has-text("Add a note"), button[aria-label="Add a note"]').first();
                                    if (await addNoteBtn.isVisible()) {
                                        await addNoteBtn.click();
                                        await page.type('textarea[name="message"]', message, { delay: 50 });
                                    }
                                }
                                const sendBtn = page.locator('button:has-text("Send"), button[aria-label="Send now"]').first();
                                if (await sendBtn.isVisible()) {
                                    await sendBtn.click();
                                } else {
                                    await page.keyboard.press('Enter');
                                }

                                await prisma.actionLog.create({
                                    data: { userId, leadId, campaignId, actionType: 'INVITE' as ActionType, status: 'SUCCESS', errorMessage: 'Auto-fallback to Invite because not connected.' }
                                });
                                await prisma.lead.update({ where: { id: leadId }, data: { status: 'INVITE_PENDING' } });
                                console.log(`[Worker] Sent fallback Connection Request to ${leadId}`);

                                // Reschedule the current MESSAGE step for 24h later to check if connection was accepted
                                const tomorrow = new Date();
                                tomorrow.setHours(tomorrow.getHours() + 24);
                                await prisma.campaignLead.update({
                                    where: { id: campaignLeadId },
                                    data: { nextActionDate: applyJitter(tomorrow, 60, 240) }
                                });
                                return;
                            } else {
                                // Last resort: list button texts to logs
                                const buttons = await page.$$eval('button', (btns: any) => btns.map((b: any) => b.innerText || b.getAttribute('aria-label')).filter(Boolean));
                                console.log('[Worker] Failed to find action buttons. Found buttons:', buttons.slice(0, 10));
                                throw new Error('Message button and Connect button not visible. Profile might be restricted or layout changed.');
                            }
                        }

                        await randomDelay(2000, 4000);
                        const modals = await page.$$('.artdeco-modal');
                        for (const modal of modals) {
                            const text = await modal.innerText();
                            const lower = text.toLowerCase();
                            if (lower.includes('limit') || lower.includes('restricted') || lower.includes('security')) {
                                throw new Error(`LINKEDIN_LIMIT_REACHED|${text.substring(0, 100)}`);
                            }
                        }

                        await prisma.actionLog.create({
                            data: { userId, leadId, campaignId, actionType: 'MESSAGE', status: 'SUCCESS' }
                        });
                        console.log(`[Worker] Successfully logged MESSAGE for lead ${leadId}`);
                    } else if (currentNode.type === 'CONDITION' && currentNode.subType === 'IF_CONNECTED') {
                        // Live check of connection status if unknown
                        if (lead?.status === 'INVITE_PENDING' || lead?.status === 'UNCONNECTED') {
                            const isConnected = await page.isVisible('button:has-text("Message")');
                            if (isConnected) {
                                console.log('[CONDITION] Live verification: User IS connected! Updating DB.');
                                await prisma.lead.update({ where: { id: leadId }, data: { status: 'CONNECTED' } });
                                // lead object ref update for the next block
                                lead = { ...lead, status: 'CONNECTED' };
                            } else {
                                console.log('[CONDITION] Live verification: User is NOT connected.');
                            }
                        }
                    }

                } finally {
                    if (browser) await browser.close();

                    // Signal to Extension: Cloud Worker has finished
                    await prisma.user.update({
                        where: { id: userId },
                        data: { cloudWorkerActive: false, lastCloudActionAt: new Date() }
                    });
                }
            }
        }

        // 3. Find next step
        let nextEdge = workflow.edges.find(e => e.source === currentStepId);

        if (currentNode.type === 'CONDITION') {
            // A REPLIED user is inherently connected.
            const isConnected = lead?.status === 'CONNECTED' || lead?.status === 'REPLIED';
            const isReplied = lead?.status === 'REPLIED';
            let conditionMet = false;

            if (currentNode.subType === 'IF_CONNECTED') conditionMet = isConnected;
            if (currentNode.subType === 'IF_REPLIED') conditionMet = isReplied;

            const conditionEdges = workflow.edges.filter(e => e.source === currentStepId);
            if (conditionEdges.length > 0) {
                // Find matching branch (handle usually target yes/no or true/false)
                const sourceHandle = conditionMet ? 'yes' : 'no';
                const matchEdge = conditionEdges.find(e => e.sourceHandle === sourceHandle || e.sourceHandle === String(conditionMet));
                nextEdge = matchEdge || conditionEdges[0];
            } else {
                nextEdge = undefined;
            }
        }

        if (nextEdge) {
            const nextNode = workflow.nodes.find(n => n.id === nextEdge!.target);
            let nextActionDate = new Date();

            // Handle DELAY node specifically
            if (nextNode?.type === 'DELAY') {
                let waitHours = 24; // Default wait
                if (nextNode.data?.hours) {
                    waitHours = parseFloat(nextNode.data.hours);
                } else if (nextNode.data?.days) {
                    waitHours = parseFloat(nextNode.data.days) * 24;
                }

                nextActionDate = new Date(Date.now() + (waitHours * 60 * 60 * 1000));
                nextActionDate = applyJitter(nextActionDate, 30, 240); // Add 30-240 minutes of jitter
                console.log(`Setting delay for ${waitHours}h until ${nextActionDate.toISOString()}`);
            }

            await prisma.campaignLead.update({
                where: { id: campaignLeadId },
                data: {
                    currentStepId: nextEdge.target,
                    nextActionDate,
                }
            });
        } else {
            await prisma.campaignLead.update({
                where: { id: campaignLeadId },
                data: { isCompleted: true }
            });

            if (lead) {
                // Trigger integration webhook
                await triggerWebhook(userId, 'campaign.completed', {
                    leadId: lead.id,
                    campaignId,
                    firstName: lead.firstName,
                    lastName: lead.lastName,
                    email: lead.email,
                    linkedinUrl: lead.linkedinUrl
                });
            }

            // Check Campaign Completion completion
            if (campaignId) {
                const pendingLeads = await prisma.campaignLead.count({
                    where: { campaignId, isCompleted: false }
                });

                if (pendingLeads === 0) {
                    const campaign = await prisma.campaign.update({
                        where: { id: campaignId },
                        data: { status: 'COMPLETED' }
                    });
                    await prisma.notification.create({
                        data: {
                            userId,
                            title: 'Campaign Completed',
                            body: `All leads have completed the campaign: ${campaign.name}`,
                            type: 'campaign_complete',
                            read: false
                        }
                    });
                }
            }
        }

    } catch (error: any) {
        console.error(`Worker error at step ${currentStepId}:`, error.message);

        const errorMessage = error.message.toLowerCase();

        // 1. Campaign-Level Hard Stops (Limits & Restrictions)
        if (errorMessage.includes('linkedin_limit_reached') || errorMessage.includes('limit') || errorMessage.includes('restricted') || errorMessage.includes('security')) {
            const reasonData = error.message.split('|')[1] || 'You have reached a LinkedIn limit or restriction.';

            await prisma.actionLog.create({
                data: {
                    userId: data.userId,
                    leadId: data.leadId,
                    campaignId: data.campaignId,
                    actionType: 'INVITE', // fallback if generic
                    status: 'FAILED',
                    errorMessage: 'LinkedIn Action Blocked or Limited: ' + reasonData
                }
            });

            // Pause the entire campaign to prevent further damage
            await prisma.campaign.update({
                where: { id: data.campaignId },
                data: { status: 'PAUSED' }
            });

            // Send critical notification to Frontend
            await prisma.notification.create({
                data: {
                    userId: data.userId,
                    type: 'campaign_error',
                    title: 'Campaign Paused: LinkedIn Limit Reached',
                    body: `LinkedIn actively blocked an action. Your campaign has been automatically paused to protect your account. Reason: ${reasonData}`,
                    meta: { campaignId: data.campaignId, leadId: data.leadId } as any
                }
            });
            throw error; // Let BullMQ retry/fail naturally
        }

        // 2. Auth Errors
        if (errorMessage.includes('auth') || errorMessage.includes('cookie') || errorMessage.includes('login')) {
            await prisma.campaign.update({
                where: { id: data.campaignId },
                data: { status: 'PAUSED' }
            });

            await prisma.notification.create({
                data: {
                    userId: data.userId,
                    type: 'campaign_error',
                    title: 'Campaign Paused: Authentication Error',
                    body: `We could not authenticate your LinkedIn session. Please update your cookie. Campaign paused.`,
                    meta: { campaignId: data.campaignId } as any
                }
            });
            throw error;
        }

        // 3. Lead-Specific Soft Bounces vs UI Failures (Postpone Strategy)
        const isProfileFatal = errorMessage.includes('restricted') || errorMessage.includes('deleted') || errorMessage.includes('not found');
        const isUIError = errorMessage.includes('not visible') || errorMessage.includes('missing') || errorMessage.includes('failed to find') || errorMessage.includes('target closed') || errorMessage.includes('timeout');

        if (isUIError && !isProfileFatal) {
            // Waalaxy Strategy: POSTPONED
            // Don't fail the lead yet. LinkedIn might be having a bad day or layout changed slightly.
            // Try again in 4 hours.
            console.log(`[POSTPONE] Lead ${data.leadId} encountered a UI issue. Retrying in 4 hours.`);

            const retryDate = new Date();
            retryDate.setHours(retryDate.getHours() + 4);
            const postponedDate = applyJitter(retryDate, 15, 60);

            await prisma.campaignLead.update({
                where: { id: data.campaignLeadId },
                data: { nextActionDate: postponedDate }
            });

            await prisma.actionLog.create({
                data: {
                    userId: data.userId,
                    leadId: data.leadId,
                    campaignId: data.campaignId,
                    actionType: 'PROFILE_VISIT',
                    status: 'FAILED',
                    errorMessage: 'Postponed due to UI error: ' + error.message.substring(0, 100)
                }
            });
            return;
        }

        if (isProfileFatal) {
            console.log(`[BOUNCE] Lead ${data.leadId} failed fatably. Ejecting from campaign.`);

            await prisma.actionLog.create({
                data: {
                    userId: data.userId,
                    leadId: data.leadId,
                    campaignId: data.campaignId,
                    actionType: 'PROFILE_VISIT',
                    status: 'FAILED',
                    errorMessage: 'Fatal bounce: ' + error.message.substring(0, 100)
                }
            });

            await prisma.campaignLead.update({
                where: { id: data.campaignLeadId },
                data: { isCompleted: true }
            });

            await prisma.lead.update({
                where: { id: data.leadId },
                data: { status: 'BOUNCED' }
            });

            return;
        }

        throw error;
    }
};

export const initWorker = () => {
    if (!redisConnection) {
        console.warn('Worker skipped initialization due to no Redis connection.');
        return;
    }
    const worker = new Worker('linkedin-actions', async (job: Job) => {
        await processWorkflowStep(job.data);
    }, { connection: redisConnection as any });

    worker.on('completed', (job) => console.log(`Job ${job.id} completed`));
    worker.on('failed', (job, err) => console.error(`Job ${job?.id} failed:`, err.message));
};
