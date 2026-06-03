import Redis from 'ioredis';

/**
 * Ephemeral CSRF-state store for OAuth handshakes. The `state` param sent
 * in the authorize URL must come back unchanged in the callback; we map
 * it to the userId that initiated the flow so the callback knows where
 * to store the refresh token. TTL is short (10 min) — handshakes that
 * stall longer than that fail closed.
 *
 * Redis-backed so the API replicas can all see the same state during
 * the redirect roundtrip.
 */
const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';
const redis = new Redis(REDIS_URL, { maxRetriesPerRequest: null });

const PREFIX = 'oauth_state:';
const TTL_SEC = 600;

export interface OAuthState {
    userId: string;
    provider: 'google' | 'microsoft';
    /** Where to redirect the browser after callback completes. */
    returnTo?: string;
}

export async function putState(state: string, value: OAuthState): Promise<void> {
    await redis.set(PREFIX + state, JSON.stringify(value), 'EX', TTL_SEC);
}

export async function takeState(state: string): Promise<OAuthState | null> {
    const raw = await redis.get(PREFIX + state);
    if (!raw) return null;
    // Use-once semantics: delete after read so a replayed callback fails.
    await redis.del(PREFIX + state);
    try { return JSON.parse(raw); } catch { return null; }
}
