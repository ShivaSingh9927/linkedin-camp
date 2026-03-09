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
        const user = await prisma.user.findUnique({
            where: { id: userId },
            include: { proxy: true }
        });
        let lead: any = await prisma.lead.findUnique({ where: { id: leadId } });
        const campaignLead = await prisma.campaignLead.findUnique({ where: { id: campaignLeadId } });

        // Daily Rate Limiting for INVITE
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
            const limit = user?.dailyInviteLimit || 30;
            if (inviteCount >= limit) {
                console.log(`[RATE LIMIT] User ${userId} reached daily invite limit of ${limit}. Rescheduling.`);
                const tomorrow = new Date();
                tomorrow.setDate(tomorrow.getDate() + 1);
                tomorrow.setHours(9, 0, 0, 0);
                const rescheduledDate = applyJitter(tomorrow, 10, 120); // Add jitter to start of next day
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

                    if (currentNode.subType === 'INVITE') {
                        // 1. Check if already invited or connected
                        const isConnected = await page.isVisible('button:has-text("Message"), button[aria-label^="Message"]');
                        if (isConnected) {
                            console.log('[Worker] Already connected with lead ', leadId);
                        } else {
                            // 2. Click Connect
                            let connectBtn = page.locator('button:has-text("Connect"), button[aria-label^="Invite"]').first();

                            if (!(await connectBtn.isVisible())) {
                                console.log('[Worker] Connect button not directly visible. Checking More menu...');
                                const moreBtn = page.locator('button:has-text("More"), button[aria-label="More actions"]').first();
                                if (await moreBtn.isVisible()) {
                                    await moreBtn.click();
                                    await randomDelay(1000, 2000);
                                    connectBtn = page.locator('button:has-text("Connect"), button[aria-label^="Invite"]').last();
                                }
                            }

                            if (await connectBtn.isVisible()) {
                                await connectBtn.click();
                                await randomDelay();
                                // Handle "Add a note"
                                if (message) {
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

                                // 4. LinkedIn Ban, Limit & CAPTCHA Detection
                                await randomDelay(1500, 3000);
                                const modals = await page.$$('.artdeco-modal');
                                for (const modal of modals) {
                                    const text = await modal.innerText();
                                    const lower = text.toLowerCase();
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

                        // 1. Try to find Message button directly, or check "More" dropdown
                        let messageBtn = page.locator('button:has-text("Message"), button[aria-label^="Message"]').first();

                        if (!(await messageBtn.isVisible())) {
                            console.log(`[Worker] Message button not immediately visible. Checking 'More' menu...`);
                            const moreBtn = page.locator('button:has-text("More"), button[aria-label="More actions"]').first();
                            if (await moreBtn.isVisible()) {
                                await moreBtn.click();
                                await randomDelay(1000, 2000);
                                // Re-locate after menu opens
                                messageBtn = page.locator('button:has-text("Message"), button[aria-label^="Message"]').last();
                            }
                        }

                        if (await messageBtn.isVisible()) {
                            await messageBtn.click();
                            await randomDelay(1000, 2000);

                            const textBox = page.locator('div[role="textbox"]').first();
                            if (await textBox.isVisible()) {
                                await textBox.click(); // Focus
                                await textBox.fill(''); // Clear
                                await textBox.pressSequentially(message, { delay: Math.floor(Math.random() * 50) + 30 });
                                await randomDelay(1000, 2000);

                                const sendBtn = page.locator('button.msg-form__send-button').first();
                                if (await sendBtn.isVisible() && !(await sendBtn.isDisabled())) {
                                    await sendBtn.click();
                                } else {
                                    await page.keyboard.press('Enter');
                                }

                                console.log(`[Worker] Message typed and send command executed for lead ${leadId}`);
                            } else {
                                throw new Error('Message textbox not found after clicking Message button');
                            }
                        } else {
                            // 2. CHECK FOR PENDING (Waiting for acceptance)
                            const pendingBtn = page.locator('button:has-text("Pending"), button:has-text("Withdraw")').first();
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

        // 3. Lead-Specific Soft Bounces (e.g. invalid URL, missing connect button, deleted profile)
        if (errorMessage.includes('not visible') || errorMessage.includes('missing') || errorMessage.includes('failed to find') || errorMessage.includes('target closed')) {
            console.log(`[BOUNCE] Lead ${data.leadId} failed. Ejecting from campaign.`);

            await prisma.actionLog.create({
                data: {
                    userId: data.userId,
                    leadId: data.leadId,
                    campaignId: data.campaignId,
                    actionType: 'PROFILE_VISIT', // fallback
                    status: 'FAILED',
                    errorMessage: 'Individual bounce: ' + error.message.substring(0, 100)
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

            // Mark as 'completed' in BullMQ sense so it doesn't retry infinitely for a broken profile.
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
