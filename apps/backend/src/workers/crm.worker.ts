import { Worker, Job, Queue } from 'bullmq';
import Redis from 'ioredis';
import { syncLeadToCRMs } from '../services/crmService';

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';
const redisConnection = REDIS_URL ? new Redis(REDIS_URL, { maxRetriesPerRequest: null }) : null;

interface CRMJobData {
    userId: string;
    leadId: string;
}

export const crmQueue = redisConnection ? new Queue('crm-sync', { connection: redisConnection as any }) : null;

export const initCRMWorker = () => {
    if (!redisConnection) {
        console.warn('[CRM-WORKER] No Redis connection. Worker not started.');
        return null;
    }

    const worker = new Worker('crm-sync', async (job: Job) => {
        const { userId, leadId } = job.data as CRMJobData;
        console.log(`[CRM-WORKER] Processing job ${job.id} for user ${userId}, lead ${leadId}`);
        await syncLeadToCRMs(userId, leadId);
    }, {
        connection: redisConnection as any,
        concurrency: 2, // Process up to 2 CRM sync actions in parallel
    });

    worker.on('completed', (job) => {
        console.log(`[CRM-WORKER] Job ${job?.id} completed successfully.`);
    });

    worker.on('failed', (job, err) => {
        console.error(`[CRM-WORKER] Job ${job?.id} failed:`, err.message);
    });

    console.log('[CRM-WORKER] Worker listening on queue: crm-sync');
    return worker;
};

export const enqueueCRMSync = async (userId: string, leadId: string) => {
    if (!crmQueue) {
        console.warn('[CRM-WORKER] CRM Queue not initialized. Processing sync synchronously.');
        await syncLeadToCRMs(userId, leadId);
        return;
    }

    await crmQueue.add(`crm-sync-${leadId}`, { userId, leadId }, {
        attempts: 3,
        backoff: {
            type: 'exponential',
            delay: 5000, // 5s, 10s, 20s backoff
        },
        removeOnComplete: true,
    });
    console.log(`[CRM-WORKER] Enqueued CRM sync job for lead ${leadId}`);
};
