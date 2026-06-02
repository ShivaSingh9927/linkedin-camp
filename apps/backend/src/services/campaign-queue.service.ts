import { prisma } from '@repo/db';
import { enqueueCampaign } from '../workers/campaign-worker';

// FIFO per-user campaign queue. One ACTIVE campaign per user at a time;
// QUEUED campaigns wait, ordered by queuePosition (lower = next up).
// Auto-promotion fires only on COMPLETED — PAUSED/CANCELLED/FAILED keep
// the slot vacant on purpose (those usually need user intervention).

async function nextQueuePosition(userId: string): Promise<number> {
    const top = await prisma.campaign.findFirst({
        where: { userId, status: 'QUEUED' },
        orderBy: { queuePosition: 'desc' },
        select: { queuePosition: true },
    });
    return (top?.queuePosition ?? 0) + 1;
}

/**
 * Move a campaign into the user's QUEUED list at the tail. No-op if the
 * campaign is already ACTIVE or QUEUED.
 */
export async function queueCampaign(userId: string, campaignId: string) {
    const campaign = await prisma.campaign.findFirst({
        where: { id: campaignId, userId },
        select: { status: true },
    });
    if (!campaign) throw new Error('Campaign not found');
    if (campaign.status === 'ACTIVE' || campaign.status === 'QUEUED') return campaign;

    return prisma.campaign.update({
        where: { id: campaignId },
        data: {
            status: 'QUEUED',
            queuePosition: await nextQueuePosition(userId),
        },
    });
}

/**
 * Remove a campaign from the queue and revert to DRAFT. Does not shift the
 * remaining queue positions — gaps are fine because we always sort by
 * queuePosition asc.
 */
export async function unqueueCampaign(userId: string, campaignId: string) {
    const campaign = await prisma.campaign.findFirst({
        where: { id: campaignId, userId, status: 'QUEUED' },
    });
    if (!campaign) throw new Error('Campaign not in queue');

    return prisma.campaign.update({
        where: { id: campaignId },
        data: { status: 'DRAFT', queuePosition: null },
    });
}

/**
 * Atomically rewrite queue positions for the user from the supplied order.
 * Any QUEUED campaigns not in the list are pushed to the tail to preserve
 * the invariant that every QUEUED campaign has a position.
 */
export async function reorderQueue(userId: string, orderedIds: string[]) {
    const queued = await prisma.campaign.findMany({
        where: { userId, status: 'QUEUED' },
        select: { id: true },
    });
    const queuedIds = new Set(queued.map(q => q.id));
    const seen = new Set<string>();
    const final: string[] = [];
    for (const id of orderedIds) {
        if (queuedIds.has(id) && !seen.has(id)) { final.push(id); seen.add(id); }
    }
    // Append any queued campaigns the caller forgot, preserving original order.
    for (const q of queued) if (!seen.has(q.id)) final.push(q.id);

    await prisma.$transaction(
        final.map((id, idx) =>
            prisma.campaign.update({
                where: { id },
                data: { queuePosition: idx + 1 },
            })
        )
    );
    return final;
}

/**
 * Find the user's next QUEUED campaign and promote it to ACTIVE + enqueue
 * its worker job. Idempotent and safe to call after any campaign reaches
 * a terminal state — no-op if another campaign is already ACTIVE or the
 * queue is empty.
 *
 * Only called from terminal-status sites (recomputeCampaignStatus on
 * COMPLETED). Manual PAUSE/CANCEL do NOT auto-promote — those usually
 * mean the user wants the slot to stay vacant.
 */
export async function promoteNextQueuedCampaign(userId: string): Promise<string | null> {
    const alreadyActive = await prisma.campaign.findFirst({
        where: { userId, status: 'ACTIVE' },
        select: { id: true },
    });
    if (alreadyActive) return null;

    const next = await prisma.campaign.findFirst({
        where: { userId, status: 'QUEUED' },
        orderBy: { queuePosition: 'asc' },
        select: { id: true, name: true },
    });
    if (!next) return null;

    await prisma.campaign.update({
        where: { id: next.id },
        data: { status: 'ACTIVE', queuePosition: null },
    });

    try {
        await enqueueCampaign(userId, next.id);
    } catch (err: any) {
        // Roll back the promotion so the user can retry instead of having
        // an ACTIVE campaign that never enqueued.
        await prisma.campaign.update({
            where: { id: next.id },
            data: { status: 'QUEUED', queuePosition: 1 },
        });
        throw err;
    }

    console.log(`[campaign-queue] promoted ${next.id} ("${next.name}") for user ${userId}`);
    return next.id;
}
