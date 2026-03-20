import { Worker, Job } from 'bullmq';
import { prisma } from '@repo/db';
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
            headless: true, // Always headless on cloud
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
            // Robust parsing: handle if the user pasted the full "li_at=..." string
            const rawCookie = user.linkedinCookie || '';
            const cookieValue = rawCookie.includes('li_at=')
                ? rawCookie.split('li_at=')[1].split(';')[0].trim()
                : rawCookie.replace(/^"|"$/g, '').trim();

            await context.addCookies([{
                name: 'li_at',
                value: cookieValue,
                domain: '.www.linkedin.com',
                path: '/',
                expires: Math.floor(Date.now() / 1000) + 3600 * 24 * 365, // 1 year fallback
                httpOnly: true,
                secure: true,
                sameSite: 'None'
            }]);
            console.log(`[WORKER] Manually injected li_at cookie for user ${userId}`);
        }

        // --- STEP EXECUTION ---
        const workflow = campaign.workflow as any;
        const step = Array.isArray(workflow) ? workflow[stepIndex] : null;
        if (!step) {
            console.error(`[WORKER] Step ${stepIndex} not found in workflow for campaign ${campaignId}`);
            return;
        }

        let stepType = (step.subType || step.type || '').toUpperCase();
        if (stepType === 'START' && step.type === 'ACTION') stepType = 'VISIT';
        console.log(`[WORKER] Executing step type: ${stepType}`);

        if (Math.random() > 0.7) await warmupSession(page);
        if (await checkInterrupt(userId)) throw new Error('INTERRUPTED: User active in browser');

        await page.goto(lead.linkedinUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });
        if (await checkInterrupt(userId)) throw new Error('INTERRUPTED: User active in browser');
        await wait(3000);

        if (stepType === 'INVITE' || stepType === 'INVITATION') {
            const hasConnect = await page.isVisible('button:has-text("Connect")');
            const isPending = await page.isVisible('button:has-text("Pending"), button:has-text("Withdraw")');

            if (isPending) {
                console.log(`[WORKER] Invite already pending for ${lead.firstName}.`);
            } else if (hasConnect) {
                if (await checkInterrupt(userId)) throw new Error('INTERRUPTED: User active in browser');
                await humanMoveAndClick(page, 'button:has-text("Connect")');
                await wait(2000);
                await page.click('button[aria-label="Send now"]');
            } else {
                console.log(`[WORKER] No connect button found for ${lead.firstName}.`);
            }
        } else if (stepType === 'MESSAGE') {
            const hasMessageButton = await page.isVisible('button:has-text("Message")');
            if (hasMessageButton) {
                await humanMoveAndClick(page, 'button:has-text("Message")');
                await wait(2000);
                const message = step.message || 'Hello {{firstName}}!';
                const finalMessage = message.replace(/{{firstName}}/g, lead.firstName || '');
                await humanType(page, '.msg-form__contenteditable', finalMessage);
                await wait(1000);
                await page.click('button[type="submit"]');
            }
        } else if (stepType === 'VISIT') {
            console.log(`[WORKER] Profile visit completed for ${lead.firstName}.`);
        }

        // Update progress
        await prisma.campaignLead.updateMany({
            where: { leadId: lead.id, campaignId: campaign.id },
            data: {
                stepIndex: stepIndex + 1,
                lastActionAt: new Date(),
                nextActionDate: new Date(Date.now() + 24 * 60 * 60 * 1000) // 1 day later
            }
        });

    } catch (error: any) {
        console.error(`[WORKER] Action failed for lead ${lead.id}:`, error.message);
    } finally {
        // --- PROXY SAFETY COOL DOWN ---
        if (user.proxyId && redisConnection) {
            const lockKey = `${PROXY_LOCK_PREFIX}${user.proxyId}`;
            // Set cooldown lock instead of just deleting
            await redisConnection.set(lockKey, 'COOLDOWN', 'EX', PROXY_COOLDOWN_SEC);
        }

        if (browser) await browser.close();
    }
};

export const initWorker = () => {
    if (!redisConnection) return;
    const worker = new Worker('linkedin-actions', async (job: Job) => {
        await processWorkflowStep(job.data, job);
    }, { connection: redisConnection as any, concurrency: 1 });

    worker.on('completed', (job) => console.log(`Job ${job.id} done`));
    worker.on('failed', (job, err) => console.log(`Job ${job?.id} failed:`, err.message));
};
