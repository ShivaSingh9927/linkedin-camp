import { prisma } from '@repo/db';
import { planFor, tierAllows, type PlanFeatures } from '../../config/plans';
import { getRampState, RAMP_CEILING } from './rampup';

// Per-user daily caps on LinkedIn write actions.
//
// LinkedIn enforces server-side rate limits on the account, not the campaign,
// so caps must be applied per User across all of their campaigns.
//
// Values err well below LinkedIn's known cliffs (invites: anecdotal ~100/wk
// before warning, ~80/wk safer; messages to 1st-degree: ~100/day theoretical,
// ~40/day safer). Tighten further if account-warning telemetry ever fires.
//
// ENGAGEMENT actions (like/comment/follow/visit) are governed too, but loosely:
// they are ordinary browsing behaviour, not outreach, and a human genuinely
// does 20–30 profile visits in an hour. These ceilings exist to bound a runaway
// campaign — a template that loops, or 200 leads launched at once — not to
// model a limit LinkedIn is known to enforce at these volumes. Profile views
// are the one engagement action with a documented cliff (~500/day free), so
// 150 sits well under it while still covering a large campaign day.
export const DAILY_CAPS: Record<string, number> = {
    // Outreach — LinkedIn polices these hardest.
    //
    // 40 is the ceiling for a WARMED account, not a starting allowance: the
    // ramp (safety/rampup.ts) holds new accounts near 10/day and climbs over
    // ~5 weeks, and the rolling 200/week cap binds before 40/day ever does.
    // Waalaxy runs 80-100/day, but our accounts also spend budget on visits,
    // likes and comments that feed the same activity picture.
    'connect': RAMP_CEILING,
    // 120/day matches what Waalaxy runs on its Advanced/Business tiers; our
    // previous 40 was a guess with nothing behind it. Messages to existing
    // 1st-degree connections are far less policed than invitations.
    'send-message': 120,
    // Engagement.
    'like-nth-post': 60,
    'comment-nth-post': 30,
    'follow': 80,
    'profile-visit': 150,
    'profile-visit-voyager': 150,
};

export type GovernedAction = keyof typeof DAILY_CAPS;

// ---- Weekly ceilings (rolling 7 days) ----
//
// THE interval LinkedIn actually enforces for invitations. Its help pages
// confirm limits exist, that "all LinkedIn members (Basic and Premium) are
// subject to invitation limits", that Premium cannot buy more, and that a
// restriction typically lasts ONE WEEK — but LinkedIn publishes no number.
// Waalaxy, which has run this at scale for years, treats 200/week as the hard
// platform stop that overrides their own per-plan quotas, so we adopt it.
//
// This is the binding constraint: 18/day unchecked is 126/week, and a daily cap
// alone can't see the week at all.
export const WEEKLY_CAPS: Record<string, number> = {
    'connect': 200,
};

// ---- Outstanding-invitation ceiling ----
//
// LinkedIn lists "many of your invitations have been ignored, left pending, or
// marked as spam" as a restriction trigger, and says too many OUTSTANDING
// invitations can cost up to a MONTH — the longest penalty on its page. Volume
// per day/week is only half the risk; the size of the unanswered pile is the
// other half, and nothing watched it.
//
// No number is published, so this is a judgement call: 300 is well above what a
// healthy account accumulates (invites that are going to be accepted mostly are
// within a fortnight) and well below the pile that tools report trouble at.
// Hitting it means stop inviting and deal with the backlog — either the invites
// get accepted, or they should be withdrawn.
export const OUTSTANDING_INVITE_CAP = 300;

// ---- Hourly burst ceilings (rolling 60 minutes) ----
//
// The daily cap alone permits a very unhuman shape: 40 messages in four
// minutes is within budget and looks nothing like a person. These bound the
// RATE. Hitting one is not a problem — the lead is parked for the remainder of
// the hour and picked up after, so the campaign keeps running, just paced.
//
// Deliberately ~1/4 to 1/3 of the daily figure: enough that a normal day never
// touches them, tight enough that a stampede gets spread out.
export const HOURLY_CAPS: Record<string, number> = {
    'connect': 6,
    'send-message': 12,
    'like-nth-post': 15,
    'comment-nth-post': 8,
    'follow': 10,
    'profile-visit': 35,
    'profile-visit-voyager': 35,
};

