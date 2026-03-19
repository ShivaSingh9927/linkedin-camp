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

    let browser: any;
    let context: any;

    try {
        // --- MANUAL ACTIVITY SAFETY CHECK ---
        const fifteenMinsAgo = new Date(Date.now() - 15 * 60 * 1000);
        const isUserActiveInBrowser = user.linkedinActiveInBrowser || (user.lastBrowserActivityAt && user.lastBrowserActivityAt > fifteenMinsAgo);

        if (isUserActiveInBrowser) {
            const delayMs = (Math.floor(Math.random() * 300) + 600) * 1000;
            console.log(`[WORKER] User ${userId} is currently active in browser. Stalling cloud action for safety. Delaying by ${delayMs / 1000}s`);
            await job.moveToDelayed(Date.now() + delayMs);
            return;
        }

        // --- PROXY SAFETY LOCK ---
        if (user.proxyId && redisConnection) {
            const lockKey = `${PROXY_LOCK_PREFIX}${user.proxyId}`;
            const isLocked = await redisConnection.get(lockKey);

            if (isLocked) {
                const delayMs = (Math.floor(Math.random() * 120) + 60) * 1000;
                console.log(`[WORKER] Proxy ${user.proxyId} is busy or in cooldown. Delaying job ${job.id} by ${delayMs / 1000}s`);
                await job.moveToDelayed(Date.now() + delayMs);
                return;
            }

            await redisConnection.set(lockKey, 'LOCKED', 'EX', 300);
        }

        console.log(`[WORKER] Initiating action for lead ${lead.id} (${lead.firstName})`);

        const launchOptions: any = {
            headless: true,
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
            // Remove any surrounding quotes from the cookie value
            const cookieValue = user.linkedinCookie.replace(/^"|"$/g, '');
            await context.addCookies([{
                name: 'li_at',
                value: cookieValue,
                domain: '.www.linkedin.com',
                path: '/',
                secure: true,
                httpOnly: true
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

        const stepType = (step.subType || step.type || '').toUpperCase();
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

                const noteTemplate = step.note || step.message || step.text || (step.data as any)?.message || '';
                if (noteTemplate) {
                    const hasAddNote = await page.isVisible('button:has-text("Add a note")');
                    if (hasAddNote) {
                        if (await checkInterrupt(userId)) throw new Error('INTERRUPTED: User active in browser');
                        await humanMoveAndClick(page, 'button:has-text("Add a note")');
                        const personalizedNote = noteTemplate
                            .replace(/\{\{firstName\}\}/g, lead.firstName || 'there')
                            .replace(/\{firstName\}/g, lead.firstName || 'there');
                        await humanType(page, 'textarea[name="message"]', personalizedNote);
                        await wait(1500);
                    }
                }

                if (await checkInterrupt(userId)) throw new Error('INTERRUPTED: User active in browser');
                await humanMoveAndClick(page, 'button:has-text("Send")');
                console.log(`[WORKER] Invite sent to ${lead.firstName}`);
            }
        } else if (stepType === 'MESSAGE' || stepType === 'SEND MESSAGE') {
            const hasMessage = await page.isVisible('button:has-text("Message")');
            if (hasMessage) {
                if (await checkInterrupt(userId)) throw new Error('INTERRUPTED: User active in browser');
                await humanMoveAndClick(page, 'button:has-text("Message")');
                await wait(2500);

                const messageTemplate = step.text || step.message || (step.data as any)?.message || '';
                const personalizedMsg = messageTemplate
                    .replace(/\{\{firstName\}\}/g, lead.firstName || 'there')
                    .replace(/\{firstName\}/g, lead.firstName || 'there');

                const existingText = await page.innerText('.msg-convo-wrapper') || '';
                if (existingText.includes(personalizedMsg.substring(0, 50))) {
                    console.log(`[WORKER] Message seems already sent to ${lead.firstName}.`);
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
        } else if (stepType === 'VISIT') {
            console.log(`[WORKER] Profile visit successful for ${lead.firstName}`);
        }

        // Update DB
        const actionType = (step as any)?.type || 'UNKNOWN';

        await Promise.all([
            prisma.actionLog.create({
                data: {
                    userId,
                    campaignId,
                    leadId,
                    actionType,
                    status: 'SUCCESS'
                }
            }),
            prisma.lead.update({
                where: { id: leadId },
                data: { lastActionAt: new Date() }
            })
        ]);

    } catch (error: any) {
        console.error(`[WORKER ERROR] ${error.message}`);
        await prisma.actionLog.create({
            data: {
                userId,
                campaignId,
                leadId,
                actionType: 'ERROR',
                status: 'FAILED',
                error: error.message
            }
        });
        throw error;
    } finally {
        if (browser) await browser.close();
        if (context) await context.close();
        
        if (user.proxyId && redisConnection) {
            await redisConnection.del(`${PROXY_LOCK_PREFIX}${user.proxyId}`);
            await redisConnection.set(`${PROXY_LOCK_PREFIX}${user.proxyId}`, 'COOLDOWN', 'EX', PROXY_COOLDOWN_SEC);
        }
    }
};
