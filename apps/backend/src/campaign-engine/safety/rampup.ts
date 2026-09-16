/**
 * Invite ramp-up: an account's daily invite allowance grows with its history
 * instead of starting at the ceiling.
 *
 * WHY a curve and not a number. LinkedIn's abuse signals are relative to the
 * account's OWN baseline, not just a global threshold: an account that sent 5
 * invites last week and 80 this week is anomalous even though 80 is under every
 * published limit. Waalaxy says it plainly — the users who get restricted
 * fastest are the ones who install it and immediately set the daily max. A flat
 * cap is therefore both too loose for a fresh account and too tight for a
 * mature one; 18/day for everyone (what we shipped before) was exactly that
 * compromise.
 *
 * HONESTY about the numbers: the schedule below is industry convention, not
 * something LinkedIn publishes or that we have measured. What makes it
 * defensible is the SHAPE — start low, climb slowly, never jump far past your
 * own recent pace, and back off when invitations aren't being accepted — rather
 * than the exact figures, which are easy to tune in one place here.
 */

import { prisma } from '@repo/db';

function startOfTodayUTC(): Date {
    const d = new Date();
    return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

/** Where a fully warmed, healthy account lands. */
export const RAMP_CEILING = 40;

/** Day-one allowance for an account with no history at all. */
const RAMP_FLOOR = 10;

/** What a restricted/unhealthy account is cut back to. */
const RAMP_PENALTY = 5;

/**
 * Calendar schedule: days of activity → invites/day. The upper bound only; the
 * pace rule below can hold an account lower for longer.
 */
function scheduledCap(daysActive: number): number {
    if (daysActive < 7) return RAMP_FLOOR;   // week 1
    if (daysActive < 14) return 15;          // week 2
    if (daysActive < 21) return 25;          // week 3
    if (daysActive < 28) return 32;          // week 4
    return RAMP_CEILING;                     // week 5+
}

export interface RampState {
    cap: number;
    daysActive: number;
    scheduled: number;
    /**
     * Ceiling derived from the account's own recent pace (the anti-spike rule),
     * measured over the 7 days BEFORE today so it can't move during the day.
     */
    paceCeiling: number;
    /** accepted / (accepted + outstanding), or null when there isn't enough signal. */
    acceptanceRate: number | null;
    reason: 'schedule' | 'pace' | 'low-acceptance' | 'unhealthy';
}

// Each read is 3-4 counts; a campaign asks once per invite. Memoise briefly so a
// 40-lead run doesn't repeat them 40 times. Short TTL — the inputs move slowly,
// but an account that just got restricted should feel it within minutes.
const CACHE_TTL_MS = 10 * 60 * 1000;
const cache = new Map<string, { at: number; state: RampState }>();

/** Testing seam. */
export function resetRampCache(): void {
    cache.clear();
}

export async function getRampState(userId: string): Promise<RampState> {
    const hit = cache.get(userId);
    if (hit && Date.now() - hit.at < CACHE_TTL_MS) return hit.state;

    // NOTE: acceptance is counted via an explicit campaignId list rather than a
    // `campaign: { userId }` relation filter. Prisma relation casing differs
    // between what local tsc accepts and what the prod client exposes (see the
    // casing-drift incident), and a filter that compiles here but throws in
    // prod would silently pin every account to the fallback cap. An id list is
    // casing-proof and a user has few campaigns.
    const campaigns = await prisma.campaign
        .findMany({ where: { userId }, select: { id: true } })
        .catch(() => [] as Array<{ id: string }>);
    const campaignIds = campaigns.map((c) => c.id);

    const [firstAction, user, weekInvites, accepted, outstanding] = await Promise.all([
        prisma.actionLog.findFirst({
            where: { userId, status: 'SUCCESS' },
            orderBy: { executedAt: 'asc' },
            select: { executedAt: true },
        }).catch(() => null),
        prisma.user.findUnique({ where: { id: userId }, select: { accountHealth: true } }).catch(() => null),
        // The 7 full days BEFORE today — today is deliberately excluded.
        //
        // Counting today made the day's own invites raise the day's own
        // ceiling: caught live 2026-09-16, where a run hit "9/9", then sent
        // another invite anyway once the pace ceiling had crept to 12. It
        // converges rather than running away (used grows 1 per send, the cap
        // only 2/7), but a daily cap that today's activity can move is not a
        // cap — and it makes "why did it stop at 9?" unanswerable. Yesterday's
        // pace is fixed, so today's number is now stable all day.
        prisma.actionLog.count({
            where: {
                userId, actionType: 'connect', status: 'SUCCESS',
                executedAt: { gte: new Date(startOfTodayUTC().getTime() - 7 * 86_400_000), lt: startOfTodayUTC() },
            },
        }).catch(() => 0),
        campaignIds.length
            ? prisma.campaignLeadProgress.count({
                where: { connectionStatus: 'connected', campaignId: { in: campaignIds } },
            }).catch(() => 0)
            : Promise.resolve(0),
        campaignIds.length
            ? prisma.campaignLeadProgress.count({
                where: { connectionStatus: 'pending', campaignId: { in: campaignIds } },
            }).catch(() => 0)
            : Promise.resolve(0),
    ]);

    const daysActive = firstAction
        ? Math.floor((Date.now() - firstAction.executedAt.getTime()) / 86_400_000)
        : 0;
    const scheduled = scheduledCap(daysActive);

    // Anti-spike: never allow much more than the account's own recent pace.
    // ~2x the PRIOR 7 days' daily average, plus a small constant so a quiet
    // account can still restart. This is what actually keeps the curve smooth —
    // the calendar alone would hand day-28 an allowance of 32 even if the
    // account had sent nothing for three weeks.
    const recentDaily = weekInvites / 7;
    const paceCeiling = Math.max(RAMP_FLOOR, Math.ceil(recentDaily * 2) + 5);

    let cap = Math.min(scheduled, paceCeiling, RAMP_CEILING);
    let reason: RampState['reason'] = cap === paceCeiling && paceCeiling < scheduled ? 'pace' : 'schedule';

    // Acceptance: "many of your invitations have been ignored, left pending, or
    // marked as spam" is one of the three restriction triggers LinkedIn names.
    // Require a real sample before acting — early campaigns are all-pending by
    // definition and would otherwise look like failure.
    const decided = accepted + outstanding;
    const acceptanceRate = decided >= 20 ? accepted / decided : null;
    if (acceptanceRate !== null && acceptanceRate < 0.15) {
        cap = Math.max(RAMP_PENALTY, Math.floor(cap / 2));
        reason = 'low-acceptance';
    }

    // A restricted account shouldn't be climbing at all.
    if (user?.accountHealth && user.accountHealth !== 'HEALTHY') {
        cap = RAMP_PENALTY;
        reason = 'unhealthy';
    }

    const state: RampState = { cap, daysActive, scheduled, paceCeiling, acceptanceRate, reason };
    cache.set(userId, { at: Date.now(), state });
    return state;
}
