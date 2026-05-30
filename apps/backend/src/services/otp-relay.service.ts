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
