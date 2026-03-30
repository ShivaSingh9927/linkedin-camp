/**
 * campaign-worker.ts
 * * Optimized to match the successful "Phase 2" browser strategy.
 * This worker pulls session data from Prisma and passes it to the engine.
 */

import { Worker, Job, Queue } from 'bullmq';
import { prisma } from '@repo/db';
import Redis from 'ioredis';
import { runCampaign } from '../campaign-engine';
import { CampaignConfig } from '../campaign-engine/types';

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';
const redisConnection = REDIS_URL ? new Redis(REDIS_URL, { maxRetriesPerRequest: null }) : null;

interface CampaignJobData {
    userId: string;
    campaignId: string;
}

const processCampaignJob = async (data: CampaignJobData, job: Job) => {
    const { userId, campaignId } = data;

    console.log(`\n[CAMPAIGN-WORKER] 🚀 Starting Campaign: ${campaignId}`);

    // 1. Fetch Campaign & Business Profile
    const campaign = await prisma.campaign.findUnique({ where: { id: campaignId } });
    const businessProfile = await prisma.businessProfile.findUnique({ where: { userId } });

    if (!campaign || !businessProfile) {
        console.error(`[CAMPAIGN-WORKER] Missing critical data for campaign ${campaignId}`);
        return;
    }

    // 2. FETCH SESSION DATA (from User table)
    const user = await prisma.user.findUnique({ where: { id: userId } });
    
    if (!user || (!user.linkedinCookie && !user.persistentSessionPath)) {
        throw new Error(`No active LinkedIn session found for user ${userId}. Run Phase 1 first.`);
    }

    // 3. PARSE CONFIG & INJECT STEALTH ARGS
    const rawConfig = campaign.workflowJson || campaign.workflow;
    const config: CampaignConfig = typeof rawConfig === 'string' ? JSON.parse(rawConfig) : rawConfig;
    
    // Inject AI Context & Session Security
    config.campaignId = campaignId;
    config.objective = campaign.objective || undefined;
    config.persona = businessProfile.persona || undefined;

    // Build session context from DB (same data the extension synced via /sync-extension)
    let parsedCookies = null;
    let parsedUserAgent = null;
    let parsedLocalStorage = null;

    try {
        if (user.linkedinCookie) {
            const raw = JSON.parse(user.linkedinCookie);
            // Normalize: ensure expires is a number (seconds), not string/ms
            parsedCookies = Array.isArray(raw) ? raw.map((c: any) => ({
                ...c,
                expires: c.expires != null ? Math.round(Number(c.expires)) : Math.round(Date.now() / 1000) + 86400 * 30,
                sameSite: c.sameSite === 'no_restriction' ? 'None' : (c.sameSite === 'unspecified' ? 'Lax' : c.sameSite),
            })) : raw;
        }
    } catch (e: any) {
        console.error(`[CAMPAIGN-WORKER] Cookie parse error: ${e.message}`);
    }

    try {
        if (user.linkedinFingerprint) {
            const fp = typeof user.linkedinFingerprint === 'string'
                ? JSON.parse(user.linkedinFingerprint) : user.linkedinFingerprint;
            parsedUserAgent = fp?.userAgent || null;
        }
    } catch {}

    try {
        if (user.linkedinLocalStorage) {
            parsedLocalStorage = typeof user.linkedinLocalStorage === 'string'
                ? JSON.parse(user.linkedinLocalStorage) : user.linkedinLocalStorage;
        }
    } catch {}

    config.sessionContext = {
        cookies: parsedCookies,
        userAgent: parsedUserAgent,
        localStorage: parsedLocalStorage,
        proxy: {
            server: 'http://82.41.252.111:46222',
            username: 'xBVyYdUpx84nWx7',
            password: 'dwwTxtvv5a10RXn',
        }
    };

    console.log(`[CAMPAIGN-WORKER] Session ready — cookies: ${parsedCookies?.length || 0}, UA: ${parsedUserAgent ? 'yes' : 'no'}, localStorage keys: ${parsedLocalStorage ? Object.keys(parsedLocalStorage).length : 0}`);

    // 4. CHECK LEAD AVAILABILITY
    const readyLeadsCount = await prisma.campaignLead.count({
        where: {
            campaignId,
            isCompleted: false,
            nextActionDate: { lte: new Date() },
        },
    });

    if (readyLeadsCount === 0) {
        console.log(`[CAMPAIGN-WORKER] ⏸️ No leads ready for processing right now.`);
        return;
    }

    // 5. EXECUTION
    await prisma.campaign.update({ where: { id: campaignId }, data: { status: 'ACTIVE' } });

    try {
        // We pass the sessionContext directly so runCampaign can launch Playwright correctly
        const summary = await runCampaign(userId, campaignId, config);

        console.log(`[CAMPAIGN-WORKER] ✅ Campaign ${campaignId} finished.`);
        console.log(`   Stats -> Succeeded: ${summary.succeeded}, Failed: ${summary.failed}`);
        
    } catch (err: any) {
        console.error(`[CAMPAIGN-WORKER] ❌ Critical Crash:`, err.message);

        await prisma.campaign.update({
            where: { id: campaignId },
            data: { status: 'PAUSED' },
        });

        await prisma.notification.create({
            data: {
                userId,
                title: 'Campaign Error',
                body: `Campaign "${campaign.name}" paused due to: ${err.message}`,
                type: 'ERROR',
            },
        });
    }
};

// ---- WORKER INITIALIZATION ----

export const initCampaignWorker = () => {
    if (!redisConnection) return;

    const worker = new Worker('campaign-actions', async (job: Job) => {
        await processCampaignJob(job.data as CampaignJobData, job);
    }, {
        connection: redisConnection as any,
        concurrency: 1, // Stay safe: One campaign at a time to avoid IP flags
    });

    worker.on('failed', (job, err) => {
        console.error(`[CAMPAIGN-WORKER] Job ${job?.id} failed:`, err.message);
    });

    console.log('[CAMPAIGN-WORKER] 🛰️ Listening on queue: campaign-actions');
    return worker;
};

// ---- QUEUE HELPERS ----

export const getCampaignQueue = () => {
    if (!redisConnection) return null;
    return new Queue('campaign-actions', { connection: redisConnection as any });
};

export const enqueueCampaign = async (userId: string, campaignId: string, delayMs = 0) => {
    const queue = getCampaignQueue();
    if (!queue) return;

    await queue.add(`campaign-${campaignId}`, { userId, campaignId }, {
        delay: delayMs,
        removeOnComplete: true,
        attempts: 1, // Don't auto-retry LinkedIn actions to prevent bans
    });

    console.log(`[CAMPAIGN-WORKER] 📥 Enqueued ${campaignId}`);
};