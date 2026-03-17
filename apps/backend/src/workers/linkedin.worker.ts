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

const PROXY_LOCK_PREFIX = 'proxy_lock:';
const USER_PRESENCE_PREFIX = 'user_presence:';
const PROXY_COOLDOWN_SEC = 60; // 1 minute gap between different users on same IP

const checkInterrupt = async (userId: string): Promise<boolean> => {
    if (!redisConnection) return false;
    const isInterrupted = await redisConnection.get(`${USER_PRESENCE_PREFIX}${userId}`);
    return isInterrupted === 'ACTIVE';
};

export const processWorkflowStep = async (data: any, job: Job) => {
    const { userId, campaignId, leadId, stepIndex } = data;

    const user = await prisma.user.findUnique({
        where: { id: userId },
        include: { proxy: true }
    });
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

    let browser: any;
    let context: any;

    try {
        // --- MANUAL ACTIVITY SAFETY CHECK ---
        const fifteenMinsAgo = new Date(Date.now() - 15 * 60 * 1000);
        const isUserActiveInBrowser = user.linkedinActiveInBrowser || (user.lastBrowserActivityAt && user.lastBrowserActivityAt > fifteenMinsAgo);

        if (isUserActiveInBrowser) {
            const delayMs = (Math.floor(Math.random() * 300) + 600) * 1000; // 10-15 minutes
            console.log(`[WORKER] User ${userId} is currently active in browser. Stalling cloud action for safety. Delaying by ${delayMs / 1000}s`);
            await job.moveToDelayed(Date.now() + delayMs);
            return;
        }

        // --- PROXY SAFETY LOCK ---
        if (user.proxyId && redisConnection) {
            const lockKey = `${PROXY_LOCK_PREFIX}${user.proxyId}`;
            const isLocked = await redisConnection.get(lockKey);

            if (isLocked) {
                // If the proxy is being used by another user or in cooldown, delay this job
                const delayMs = (Math.floor(Math.random() * 120) + 60) * 1000; // 1-3 minutes
                console.log(`[WORKER] Proxy ${user.proxyId} is busy or in cooldown. Delaying job ${job.id} by ${delayMs / 1000}s`);
                await job.moveToDelayed(Date.now() + delayMs);
                return;
            }

            // Lock the proxy for the duration of this action (max 5 mins failsafe)
            await redisConnection.set(lockKey, 'LOCKED', 'EX', 300);
        }

        console.log(`[WORKER] Initiating action for lead ${lead.id} (${lead.firstName})`);

        // Use persistent context if available for high-tier accounts
        const launchOptions: any = {
            headless: process.env.HEADLESS_MODE !== 'false',
            args: ['--no-sandbox', '--disable-setuid-sandbox']
        };

        if (user.proxy) {
            launchOptions.proxy = {
                server: `${user.proxy.proxyHost}:${user.proxy.proxyPort}`,
                username: user.proxy.proxyUsername || undefined,
                password: user.proxy.proxyPassword || undefined
            };
            console.log(`[WORKER] Using proxy: ${user.proxy.proxyHost}`);
        }

        if (user.persistentSessionPath) {
            context = await chromium.launchPersistentContext(user.persistentSessionPath, launchOptions);
        } else {
            browser = await chromium.launch(launchOptions);
            context = await browser.newContext();
        }

        const page = context.pages()[0] || await context.newPage();

        // If using raw cookie (no persistent session)
        if (!user.persistentSessionPath && user.linkedinCookie) {
            await context.addCookies([{
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
        const workflow = campaign.workflow as any;
        const step = Array.isArray(workflow) ? workflow[stepIndex] : null;
        if (!step) return;

        // Warmup (Random behavior)
        if (Math.random() > 0.7) await warmupSession(page);
        if (await checkInterrupt(userId)) throw new Error('INTERRUPTED: User active in browser');

        await page.goto(lead.linkedinUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });
        if (await checkInterrupt(userId)) throw new Error('INTERRUPTED: User active in browser');
        await wait(3000);

        if (step.type === 'INVITE') {
            const hasConnect = await page.isVisible('button:has-text("Connect")');
            const isPending = await page.isVisible('button:has-text("Pending"), button:has-text("Withdraw")');

            if (isPending) {
                console.log(`[WORKER] Invite already appears to be sent/pending for ${lead.firstName}. Skipping action, but marking as success.`);
                // Fall through to DB update below
            } else if (hasConnect) {
                if (await checkInterrupt(userId)) throw new Error('INTERRUPTED: User active in browser');
                await humanMoveAndClick(page, 'button:has-text("Connect")');
                await wait(2000);

                if (step.note) {
                    const hasAddNote = await page.isVisible('button:has-text("Add a note")');
                    if (hasAddNote) {
                        if (await checkInterrupt(userId)) throw new Error('INTERRUPTED: User active in browser');
                        await humanMoveAndClick(page, 'button:has-text("Add a note")');
                        const personalizedNote = step.note.replace('{{firstName}}', lead.firstName || 'there');
                        await humanType(page, 'textarea[name="message"]', personalizedNote);
                        await wait(1500);
                    }
                }

                if (await checkInterrupt(userId)) throw new Error('INTERRUPTED: User active in browser');
                await humanMoveAndClick(page, 'button:has-text("Send")');
                console.log(`[WORKER] Invite sent to ${lead.firstName}`);
            } else {
                console.log(`[WORKER] Could not find Connect button for ${lead.firstName}. Already connected?`);
            }
        } else if (step.type === 'MESSAGE') {
            const hasMessage = await page.isVisible('button:has-text("Message")');
            if (hasMessage) {
                if (await checkInterrupt(userId)) throw new Error('INTERRUPTED: User active in browser');
                await humanMoveAndClick(page, 'button:has-text("Message")');
                await wait(2500);

                const personalizedMsg = step.text.replace('{{firstName}}', lead.firstName || 'there');

                // --- RECOVERY CHECK: If message window open, check if we already sent this exact message ---
                const existingText = await page.innerText('.msg-convo-wrapper') || '';
                if (existingText.includes(personalizedMsg.substring(0, 100))) {
                    console.log(`[WORKER] Message seems already sent to ${lead.firstName}. Recovery complete.`);
                    // Fall through to DB update
                } else {
                    const msgBox = page.locator('.msg-form__contenteditable').first();
                    if (await checkInterrupt(userId)) throw new Error('INTERRUPTED: User active in browser');
                    await humanType(page, msgBox, personalizedMsg);
                    await wait(1500);
                    if (await checkInterrupt(userId)) throw new Error('INTERRUPTED: User active in browser');
                    await page.keyboard.press('Control+Enter');
                    console.log(`[WORKER] Message sent to ${lead.firstName}`);
                }
            }
        }

        // Update DB
        const actionType = (step as any)?.type || 'UNKNOWN';

        await Promise.all([
            // 1. Create Action Log
            prisma.actionLog.create({
                data: {
                    userId,
                    campaignId,
                    leadId,
                    actionType,
                    status: 'SUCCESS'
                }
            }),
            // 2. Update Campaign Lead progress
            prisma.campaignLead.update({
                where: { id: (data as any).campaignLeadId },
                data: {
                    stepIndex: stepIndex + 1,
                    lastActionAt: new Date(),
                    isCompleted: (stepIndex + 1 >= (campaign.workflow as any[]).length),
                    status: actionType === 'INVITE' ? 'PENDING' : actionType === 'MESSAGE' ? 'CONNECTED' : undefined
                }
            })
        ]);

    } catch (error: any) {
        if (error.message.includes('INTERRUPTED')) {
            console.log(`[WORKER] Workflow step index ${stepIndex} interrupted for user ${userId}. Job will be retried automatically when user is offline.`);
            // Don't mark as failed in a way that suggests a bug, just exit. 
            // BullMQ will treat the thrown error as a job failure and retry it based on backoff.
            throw error;
        }

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
                action: (campaign.workflow as any)?.[stepIndex]?.type || 'UNKNOWN',
                status: 'FAILED',
                errorMessage: error.message.substring(0, 255)
            }
        });

    } finally {
        // --- RELEASE & COOLDOWN ---
        if (user?.proxyId && redisConnection) {
            const lockKey = `${PROXY_LOCK_PREFIX}${user.proxyId}`;
            // Set cooldown: Keep it "locked" for 60s so another user doesn't jump in immediately
            await redisConnection.set(lockKey, 'COOLDOWN', 'EX', PROXY_COOLDOWN_SEC);
            console.log(`[WORKER] Released proxy ${user.proxyId}. Entering ${PROXY_COOLDOWN_SEC}s cooldown.`);
        }

        if (browser) await browser.close();
        else if (context) await context.close();
    }
};

export const initWorker = () => {
    if (!redisConnection) return;
    const worker = new Worker('linkedin-actions', async (job: Job) => {
        await processWorkflowStep(job.data, job);
    }, { connection: redisConnection as any });

    worker.on('completed', (job) => console.log(`Job ${job.id} done`));
    worker.on('failed', (job, err) => console.error(`Job ${job?.id} failed:`, err.message));
};
