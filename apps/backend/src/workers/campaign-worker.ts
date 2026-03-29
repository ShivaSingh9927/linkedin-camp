/**
 * campaign-worker.ts
 *
 * New BullMQ worker that uses the campaign engine.
 * Drop-in replacement: update the import path in server.ts or wherever initWorker is called.
 *
 * Queues jobs on 'campaign-actions' queue.
 * Each job = run one campaign for all its pending leads.
 */

import { Worker, Job } from 'bullmq';
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

    console.log(`[CAMPAIGN-WORKER] Processing campaign ${campaignId} for user ${userId}`);

    const campaign = await prisma.campaign.findUnique({
        where: { id: campaignId },
    });

    if (!campaign) {
        console.error(`[CAMPAIGN-WORKER] Campaign ${campaignId} not found.`);
        return;
    }

    // Parse the campaign config
    const rawConfig = campaign.workflowJson || campaign.workflow;
    if (!rawConfig) {
        console.error(`[CAMPAIGN-WORKER] Campaign ${campaignId} has no workflow config.`);
        return;
    }

    const config: CampaignConfig = typeof rawConfig === 'string' ? JSON.parse(rawConfig) : rawConfig;

    if (!config.flow || config.flow.length === 0) {
        console.error(`[CAMPAIGN-WORKER] Campaign ${campaignId} has empty flow.`);
        return;
    }

    // Check for delayed leads — only process those whose nextActionDate has passed
    const pendingLeads = await prisma.campaignLead.count({
        where: {
            campaignId,
            isCompleted: false,
            nextActionDate: { lte: new Date() },
        },
    });

    if (pendingLeads === 0) {
        console.log(`[CAMPAIGN-WORKER] No leads ready for processing in campaign ${campaignId}.`);
        return;
    }

    // Mark campaign as active
    await prisma.campaign.update({
        where: { id: campaignId },
        data: { status: 'ACTIVE' },
    });

    try {
        const summary = await runCampaign(userId, campaignId, config);

        console.log(`[CAMPAIGN-WORKER] Campaign ${campaignId} finished.`);
        console.log(`  Succeeded: ${summary.succeeded}, Failed: ${summary.failed}`);
    } catch (err: any) {
        console.error(`[CAMPAIGN-WORKER] Campaign ${campaignId} crashed:`, err.message);

        // Mark as paused so user can investigate
        await prisma.campaign.update({
            where: { id: campaignId },
            data: { status: 'PAUSED' },
        }).catch(() => {});

        await prisma.notification.create({
            data: {
                userId,
                title: 'Campaign Paused',
                body: `Campaign "${campaign.name}" encountered an error: ${err.message}`,
                type: 'ERROR',
            },
        }).catch(() => {});
    }
};

export const initCampaignWorker = () => {
    if (!redisConnection) {
        console.warn('[CAMPAIGN-WORKER] No Redis connection. Worker not started.');
        return;
    }

    const worker = new Worker('campaign-actions', async (job: Job) => {
        await processCampaignJob(job.data as CampaignJobData, job);
    }, {
        connection: redisConnection as any,
        concurrency: 1, // One campaign at a time
    });

    worker.on('completed', (job) => {
        console.log(`[CAMPAIGN-WORKER] Job ${job.id} completed.`);
    });

    worker.on('failed', (job, err) => {
        console.error(`[CAMPAIGN-WORKER] Job ${job?.id} failed:`, err.message);
    });

    console.log('[CAMPAIGN-WORKER] Worker started. Listening on queue: campaign-actions');
    return worker;
};

// ---- Queue helper to enqueue a campaign ----

import { Queue } from 'bullmq';

export const getCampaignQueue = () => {
    if (!redisConnection) return null;
    return new Queue('campaign-actions', { connection: redisConnection as any });
};

export const enqueueCampaign = async (userId: string, campaignId: string, delayMs = 0) => {
    const queue = getCampaignQueue();
    if (!queue) {
        console.error('[CAMPAIGN-WORKER] Cannot enqueue. No Redis connection.');
        return;
    }

    await queue.add(`campaign-${campaignId}`, { userId, campaignId }, {
        delay: delayMs,
        removeOnComplete: true,
    });

    console.log(`[CAMPAIGN-WORKER] Enqueued campaign ${campaignId} (delay: ${delayMs}ms)`);
};
