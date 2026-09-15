import { prisma } from '@repo/db';
import { enqueueCampaign } from '../workers/campaign-worker';

// FIFO per-user campaign queue. One ACTIVE campaign per user at a time;
// QUEUED campaigns wait, ordered by queuePosition (lower = next up).
// Auto-promotion fires only on COMPLETED — PAUSED/CANCELLED/FAILED keep
// the slot vacant on purpose (those usually need user intervention).
//
// The single-ACTIVE rule is not an infrastructure limit: one LinkedIn account
// is the real bottleneck, and running several campaigns at once against it
// multiplies actions per hour on a single identity — the pattern that gets
// accounts restricted. Campaigns therefore run one at a time, in order.

/**
 * Most campaigns a user can have in flight: 1 ACTIVE + 3 QUEUED. The queue is
 * a promise about what runs next, and a queue long enough to stretch weeks
 * into the future is a worse experience than being told to come back — so the
 * backlog is bounded rather than unlimited.
 */
export const MAX_CAMPAIGNS_IN_FLIGHT = 4;

/** ACTIVE + QUEUED for this user — what counts against the cap. */
export async function countCampaignsInFlight(userId: string): Promise<number> {
    return prisma.campaign.count({
        where: { userId, status: { in: ['ACTIVE', 'QUEUED'] } },
    });
}

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

    // Cap the backlog. Checked here (not only at the API edge) so every caller
    // — REST, copilot, public API — obeys the same limit.
    const inFlight = await countCampaignsInFlight(userId);
    if (inFlight >= MAX_CAMPAIGNS_IN_FLIGHT) {
        throw new Error(
            `You can have ${MAX_CAMPAIGNS_IN_FLIGHT} campaigns in flight at once (1 running + ${MAX_CAMPAIGNS_IN_FLIGHT - 1} queued). Finish or cancel one first.`,
        );
    }

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