// Ceiling on ALL governed actions combined in a rolling hour. Per-action caps
// can't see each other, so a flow doing visit+like+comment+connect per lead
// stays under every individual cap while still producing a burst of activity
// no person would generate. This is the backstop for total volume.
export const HOURLY_TOTAL_CAP = 60;

// Deterministic 80–100% of the nominal cap for this user/action/day.
//
// Waalaxy randomises each day's quota to 80–100% of the maximum so the ceiling
// isn't a flat repeating number — an account that stops at exactly 18 every
// single day is itself a pattern. DETERMINISTIC on (user, action, UTC day) on
// purpose: re-rolling per check would let the cap drift upward within a day and
// make "why did it stop at 15?" unanswerable after the fact.
function dailyJitterFraction(userId: string, actionType: string, dayKey: string): number {
    const seed = `${userId}|${actionType}|${dayKey}`;
    let h = 2166136261;                       // FNV-1a
    for (let i = 0; i < seed.length; i++) {
        h ^= seed.charCodeAt(i);
        h = Math.imul(h, 16777619);
    }
    return 0.8 + ((h >>> 0) % 2001) / 10000;  // 0.80 … 1.00
}

export function effectiveDailyCap(userId: string, actionType: GovernedAction, nominalOverride?: number): number {
    const nominal = nominalOverride ?? DAILY_CAPS[actionType];
    if (nominal == null) return Infinity;
    const dayKey = startOfTodayUTC().toISOString().slice(0, 10);
    // Floor, but never below 1 — a tiny cap must not round to zero actions.
    return Math.max(1, Math.floor(nominal * dailyJitterFraction(userId, actionType, dayKey)));
}

/**
 * Today's cap including the invite ramp. Invites are the only ramped action:
 * they're what LinkedIn restricts, and engagement actions don't carry the same
 * "new account behaving like a bot" signature.
 */
export async function rampedDailyCap(userId: string, actionType: GovernedAction): Promise<number> {
    const nominal = DAILY_CAPS[actionType];
    if (nominal == null) return Infinity;
    if (actionType !== 'connect') return effectiveDailyCap(userId, actionType);

    const ramp = await getRampState(userId).catch(() => null);
    // A failed ramp read must not silently unlock the full ceiling.
    const base = ramp ? Math.min(nominal, ramp.cap) : Math.min(nominal, 10);
    return effectiveDailyCap(userId, actionType, base);
}

