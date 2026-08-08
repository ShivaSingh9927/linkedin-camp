import Redis from 'ioredis';
import crypto from 'crypto';

// Redis-backed OTP relay. The login worker blocks on `BLPOP otp:<userId>:<requestId>`
// (waiting up to N seconds for the user to paste the code in the web UI),
// while the API route `POST /session/otp` does `LPUSH otp:<userId>:<requestId>`
// to wake it up. List-with-blocking is the simplest correct primitive here —
// pub/sub doesn't survive process restarts of the subscriber, and a list
// keeps the message until consumed.
//
// Multiple processes (engine worker, recovery worker) call this; they each
// own their own ioredis client because BLPOP holds the connection until the
// list is non-empty.

const OTP_KEY = (userId: string, requestId: string) => `otp:${userId}:${requestId}`;
const DEFAULT_TIMEOUT_SEC = 600; // 10 min — covers a user fetching the OTP from email

let _client: Redis | null = null;
function getRedis(): Redis {
    if (_client) return _client;
    const url = process.env.REDIS_URL;
    if (!url) throw new Error('REDIS_URL not configured');
    _client = new Redis(url, { maxRetriesPerRequest: null });
    return _client;
}

export function newRequestId(): string {
    return crypto.randomBytes(8).toString('hex');
}

/**
 * Resolver factory — call once per login attempt to get a function the login
 * service can `await` per OTP-attempt. The resolver blocks on the Redis
 * list until POST /session/otp pushes a code (or the timeout fires).
 *
 * The same key is reused across attempts within a single login flow — the
 * UI submits multiple codes if the first is rejected; we drain one at a time.
 */
export function redisOtpResolver(
    userId: string,
    requestId: string,
    timeoutSec: number = DEFAULT_TIMEOUT_SEC,
): (attempt: number) => Promise<string> {
    const r = getRedis();
    const key = OTP_KEY(userId, requestId);

    return async (attempt: number) => {
        console.log(`[otp-relay] BLPOP ${key} (attempt ${attempt}, timeout ${timeoutSec}s)`);
        const popped = await r.blpop(key, timeoutSec);
        if (!popped) {
            console.warn(`[otp-relay] BLPOP timed out for ${key}`);
            return '';
        }
        const code = (popped[1] || '').trim();
        console.log(`[otp-relay] received code for ${key} (len=${code.length})`);
        return code;
    };
}

/**
 * Submit an OTP code from the web UI side. Wakes up whichever login worker
 * is BLPOPing on this key. TTL keeps stale codes from accumulating if no
 * worker is listening (e.g. the login attempt died).
 */
export async function submitOtp(userId: string, requestId: string, code: string): Promise<void> {
    const r = getRedis();
    const key = OTP_KEY(userId, requestId);
    await r.rpush(key, code);
    await r.expire(key, 60); // codes are valid for ~5 min on LinkedIn's side anyway
    console.log(`[otp-relay] enqueued code for ${key}`);
}

// ---- One login attempt per account ----
//
// POST /session/refresh used to spawn a fresh headless LinkedIn login on EVERY
// call, with no check for one already running. In a mobile in-app browser the
// OTP submit fails with a network error, the user naturally hits retry, and each
// retry started another concurrent login for the same account — each triggering
// its own LinkedIn code. The codes cross, none of them work, and LinkedIn
// degrades the account for rapid repeat logins (this is what took Saloni's
// session from valid back to NEEDS_LOGIN).
//
// Redis rather than an in-process Map so the guard survives an API restart and
// still holds if the API is ever scaled past one container. The TTL is the
// safety valve: if the process dies mid-login the slot frees itself instead of
// locking the user out forever.
const REFRESH_SLOT_KEY = (userId: string) => `linkedin-refresh:${userId}`;

/**
 * Try to claim the single refresh slot for this account.
 *
 * Returns `{ claimed: true }` when this attempt owns the slot, or
 * `{ claimed: false, existingRequestId }` when a login is already in flight —
 * in which case the caller should hand the CALLER BACK the in-flight requestId
 * rather than erroring. That way a user mashing retry simply re-attaches to the
 * attempt already running, and the code they type reaches the worker waiting
 * for it.
 */
export async function claimRefreshSlot(
    userId: string,
    requestId: string,
    ttlSeconds = 240,
): Promise<{ claimed: true } | { claimed: false; existingRequestId: string | null }> {
    const r = getRedis();
    const key = REFRESH_SLOT_KEY(userId);
    const ok = await r.set(key, requestId, 'EX', ttlSeconds, 'NX');
    if (ok) return { claimed: true };
    // Lost the race — report who holds it. It may have expired in the gap, in
    // which case existingRequestId is null and the caller retries the claim.
    const existing = await r.get(key);
    return { claimed: false, existingRequestId: existing };
}

/**
 * Release the slot, but ONLY if this requestId still owns it. Compare-and-delete
 * so a slow finishing attempt can't free a slot that has since been re-claimed
 * by a newer one after the TTL lapsed.
 */
export async function releaseRefreshSlot(userId: string, requestId: string): Promise<void> {
    const r = getRedis();
    const lua = `if redis.call('get', KEYS[1]) == ARGV[1] then return redis.call('del', KEYS[1]) else return 0 end`;
    await r.eval(lua, 1, REFRESH_SLOT_KEY(userId), requestId).catch(() => {});
}
