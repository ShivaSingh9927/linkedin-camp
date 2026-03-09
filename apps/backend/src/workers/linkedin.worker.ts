import { Worker, Job } from 'bullmq';
import { prisma } from '../server';
import { ActionType } from '@repo/types';
import { chromium } from 'playwright-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';

const stealth = StealthPlugin();
chromium.use(stealth);

async function randomDelay(min = 2000, max = 5000) {
    const delay = Math.floor(Math.random() * (max - min + 1)) + min;
    return new Promise((resolve) => setTimeout(resolve, delay));
}

function applyJitter(date: Date, minMinutes: number, maxMinutes: number) {
    const jitter = Math.floor(Math.random() * (maxMinutes - minMinutes + 1)) + minMinutes;
    return new Date(date.getTime() + jitter * 60000);
}

export const linkedinWorker = new Worker(
    'linkedin-actions',
    async (job: Job) => {
        const { campaignLeadId, userId } = job.data;

        const campaignLead = await prisma.campaignLead.findUnique({
            where: { id: campaignLeadId },
            include: {
                lead: true,
                campaign: true,
            },
        });

        if (!campaignLead || campaignLead.isCompleted || campaignLead.campaign.status !== 'ACTIVE') {
            return;
        }

        const { lead, campaign, currentStepId } = campaignLead;
        const workflow = campaign.workflowJson as any;
        const currentNode = workflow.nodes.find((n: any) => n.id === currentStepId);

        if (!currentNode) {
            await prisma.campaignLead.update({
                where: { id: campaignLeadId },
                data: { isCompleted: true },
            });
            return;
        }

        console.log(`[Worker] Executing step ${currentStepId} for lead ${lead.id}`);

        const user = await prisma.user.findUnique({ where: { id: userId } });
        if (!user || (!user.liCookie && !process.env.MOCK_PLAYWRIGHT)) {
            throw new Error('LinkedIn cookie not found for user');
        }

        if (process.env.MOCK_PLAYWRIGHT === 'true') {
            console.log(`[MOCK] Executing ${currentNode.type} for lead ${lead.firstName}`);
            await randomDelay(1000, 2000);
            
            // Move to next step
            const edge = workflow.edges.find((e: any) => e.source === currentStepId);
            if (edge) {
                await prisma.campaignLead.update({
                    where: { id: campaignLeadId },
                    data: {
                        currentStepId: edge.target,
                        nextActionDate: applyJitter(new Date(), 30, 120),
                    },
                });
            } else {
                await prisma.campaignLead.update({
                    where: { id: campaignLeadId },
                    data: { isCompleted: true },
                });
            }
            return;
        }

        const browser = await chromium.launch({ 
            headless: true,
            args: ['--no-sandbox', '--disable-setuid-sandbox']
        });
        
        const context = await browser.newContext({
            userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        });

        try {
            // Restore cookie
            const cookieObj = JSON.parse(user.liCookie!);
            await context.addCookies(Array.isArray(cookieObj) ? cookieObj : [cookieObj]);

            const page = await context.newPage();
            
            // Navigate to lead profile
            await page.goto(lead.linkedinUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });
            await randomDelay(3000, 6000);

            // Close potential "Welcome" or "Settings" modals
            try {
                const closeBtn = page.locator('button[aria-label="Dismiss"], button[aria-label="Close"]').first();
                if (await closeBtn.isVisible()) await closeBtn.click();
            } catch (e) {}

            const actionResult = await processWorkflowStep(page, currentNode, lead, campaignId, userId, campaignLeadId);

            if (actionResult === 'SUCCESS' || actionResult === 'SKIPPED') {
                const edge = workflow.edges.find((e: any) => e.source === currentStepId);
                if (edge) {
                    const nextNode = workflow.nodes.find((n: any) => n.id === edge.target);
                    let delayMinutes = 60; // Default 1 hour

                    if (nextNode && nextNode.data?.delay) {
                        delayMinutes = parseInt(nextNode.data.delay) * 60;
                    }

                    await prisma.campaignLead.update({
                        where: { id: campaignLeadId },
                        data: {
                            currentStepId: edge.target,
                            nextActionDate: applyJitter(new Date(), delayMinutes, delayMinutes + 30),
                        },
                    });
                } else {
                    await prisma.campaignLead.update({
                        where: { id: campaignLeadId },
                        data: { isCompleted: true },
                    });
                }
            }
        } catch (error: any) {
            console.error(`[Worker] Error for job ${job.id}:`, error.message);
            
            await prisma.actionLog.create({
                data: {
                    userId,
                    leadId: lead.id,
                    campaignId,
                    actionType: currentNode.subType as ActionType || 'UNKNOWN' as ActionType,
                    status: 'FAILED',
                    errorMessage: error.message,
                }
            });

            throw error;
        } finally {
            await browser.close();
        }
    },
    {
        connection: {
            url: process.env.REDIS_URL,
        },
        concurrency: 2,
    }
);

async function processWorkflowStep(page: any, currentNode: any, lead: any, campaignId: string, userId: string, campaignLeadId: string) {
    const leadId = lead.id;
    const message = currentNode.data?.message || '';

    switch (currentNode.type) {
        case 'ACTION':
            if (currentNode.subType === 'VISIT') {
                console.log(`[Worker] Visiting lead ${leadId}`);
                await page.mouse.wheel(0, 500);
                await randomDelay(2000, 4000);
                await prisma.actionLog.create({
                    data: { userId, leadId, campaignId, actionType: 'VISIT', status: 'SUCCESS' }
                });
                return 'SUCCESS';
            } 
            
            if (currentNode.subType === 'INVITE') {
                // 1. Check if already invited or connected
                const isConnected = await page.isVisible('button:has-text("Message"), button[aria-label^="Message"]');
                if (isConnected) {
                    console.log('[Worker] Already connected with lead ', leadId);
                    return 'SKIPPED';
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
                        return 'SUCCESS';
                    } else {
                        throw new Error('Connect button not visible even after checking More menu.');
                    }
                }
            } 
            
            if (currentNode.subType === 'MESSAGE') {
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
                        
                        await prisma.actionLog.create({
                            data: { userId, leadId, campaignId, actionType: 'MESSAGE', status: 'SUCCESS' }
                        });
                        return 'SUCCESS';
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
                        return 'RESCHEDULED';
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
                        return 'RESCHEDULED';
                    } else {
                        // Last resort: list button texts to logs
                        const buttons = await page.$$eval('button', (btns: any) => btns.map((b: any) => b.innerText || b.getAttribute('aria-label')).filter(Boolean));
                        console.log('[Worker] Failed to find action buttons. Found buttons:', buttons.slice(0, 10));
                        throw new Error('Message button and Connect button not visible. Profile might be restricted or layout changed.');
                    }
                }
            }
            break;

        case 'CONDITION':
            // Logic for checking conditions like "Is connected", "Replied", etc.
            // Placeholder for now
            return 'SUCCESS';
    }

    return 'SUCCESS';
}