function startOfTodayUTC(): Date {
    const d = new Date();
    return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

// Count today's SUCCESSFUL actions of the given type for this user.
// Failures don't consume the budget — a connect-button-missing failure
// shouldn't cost the user an invite slot.
export async function getDailyCount(userId: string, actionType: GovernedAction): Promise<number> {
    return prisma.actionLog.count({
        where: {
            userId,
            actionType,
            status: 'SUCCESS',
            executedAt: { gte: startOfTodayUTC() },
        },
    }).catch(() => 0);
}

function oneHourAgo(): Date {
    return new Date(Date.now() - 60 * 60 * 1000);
}

// Successful actions in the last rolling 60 minutes. Rolling, not clock-hour:
// a clock-hour bucket lets a campaign fire its whole allowance at 10:59 and the
// next allowance at 11:00, which is the burst we're trying to prevent.
export async function getHourlyCount(userId: string, actionType?: GovernedAction): Promise<number> {
    return prisma.actionLog.count({
        where: {
            userId,
            status: 'SUCCESS',
            executedAt: { gte: oneHourAgo() },
            ...(actionType ? { actionType } : { actionType: { in: Object.keys(HOURLY_CAPS) } }),
        },
    }).catch(() => 0);
}

export interface QuotaCheck {
    allowed: boolean;
    used: number;
    cap: number;
    remaining: number;
}

export async function checkQuota(userId: string, actionType: GovernedAction): Promise<QuotaCheck> {
    if (DAILY_CAPS[actionType] == null) {
        return { allowed: true, used: 0, cap: Infinity, remaining: Infinity };
    }
    const cap = await rampedDailyCap(userId, actionType);
    const used = await getDailyCount(userId, actionType);
    const remaining = Math.max(0, cap - used);
    return { allowed: used < cap, used, cap, remaining };
}

function sevenDaysAgo(): Date {
    return new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
}

// Successful actions in the last rolling 7 days. Rolling, not calendar-week:
// LinkedIn's restriction window slides, and a Monday reset would let an account
// spend its whole allowance Sunday night and again Monday morning.
export async function getWeeklyCount(userId: string, actionType: GovernedAction): Promise<number> {
    return prisma.actionLog.count({
        where: { userId, actionType, status: 'SUCCESS', executedAt: { gte: sevenDaysAgo() } },
    }).catch(() => 0);
}

export async function checkWeeklyQuota(userId: string, actionType: GovernedAction): Promise<QuotaCheck> {
    const cap = WEEKLY_CAPS[actionType];
    if (cap == null) return { allowed: true, used: 0, cap: Infinity, remaining: Infinity };
    const used = await getWeeklyCount(userId, actionType);
    return { allowed: used < cap, used, cap, remaining: Math.max(0, cap - used) };
}

export interface BurstCheck extends QuotaCheck {
    /** 'action' = this action type's own ceiling; 'total' = the combined one. */
    limit?: 'action' | 'total';
}

// Is this action within BOTH its own hourly ceiling and the combined one?
// Two counts, not one query per action type — cheap enough at this cadence and
// far clearer than trying to derive both from a single group-by.
export async function checkBurst(userId: string, actionType: GovernedAction): Promise<BurstCheck> {
    const cap = HOURLY_CAPS[actionType];
    if (cap == null) return { allowed: true, used: 0, cap: Infinity, remaining: Infinity };

    const [usedAction, usedTotal] = await Promise.all([
        getHourlyCount(userId, actionType),
        getHourlyCount(userId),
    ]);

    if (usedAction >= cap) {
        return { allowed: false, used: usedAction, cap, remaining: 0, limit: 'action' };
    }
    if (usedTotal >= HOURLY_TOTAL_CAP) {
        return { allowed: false, used: usedTotal, cap: HOURLY_TOTAL_CAP, remaining: 0, limit: 'total' };
    }
    return { allowed: true, used: usedAction, cap, remaining: cap - usedAction };
}

// Short pause for a burst ceiling — NOT the next-day deferral a daily cap
// gets. The point is to keep the campaign running at a human pace, so wait out
// the rest of the hour (plus jitter so every capped user doesn't resume on the
// same minute) and continue today.
export function nextHourRetryAt(): Date {
    const base = 20 * 60 * 1000;                                  // 20 min
    const jitter = Math.floor(Math.random() * 25 * 60 * 1000);    // + 0–25 min
    return new Date(Date.now() + base + jitter);
}

// ---- Monthly INVITE entitlement (Qampi subscription tier) ----
//
// Distinct from the DAILY_CAPS above (which are LinkedIn ACCOUNT-SAFETY ceilings,
// flat across tiers) and from the search budget below (LinkedIn's own limit).
// This is the *product* lever: how many connection invites a paid tier grants
// per calendar month (Free 80 / Core 300 / Pro & Business 500) — sourced from
// config/plans (the single source of truth).
//
// GATED BY ENFORCE_TIER_QUOTAS: until billing exists to assign a paid tier,
// every real user is FREE by default, so hard-enforcing would throttle live/
// test accounts to 80/mo. The flag stays OFF in prod until billing lands; with
// it off, checkInviteQuota always allows (the daily safety cap still applies).
export function tierQuotasEnforced(): boolean {
    return process.env.ENFORCE_TIER_QUOTAS === '1';
}

// Count this calendar month's successful connect invites for the user.
export async function getMonthlyInviteCount(userId: string): Promise<number> {
    return prisma.actionLog.count({
        where: {
            userId,
            actionType: 'connect',
            status: 'SUCCESS',
            executedAt: { gte: startOfMonthUTC() },
        },
    }).catch(() => 0);
}

// Is the user within their tier's monthly invite entitlement? Returns allowed
// unconditionally when the enforcement flag is off, so current behaviour is
// unchanged until billing + the flag are switched on together.
export async function checkInviteQuota(userId: string): Promise<QuotaCheck> {
    if (!tierQuotasEnforced()) {
        return { allowed: true, used: 0, cap: Infinity, remaining: Infinity };
    }
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { tier: true } }).catch(() => null);
    const cap = planFor(user?.tier).monthlyInvites;
    const used = await getMonthlyInviteCount(userId);
    const remaining = Math.max(0, cap - used);
    return { allowed: used < cap, used, cap, remaining };
}

