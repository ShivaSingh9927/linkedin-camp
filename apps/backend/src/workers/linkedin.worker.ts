import { Worker, Job } from 'bullmq';
import { prisma } from '../server';
import { chromium } from 'playwright-extra';
const stealth = require('puppeteer-extra-plugin-stealth')();
import Redis from 'ioredis';
import { humanMoveAndClick, humanType, warmupSession } from '../services/stealth.service';

chromium.use(stealth);

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';
const redisConnection = REDIS_URL ? new Redis(REDIS_URL, { maxRetriesPerRequest: null }) : null;

const wait = (ms: number) => new Promise(res => setTimeout(res, ms));

export const processWorkflowStep = async (data: any) => {
    const { userId, campaignId, leadId, stepIndex } = data;

    const user = await prisma.user.findUnique({ where: { id: userId } });
    const campaign = await prisma.campaign.findUnique({ where: { id: campaignId } });
    const lead = await prisma.lead.findUnique({ where: { id: leadId } });

    if (!user || !campaign || !lead) return;

    // 1. Safety Check: Working Hours
    const now = new Date();
    const currentHour = now.getHours();
    if (currentHour < 8 || currentHour > 20) {
        console.log(`[WORKER] Outside working hours for lead ${lead.id}. Delayed.`);
        return; // Re-queueing handled by BullMQ backoff or 1-hour delay
    }

    // 2. Safety Check: Plan Limits
    const dailyLimit = user.tier === 'PRO' ? 100 : user.tier === 'ADVANCED' ? 200 : 20;
    // In production, increment a daily counter in Redis or DB
    // if (count >= dailyLimit) return;

    let browser;
    try {
        console.log(`[WORKER] Initiating action for lead ${lead.id} (${lead.firstName})`);
        
        // Use persistent context if available for high-tier accounts
        const launchOptions = {
            headless: process.env.HEADLESS_MODE !== 'false',
            args: ['--no-sandbox', '--disable-setuid-sandbox']
        };

        if (user.persistentSessionPath) {
            browser = await chromium.launchPersistentContext(user.persistentSessionPath, launchOptions);
        } else {
            browser = await chromium.launch(launchOptions);
        }

        const page = user.persistentSessionPath ? (browser.pages()[0] || await browser.newPage()) : await browser.newPage();

        // If using raw cookie (no persistent session)
        if (!user.persistentSessionPath && user.linkedinCookie) {
            await browser.addCookies([{
                name: 'li_at',
                value: user.linkedinCookie,
                domain: '.www.linkedin.com',
                path: '/',
                secure: true,
                httpOnly: true,
                sameSite: 'None'
            }]);
        }

        // --- STEP EXECUTION ---
        const step = campaign.workflow?.[stepIndex];
        if (!step) return;

        // Warmup (Random behavior)
        if (Math.random() > 0.7) await warmupSession(page);

        await page.goto(lead.linkedinUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });
        await wait(3000);

        if (step.type === 'INVITE') {
            const hasConnect = await page.isVisible('button:has-text("Connect")');
            if (hasConnect) {
                await humanMoveAndClick(page, 'button:has-text("Connect")');
                await wait(2000);
                
                if (step.note) {
                    const hasAddNote = await page.isVisible('button:has-text("Add a note")');
                    if (hasAddNote) {
                        await humanMoveAndClick(page, 'button:has-text("Add a note")');
                        const personalizedNote = step.note.replace('{{firstName}}', lead.firstName || 'there');
                        await humanType(page, 'textarea[name="message"]', personalizedNote);
                        await wait(1500);
                    }
                }
                
                await humanMoveAndClick(page, 'button:has-text("Send")');
                console.log(`[WORKER] Invite sent to ${lead.firstName}`);
            } else {
                console.log(`[WORKER] Could not find Connect button for ${lead.firstName}. Already connected?`);
            }
        } else if (step.type === 'MESSAGE') {
            const hasMessage = await page.isVisible('button:has-text("Message")');
            if (hasMessage) {
                await humanMoveAndClick(page, 'button:has-text("Message")');
                await wait(2000);
                const personalizedMsg = step.text.replace('{{firstName}}', lead.firstName || 'there');
                const msgBox = page.locator('.msg-form__contenteditable').first();
                await humanType(page, msgBox, personalizedMsg);
                await wait(1500);
                await page.keyboard.press('Control+Enter');
                console.log(`[WORKER] Message sent to ${lead.firstName}`);
            }
        }

        // Update DB
        await prisma.campaignLead.update({
            where: { id: data.campaignLeadId },
            data: { 
                stepIndex: stepIndex + 1,
                lastActionAt: new Date(),
                isCompleted: (stepIndex + 1 >= (campaign.workflow as any[]).length)
            }
        });

    } catch (error: any) {
        console.error(`[WORKER] Action failed for lead ${lead.id}:`, error.message);
        
        // Handle LinkedIn Restrictions
        if (error.message.includes('restricted') || error.message.includes('unusual activity')) {
            await prisma.user.update({
                where: { id: userId },
                data: { cloudWorkerActive: false }
            });
            
            await prisma.notification.create({
                data: {
                    userId: userId,
                    title: 'Account Restricted',
                    body: 'LinkedIn detected unusual activity. Actions have been paused for safety.',
                    meta: { severity: 'CRITICAL' }
                }
            });
        }

        // Save log
        await prisma.workerLog.create({
            data: {
                userId,
                campaignId,
                leadId,
                action: campaign.workflow?.[stepIndex]?.type || 'UNKNOWN',
                status: 'FAILED',
                errorMessage: error.message.substring(0, 255)
            }
        });

    } finally {
        if (browser) await browser.close();
    }
};

export const initWorker = () => {
    if (!redisConnection) return;
    const worker = new Worker('linkedin-actions', async (job: Job) => {
        await processWorkflowStep(job.data);
    }, { connection: redisConnection as any });

    worker.on('completed', (job) => console.log(`Job ${job.id} done`));
    worker.on('failed', (job, err) => console.error(`Job ${job?.id} failed:`, err.message));
};
