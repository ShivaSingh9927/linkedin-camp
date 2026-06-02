import { prisma } from '@repo/db';
import { crmQueue, enqueueCRMSync } from '../workers/crm.worker';

// Event-driven CRM sync. The engine + workers call `emitCrmEvent` at lifecycle
// transitions; this file's only job is to drop a job on the BullMQ queue.
// All real work (policy lookup, provider fan-out, retries) happens in the
// crm.worker handler.
//
// Emit is fire-and-forget by contract: callers MUST NOT await the
// downstream sync. Engine throughput is too sensitive to add a network
// round-trip per lifecycle event.

export type CrmEventType =
    | 'lead.added'
    | 'lead.connected'
    | 'lead.messaged'
    | 'lead.replied'
    | 'lead.bounced'
    | 'lead.completed';

export interface CrmEventPayload {
    event: CrmEventType;
    userId: string;
    campaignId: string;
    leadId: string;
    // Free-form context that downstream provider mappers use to enrich the
    // CRM-side record. Examples: messageId on lead.messaged, replyContent on
    // lead.replied, reason on lead.bounced/completed.
    meta?: Record<string, any>;
}

/**
 * Drop a CRM event onto the queue. Never throws — failures are logged and
 * swallowed so the calling lifecycle code stays unblocked.
 */
export async function emitCrmEvent(payload: CrmEventPayload): Promise<void> {
    try {
        if (!crmQueue) {
            // No Redis / queue not initialized — fall back to inline sync so
            // dev environments still see CRM writes. Cheap because dev users
            // typically have no provider tokens.
            const { handleCrmEvent } = await import('../workers/crm.worker');
            await handleCrmEvent(payload);
            return;
        }
        await crmQueue.add(
            `crm-evt-${payload.event}-${payload.leadId}`,
            { kind: 'event', payload },
            {
                attempts: 3,
                backoff: { type: 'exponential', delay: 5000 },
                removeOnComplete: true,
                removeOnFail: 200, // keep last 200 failed for triage
            },
        );
    } catch (err: any) {
        console.error(`[CRM-EVT] emit failed for ${payload.event}/${payload.leadId}: ${err?.message}`);
    }
}

/**
 * Ensure a CampaignCrmPolicy row exists for a campaign. Called from
 * `startCampaign` so users with CRM connected start syncing automatically.
 * No-op if the row already exists (idempotent).
 */
export async function ensureCampaignCrmPolicy(
    campaignId: string,
    userId: string,
): Promise<void> {
    const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { hubspotToken: true, pipedriveToken: true, notionToken: true, email: true },
    });
    if (!user) return;
    const hasAnyCrm =
        !!user.hubspotToken || !!user.pipedriveToken || !!user.notionToken;
    if (!hasAnyCrm) return;

    await prisma.campaignCrmPolicy.upsert({
        where: { campaignId },
        create: {
            campaignId,
            enabled: true,
            ownerEmail: user.email,
        },
        update: {},
    });
}

/** Legacy fallback for callers that want the old one-shot identity upsert. */
export { enqueueCRMSync };