// ---- Feature gates (subscription tier) ----
// Boolean plan features (crmSync / multichannel / team). Flag-gated like the
// invite entitlement: returns allowed when ENFORCE_TIER_QUOTAS is off, so
// current behaviour is unchanged until billing assigns paid tiers.
export async function featureAllowed(userId: string, feature: keyof PlanFeatures): Promise<boolean> {
    if (!tierQuotasEnforced()) return true;
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { tier: true } }).catch(() => null);
    return tierAllows(user?.tier, feature);
}

// ---- Email-finder credit budget (subscription tier) ----
// Real marginal cost (the finder box), so it's a hard cap — but still gated by
// ENFORCE_TIER_QUOTAS. Paid tiers refill monthly; Free is a one-time grant
// (counted all-time). One credit = one finder LOOKUP (logEmailFinderAction).
export async function getEmailFinderCount(userId: string, sinceMonth: boolean): Promise<number> {
    return prisma.actionLog.count({
        where: {
            userId,
            actionType: 'email-finder',
            status: 'SUCCESS',
            ...(sinceMonth ? { executedAt: { gte: startOfMonthUTC() } } : {}),
        },
    }).catch(() => 0);
}

export async function checkEmailFinderQuota(userId: string): Promise<QuotaCheck> {
    if (!tierQuotasEnforced()) return { allowed: true, used: 0, cap: Infinity, remaining: Infinity };
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { tier: true } }).catch(() => null);
    const plan = planFor(user?.tier);
    const cap = plan.emailFinderCredits;
    const used = await getEmailFinderCount(userId, plan.emailFinderRecurring);
    const remaining = Math.max(0, cap - used);
    return { allowed: used < cap, used, cap, remaining };
}

// Record one consumed finder lookup against the budget. Best-effort.
export async function logEmailFinderAction(userId: string): Promise<void> {
    await prisma.actionLog.create({
        data: { userId, actionType: 'email-finder', status: 'SUCCESS' },
    }).catch(() => {});
}

// ---- Monthly people-search budget (LinkedIn Commercial Use Limit) ----
//
// LinkedIn caps SEARCHES per calendar month, not per day: free accounts get a
// ~300-searches/month "Commercial Use Limit", and hitting it locks all search
// until the 1st of the next month. We enforce a budget with a safety buffer
// below that cliff so a copilot session never trips it. LinkedIn Premium
// relaxes the limit substantially (we grant a much higher ceiling but still
// cap it to bound runaway usage). This is deliberately SEPARATE from DAILY_CAPS
// (which govern write actions) and from the ~500/day profile-view limit (which
// affects visit nodes, not search).
export const MONTHLY_SEARCH_CAP_FREE = 280;
export const MONTHLY_SEARCH_CAP_PREMIUM = 900;
export const SEARCH_ACTION_TYPE = 'people-search';

function startOfMonthUTC(): Date {
    const d = new Date();
    return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1));
}

// Count this calendar month's successful people-searches for the user.
export async function getMonthlySearchCount(userId: string): Promise<number> {
    return prisma.actionLog.count({
        where: {
            userId,
            actionType: SEARCH_ACTION_TYPE,
            status: 'SUCCESS',
            executedAt: { gte: startOfMonthUTC() },
        },
    }).catch(() => 0);
}

export interface SearchQuotaCheck {
    allowed: boolean;
    used: number;
    cap: number;
    remaining: number;
    isPremium: boolean;
}

// Premium is a LINKEDIN concept here (it's LinkedIn's limit being relaxed), so
// key off linkedinPlan / the self-enriched selfPremium flag — NOT Qampi's own
// subscription tier. Uses the standalone model delegates (prod-safe casing;
// see memory project_prisma_casing_drift) rather than a User relation include.
export async function checkSearchQuota(userId: string): Promise<SearchQuotaCheck> {
    const [user, bp] = await Promise.all([
        prisma.user.findUnique({ where: { id: userId }, select: { linkedinPlan: true } }).catch(() => null),
        prisma.businessProfile.findUnique({ where: { userId }, select: { selfPremium: true } }).catch(() => null),
    ]);
    const isPremium = user?.linkedinPlan === 'PREMIUM' || bp?.selfPremium === true;
    const cap = isPremium ? MONTHLY_SEARCH_CAP_PREMIUM : MONTHLY_SEARCH_CAP_FREE;
    const used = await getMonthlySearchCount(userId);
    const remaining = Math.max(0, cap - used);
    return { allowed: used < cap, used, cap, remaining, isPremium };
}

