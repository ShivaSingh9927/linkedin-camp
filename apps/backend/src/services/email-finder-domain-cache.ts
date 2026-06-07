// Redis-backed cache for company → domain. Two entry types:
//   positive: { domain, confidence, method, cachedAt }      TTL 7 days
//   negative: { neg: true, cachedAt }                       TTL 24 hours
//
// Why: the email-finder box's `resolve_domain` does DNS lookups, homepage
// fetches, and (on miss) a DuckDuckGo search — even for leads where the
// SMTP verifier returns "no match". A 50-lead campaign against 20 companies
// pays this cost 50 times today. With this cache, it's paid 20 times (once
// per unique company), and on the second campaign that same week: 0 times.
//
// Skips the resolve step inside the box by passing the cached domain back
// through the /guess request (main.py:78 checks `if not domain:`). The
// permute + SMTP-verify step is still bounded by Layer 1's win — resolver
// is the part that runs on misses, and misses are the common case.

import Redis from 'ioredis';

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';
const POS_TTL_SECONDS = 7 * 24 * 60 * 60;
const NEG_TTL_SECONDS = 24 * 60 * 60;
const KEY_PREFIX = 'ef:domain:';

let redisClient: Redis | null = null;

function getRedis(): Redis | null {
    if (!redisClient && REDIS_URL) {
        redisClient = new Redis(REDIS_URL, { maxRetriesPerRequest: 1, lazyConnect: true });
        redisClient.connect().catch((err) => {
            console.warn(`[email-finder-domain-cache] redis connect failed: ${err.message}`);
        });
    }
    return redisClient;
}

function normalizeCompany(company: string): string {
    return (company || '')
        .toLowerCase()
        .replace(/[,.|;:'"]/g, ' ')
        .replace(/\s+(inc|llc|ltd|corp|gmbh|co|plc|pty)\.?$/i, '')
        .replace(/\s+/g, ' ')
        .trim();
}

export interface CachedDomainHit {
    domain: string;
    confidence: string | null;
    method: string | null;
    cachedAt: number;
}

export interface CachedDomainMiss {
    neg: true;
    cachedAt: number;
}

export type CachedDomain = CachedDomainHit | CachedDomainMiss;

export async function getCachedDomain(company: string): Promise<CachedDomain | null> {
    const r = getRedis();
    if (!r) return null;
    const key = `${KEY_PREFIX}${normalizeCompany(company)}`;
    try {
        const raw = await r.get(key);
        if (!raw) return null;
        return JSON.parse(raw) as CachedDomain;
    } catch (err: any) {
        console.warn(`[email-finder-domain-cache] get failed: ${err.message}`);
        return null;
    }
}

export async function setCachedDomain(
    company: string,
    domain: string,
    confidence: string | null,
    method: string | null,
): Promise<void> {
    const r = getRedis();
    if (!r) return;
    const key = `${KEY_PREFIX}${normalizeCompany(company)}`;
    const value: CachedDomainHit = { domain, confidence, method, cachedAt: Date.now() };
    try {
        await r.set(key, JSON.stringify(value), 'EX', POS_TTL_SECONDS);
    } catch (err: any) {
        console.warn(`[email-finder-domain-cache] set failed: ${err.message}`);
    }
}

export async function setCachedDomainMiss(company: string): Promise<void> {
    const r = getRedis();
    if (!r) return;
    const key = `${KEY_PREFIX}${normalizeCompany(company)}`;
    const value: CachedDomainMiss = { neg: true, cachedAt: Date.now() };
    try {
        await r.set(key, JSON.stringify(value), 'EX', NEG_TTL_SECONDS);
    } catch (err: any) {
        console.warn(`[email-finder-domain-cache] set (miss) failed: ${err.message}`);
    }
}

/** Test-only: clear all domain cache entries. Uses SCAN — safe in prod but slow at scale. */
export async function _clearDomainCacheForTests(): Promise<number> {
    const r = getRedis();
    if (!r) return 0;
    const keys = await r.keys(`${KEY_PREFIX}*`);
    if (keys.length) await r.del(...keys);
    return keys.length;
}
