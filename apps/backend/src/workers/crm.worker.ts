import { Worker, Job, Queue } from 'bullmq';
import Redis from 'ioredis';
import { prisma } from '@repo/db';
import { syncLeadToCRMs } from '../services/crmService';
import { runProvidersForEvent, ProviderContext } from '../services/crm-providers';
import type { CrmEventPayload } from '../services/crm-events';

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';
const redisConnection = REDIS_URL ? new Redis(REDIS_URL, { maxRetriesPerRequest: null }) : null;

interface LegacyCRMJob {
    userId: string;
    leadId: string;
}
interface EventJob {
    kind: 'event';
    payload: CrmEventPayload;
}

export const crmQueue = redisConnection ? new Queue('crm-sync', { connection: redisConnection as any }) : null;

/**
 * Run a single event end-to-end: policy lookup → provider fan-out → audit
 * log. Exported so the in-process fallback in crm-events can call it when
 * Redis is unavailable.
 */
export async function handleCrmEvent(payload: CrmEventPayload): Promise<void> {
    const { event, userId, campaignId, leadId, meta } = payload;

    const policy = await prisma.campaignCrmPolicy.findUnique({ where: { campaignId } });
    if (!policy || !policy.enabled) {
        console.log(`[CRM-EVT] ${event} skipped — policy disabled for campaign ${campaignId}`);
        return;
    }

    const flag: Record<CrmEventPayload['event'], keyof typeof policy> = {
        'lead.added':     'syncOnAdded',
        'lead.connected': 'syncOnConnected',
        'lead.messaged':  'syncOnMessaged',
        'lead.replied':   'syncOnReplied',
        'lead.bounced':   'syncOnBounced',
        'lead.completed': 'syncOnCompleted',
    };
    if (!policy[flag[event]]) {
        console.log(`[CRM-EVT] ${event} skipped — policy flag off for campaign ${campaignId}`);
        return;
    }

    const lead = await prisma.lead.findUnique({ where: { id: leadId } });
    const campaign = await prisma.campaign.findUnique({
        where: { id: campaignId },
        select: { id: true, name: true },
    });
    if (!lead || !campaign) {
        console.warn(`[CRM-EVT] ${event} skipped — missing lead/campaign`);
        return;
    }

    const ctx: ProviderContext = {
        event,
        userId,
        campaignId,
        lead: {
            id: lead.id,
            email: lead.email,
            firstName: lead.firstName,
            lastName: lead.lastName,
            jobTitle: lead.jobTitle,
            company: lead.company,
            location: lead.location,
            linkedinUrl: lead.linkedinUrl,
            headline: lead.headline,
        },
        campaign,
        policy: {
            createTaskOnReply: policy.createTaskOnReply,
            ownerEmail: policy.ownerEmail,
        },
        meta,
    };

    const results = await runProvidersForEvent(userId, ctx);
    if (results.length === 0) return;

    await prisma.crmSyncEvent.createMany({
        data: results.map(r => ({
            userId,
            campaignId,
            leadId,
            event,
            provider: r.provider,
            status: r.result.skipped
                ? 'SKIPPED'
                : r.result.success
                    ? 'SUCCESS'
                    : 'FAILED',
            externalId: r.result.externalId ?? null,
            error: r.result.error ?? null,
            meta: r.result.skippedReason
                ? { reason: r.result.skippedReason }
                : undefined,
        })),
    });
}

export const initCRMWorker = () => {
    if (!redisConnection) {
        console.warn('[CRM-WORKER] No Redis connection. Worker not started.');
        return null;
    }

    const worker = new Worker('crm-sync', async (job: Job) => {
        const data = job.data as LegacyCRMJob | EventJob;
        if ((data as EventJob).kind === 'event') {
            const payload = (data as EventJob).payload;
            console.log(`[CRM-WORKER] event ${payload.event} lead=${payload.leadId} campaign=${payload.campaignId}`);
            await handleCrmEvent(payload);
            return;
        }
        const { userId, leadId } = data as LegacyCRMJob;
        console.log(`[CRM-WORKER] legacy sync job ${job.id} user=${userId} lead=${leadId}`);
        await syncLeadToCRMs(userId, leadId);
    }, {
        connection: redisConnection as any,
        concurrency: 2,
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
        backoff: { type: 'exponential', delay: 5000 },
        removeOnComplete: true,
    });
    console.log(`[CRM-WORKER] Enqueued CRM sync job for lead ${leadId}`);
};