// Record a successful people-search against the monthly budget. Best-effort —
// a failed write shouldn't fail the search the user already got results for.
export async function logSearchAction(userId: string): Promise<void> {
    await prisma.actionLog.create({
        data: { userId, actionType: SEARCH_ACTION_TYPE, status: 'SUCCESS' },
    }).catch(() => {});
}

// Working-hours window. LinkedIn's behavioural model flags accounts that
// are active at 3am local — no human messages on LinkedIn in their sleep.
// We constrain campaign activity to a human-shaped daypart.
//
// TZ is hard-pinned to Asia/Kolkata to match the Playwright context locale
// already set in engine.ts (so behavioural fingerprint + activity hours are
// consistent). Asia/Kolkata has no DST, so a fixed +5:30 offset is correct
// year-round and avoids pulling a tz library.
//
// Window: 09:00–18:00 IST. Outside the window, leads are rescheduled to
// the next window open + jitter rather than processed.
const TZ_OFFSET_MIN = 5 * 60 + 30; // IST = UTC+05:30
// Window opened to 24h. Was 09–18 IST — a LinkedIn-safety heuristic — but
// product decision: users in different timezones (and the AI message cadence
// itself, which already paces ~30–120s between actions) make a hard daypart
// gate the wrong shape. If we ever re-add daypart, do it as a per-user
// preference, not a global constant.
const WINDOW_OPEN_HOUR = 0;
const WINDOW_CLOSE_HOUR = 24;

function nowInTZ(): Date {
    return new Date(Date.now() + TZ_OFFSET_MIN * 60 * 1000);
}

export function isWithinWorkingHours(): boolean {
    // Test/ops escape hatch: prod smoke tests and on-call retries need to
    // bypass the daypart gate without faking the system clock. Keep the
    // env name explicit so accidental sets don't slip through.
    if (process.env.QAMPI_DISABLE_WORKING_HOURS === '1') return true;
    const h = nowInTZ().getUTCHours(); // hours-in-IST (we shifted the clock)
    return h >= WINDOW_OPEN_HOUR && h < WINDOW_CLOSE_HOUR;
}

// Next 09:00 IST as a UTC Date, plus 0–30min jitter so concurrent users
// don't all wake up on the exact same minute.
export function nextWorkingHourAt(): Date {
    const ist = nowInTZ();
    const istHour = ist.getUTCHours();
    const target = new Date(ist);
    if (istHour < WINDOW_OPEN_HOUR) {
        // Same IST day, just wait until 09:00.
        target.setUTCHours(WINDOW_OPEN_HOUR, 0, 0, 0);
    } else {
        // After window close — roll to next IST day at 09:00.
        target.setUTCDate(target.getUTCDate() + 1);
        target.setUTCHours(WINDOW_OPEN_HOUR, 0, 0, 0);
    }
    // target is "IST clock value" expressed as UTC components — shift back
    // to real UTC by undoing the offset.
    const utcMs = target.getTime() - TZ_OFFSET_MIN * 60 * 1000;
    const jitterMs = Math.floor(Math.random() * 30 * 60 * 1000);
    return new Date(utcMs + jitterMs);
}

// When a lead's next step is blocked by a daily cap, push its next retry
// to tomorrow's working window. 09:00 UTC is roughly mid-morning across
// EU/IN/US-east; the 0–180min jitter prevents a thundering-herd of campaigns
// all firing on the same minute when caps reset.
export function nextDayRetryAt(): Date {
    const now = new Date();
    const tomorrowUTC = new Date(Date.UTC(
        now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1,
        9, 0, 0, 0
    ));
    const jitterMs = Math.floor(Math.random() * 180 * 60 * 1000);
    return new Date(tomorrowUTC.getTime() + jitterMs);
}
