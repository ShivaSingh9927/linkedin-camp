/**
 * enrichment-worker.ts
 *
 * Processes one-time self-profile enrichment jobs (visit the user's OWN
 * profile + posts after login, summarize, write back to BusinessProfile).
 *
 * Shares the SAME per-account Redis lock as the campaign worker
 * (`linkedin-lock:${userId}`) so enrichment never drives a LinkedIn account
 * concurrently with a real campaign.
 */

import { Worker, Job, Queue } from 'bullmq';
import Redis from 'ioredis';
import { runSelfProfileEnrichment } from '../services/self-enrichment.service';
import { tryAcquireAccountLock, releaseAccountLock } from './campaign-worker';

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';
const redisConnection = REDIS_URL ? new Redis(REDIS_URL, { maxRetriesPerRequest: null }) : null;

const QUEUE_NAME = 'self-enrichment';
const LOCK_RETRY_DELAY_MS = 30_000;

interface EnrichmentJobData {
    userId: string;
}

export const getEnrichmentQueue = () => {
    if (!redisConnection) return null;
    return new Queue(QUEUE_NAME, { connection: redisConnection as any });
};

/**
 * Enqueue a self-enrichment run. `delayMs` lets the caller give the freshly
 * captured session a moment to settle before we reuse it (default 60s).
 */
export const enqueueSelfEnrichment = async (userId: string, delayMs = 60_000) => {
    const queue = getEnrichmentQueue();
    if (!queue) {
        console.log('[ENRICH-WORKER] No Redis — cannot enqueue self-enrichment');
        return;
    }
    await queue.add(
        `enrich-${userId}`,
        { userId },
        { delay: delayMs, removeOnComplete: true, attempts: 1 }
    );
    console.log(`[ENRICH-WORKER] 📥 Enqueued self-enrichment for ${userId} (delay=${delayMs}ms)`);
};

export const initEnrichmentWorker = () => {
    if (!redisConnection) {
        console.log('[ENRICH-WORKER] ❌ No Redis connection - worker NOT started');
        return;
    }

    const worker = new Worker(
        QUEUE_NAME,
        async (job: Job) => {
            const { userId } = job.data as EnrichmentJobData;
            console.log(`[ENRICH-WORKER] 📥 Received enrichment job for ${userId}`);

            const lockToken = `enrich-${job.id || 'unknown'}-${Date.now()}`;
            const acquired = await tryAcquireAccountLock(userId, lockToken);
            if (!acquired) {
                console.log(`[ENRICH-WORKER] 🔒 Account ${userId} busy — re-queueing in ${LOCK_RETRY_DELAY_MS / 1000}s`);
                const queue = getEnrichmentQueue();
                if (queue) {
                    await queue.add(`enrich-retry-${userId}`, { userId }, {
                        delay: LOCK_RETRY_DELAY_MS,
                        removeOnComplete: true,
                        attempts: 1,
                    });
                }
                return;
            }

            try {
                const result = await runSelfProfileEnrichment(userId);
                console.log(`[ENRICH-WORKER] user=${userId} result=${result.status}${result.reason ? ` (${result.reason})` : ''}`);
            } finally {
                await releaseAccountLock(userId, lockToken);
            }
        },
        {
            connection: redisConnection as any,
            // Enrichment is light and infrequent; small concurrency is plenty
            // and the per-account lock serializes per user anyway.
            concurrency: parseInt(process.env.ENRICH_CONCURRENCY || '3', 10),
        }
    );

    worker.on('failed', (job, err) => {
        console.error(`[ENRICH-WORKER] Job ${job?.id} failed:`, err.message);
    });

    console.log(`[ENRICH-WORKER] 🛰️ Listening on queue: ${QUEUE_NAME}`);
    return worker;
};
