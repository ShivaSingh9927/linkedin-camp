// Email-finder box health guard.
//
// One probe per process per 60s. The first EMAIL_FINDER call inside a 60s
// window does a GET /health against the Kamatera box and caches the result.
// Subsequent calls reuse the cache. On probe failure the cache is set to
// 'down' and the next call also sees 'down' without re-probing. On the next
// 60s boundary, the cache is stale and a fresh probe runs.
//
// State is process-local (the campaign worker is a single process). If we
// ever scale to multiple workers, swap the Map for a Redis-backed impl with
// the same API — no caller change required.

import axios from 'axios';

const EMAIL_FINDER_URL = process.env.EMAIL_FINDER_URL || '';
const PROBE_TTL_MS = 60_000;
const PROBE_TIMEOUT_MS = 3_000;

export type EmailFinderHealth = 'unknown' | 'healthy' | 'degraded' | 'down';

interface CacheEntry {
    state: EmailFinderHealth;
    expiresAt: number;
    lastError?: string;
    lastCheckedAt: number;
}

let cache: CacheEntry | null = null;

async function probe(): Promise<{ ok: boolean; error?: string }> {
    if (!EMAIL_FINDER_URL) return { ok: false, error: 'EMAIL_FINDER_URL not set' };
    try {
        const { status } = await axios.get(`${EMAIL_FINDER_URL}/health`, {
            timeout: PROBE_TIMEOUT_MS,
            validateStatus: (s) => s >= 200 && s < 300,
        });
        return { ok: status === 200, error: status === 200 ? undefined : `http ${status}` };
    } catch (err: any) {
        return { ok: false, error: err?.message || 'probe failed' };
    }
}

/**
 * Returns the current health, probing lazily when the cache is stale.
 * Always returns 'down' (never 'unknown') when EMAIL_FINDER_URL is unset,
 * so the guard path is consistent with the env-var short-circuit.
 */
export async function getEmailFinderHealth(): Promise<EmailFinderHealth> {
    const now = Date.now();
    if (cache && cache.expiresAt > now) return cache.state;

    const result = await probe();
    const state: EmailFinderHealth = result.ok ? 'healthy' : 'down';
    cache = {
        state,
        expiresAt: now + PROBE_TTL_MS,
        lastError: result.error,
        lastCheckedAt: now,
    };
    if (!result.ok) {
        console.warn(`[email-finder-health] probe failed: ${result.error} — marking down for 60s`);
    } else if (process.env.EMAIL_FINDER_DIAG === '1') {
        console.log(`[email-finder-health] probe ok — healthy for 60s`);
    }
    return state;
}

/**
 * Mark the box down on a transport failure. Resets the TTL so the next call
 * inside the 60s window reuses 'down' without re-probing. After 60s a fresh
 * probe runs and a recovered box self-heals.
 */
export function markEmailFinderDown(error: string): void {
    const now = Date.now();
    const wasHealthy = cache?.state === 'healthy';
    cache = {
        state: 'down',
        expiresAt: now + PROBE_TTL_MS,
        lastError: error,
        lastCheckedAt: now,
    };
    if (wasHealthy) {
        console.warn(`[email-finder-health] transition healthy → down: ${error}`);
    }
}

/** Test-only: clear the cache so a probe runs on the next call. */
export function _resetEmailFinderHealthForTests(): void {
    cache = null;
}
