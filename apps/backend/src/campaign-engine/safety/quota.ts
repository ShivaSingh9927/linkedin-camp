import { prisma } from '@repo/db';

// Per-user daily caps on LinkedIn write actions.
//
// LinkedIn enforces server-side rate limits on the account, not the campaign,
// so caps must be applied per User across all of their campaigns.
//
// Values err well below LinkedIn's known cliffs (invites: anecdotal ~100/wk
// before warning, ~80/wk safer; messages to 1st-degree: ~100/day theoretical,
// ~40/day safer). Tighten further if account-warning telemetry ever fires.
export const DAILY_CAPS: Record<string, number> = {
    'connect': 18,
    'send-message': 40,
};

export type GovernedAction = keyof typeof DAILY_CAPS;

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

export interface QuotaCheck {
    allowed: boolean;
    used: number;
    cap: number;
    remaining: number;
}

export async function checkQuota(userId: string, actionType: GovernedAction): Promise<QuotaCheck> {
    const cap = DAILY_CAPS[actionType];
    if (cap == null) {
        return { allowed: true, used: 0, cap: Infinity, remaining: Infinity };
    }
    const used = await getDailyCount(userId, actionType);
    const remaining = Math.max(0, cap - used);
    return { allowed: used < cap, used, cap, remaining };
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
