/**
 * Minimum spacing between LinkedIn actions OF THE SAME TYPE.
 *
 * Caps bound how much an account does; this bounds how fast. They are different
 * defences and neither substitutes for the other: 18 invites is a fine day's
 * work and a terrible minute's work.
 *
 * Intervals are Waalaxy's published queue delays — invitations and messages
 * 2m30, profile visits and follows 1m — which is the most credible public
 * number available, coming from a tool that has run this at scale for years.
 * They add a 20% random variable; so do we, because a perfectly regular
 * interval is itself the pattern being hidden.
 *
 * Scope is the PROCESS, keyed by user+action. That matches how campaigns run:
 * a per-account lock means one campaign touches an account at a time, so an
 * in-memory clock is accurate without a Redis round-trip per action. On a
 * worker restart the map is empty and the first action of each type goes
 * immediately — acceptable, since a restart is itself a pause.
 */

const MIN_GAP_MS: Record<string, number> = {
    'connect': 150_000,          // 2m30
    'send-message': 150_000,     // 2m30
    'profile-visit': 60_000,
    'profile-visit-voyager': 60_000,
    'follow': 60_000,
    'like-nth-post': 60_000,
    'comment-nth-post': 60_000,
};

const JITTER = 0.2;

const lastActionAt = new Map<string, number>();

const wait = (ms: number) => new Promise(res => setTimeout(res, ms));

/** Testing seam: forget all pacing history. */
export function resetPacing(): void {
    lastActionAt.clear();
}

/**
 * How long this action must still wait, in ms (0 = go now). Exported so the
 * behaviour is testable without actually sleeping for two and a half minutes.
 */
export function pacingDebtMs(userId: string, actionType: string, now = Date.now()): number {
    const gap = MIN_GAP_MS[actionType];
    if (!gap) return 0;
    const last = lastActionAt.get(`${userId}|${actionType}`);
    if (last == null) return 0;
    const jittered = gap * (1 + (Math.random() * 2 - 1) * JITTER);   // ±20%
    return Math.max(0, Math.round(last + jittered - now));
}

/** Record that the action just happened, starting its cooldown. */
export function markActionAt(userId: string, actionType: string, at = Date.now()): void {
    if (MIN_GAP_MS[actionType]) lastActionAt.set(`${userId}|${actionType}`, at);
}

/**
 * Sleep out any remaining cooldown for this action type, then return. Call
 * immediately BEFORE the action; call markActionAt after it succeeds.
 */
export async function paceAction(userId: string, actionType: string): Promise<number> {
    const debt = pacingDebtMs(userId, actionType);
    if (debt > 0) {
        console.log(`[PACING] ${actionType}: waiting ${Math.round(debt / 1000)}s to keep a human interval.`);
        await wait(debt);
    }
    return debt;
}
