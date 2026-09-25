import { prisma } from '@repo/db';
import { enqueueCampaign } from '../workers/campaign-worker';

// FIFO per-user campaign queue. QUEUED campaigns wait, ordered by
// queuePosition (lower = next up).
//
// The rule is "one campaign WORKING at a time", not "one campaign ACTIVE at a
// time". Those are different, and conflating them cost real throughput: a
// campaign whose leads are all parked on a multi-day wait held the slot while
// doing nothing, so a queued campaign could not touch a completely unused
// daily allowance. The account sat idle and the user was told to wait.
//
// What actually protects the account is the per-account safety layer — daily,
// hourly and weekly caps plus per-action pacing, all scoped to userId across
// every campaign — and the per-account lock that serialises real LinkedIn
// work. Two ACTIVE campaigns cannot exceed the budget or interleave actions;
// they simply share one. So the gate is now "does another campaign have a lead
// due RIGHT NOW", and promotion fires when a campaign goes idle, not only when
// it finishes.
//
// PAUSED/CANCELLED/FAILED still keep the slot vacant on purpose — those
// usually need user intervention.

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

/**
 * Does this campaign have a lead ready to act on right now?
 *
 * "Working" means at least one unfinished lead whose nextActionDate has
 * matured. A campaign parked entirely on future waits is idle — still ACTIVE,
 * still owned by the user, just not using the account.
 */
export async function campaignHasWorkDue(campaignId: string): Promise<boolean> {
    const due = await prisma.campaignLead.count({
        where: { campaignId, isCompleted: false, nextActionDate: { lte: new Date() } },
    }).catch(() => 0);
    return due > 0;
}

/**
 * Is any of this user's ACTIVE campaigns actually working? `excludeId` skips
 * the campaign being started, which would otherwise block itself.
 *
 * Returns the blocking campaign so the caller can name it — "you already have
 * an active campaign" is not actionable; naming it is.
 */
export async function findWorkingCampaign(
    userId: string,
    excludeId?: string,
): Promise<{ id: string; name: string } | null> {
    const active = await prisma.campaign.findMany({
        where: { userId, status: 'ACTIVE', ...(excludeId ? { id: { not: excludeId } } : {}) },
        select: { id: true, name: true },
    });
    for (const c of active) {
        if (await campaignHasWorkDue(c.id)) return c;
    }
    return null;
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
 * Called when a campaign reaches a terminal state AND when a campaign run
 * ends with every lead parked — idle is as good as finished for the purpose of
 * letting the next campaign use the account. Manual PAUSE/CANCEL do NOT
 * auto-promote: those usually mean the user wants the slot to stay vacant.
 */
export async function promoteNextQueuedCampaign(userId: string): Promise<string | null> {
    // Only a campaign that is actually working blocks promotion. An ACTIVE
    // campaign sitting on a three-day wait no longer holds the queue.
    if (await findWorkingCampaign(userId)) return null;

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
