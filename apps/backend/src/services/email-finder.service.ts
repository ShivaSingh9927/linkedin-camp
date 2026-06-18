import axios from 'axios';
import { markEmailFinderDown } from './email-finder-health';
import { getCachedDomain, setCachedDomain, setCachedDomainMiss } from './email-finder-domain-cache';
import type { FindEmailInput, FindEmailResult } from './email-finder.types';

export type { FindEmailInput, FindEmailResult } from './email-finder.types';

// The self-hosted email-finder box (Kamatera, open port 25). Resolves a
// company name -> domain, guesses permutations, and SMTP-verifies them.
// Firewalled to this backend's IP; auth via X-API-Key.
const EMAIL_FINDER_URL = process.env.EMAIL_FINDER_URL || 'http://localhost:8002';
const EMAIL_FINDER_TOKEN = process.env.EMAIL_FINDER_TOKEN || '';

// Concurrency cap for the slow /guess call. Each lookup can block up to 90s
// (SMTP verification) while holding one of the worker's 24 campaign slots, so
// without a cap an email-heavy burst would starve fast LinkedIn actions AND
// fan out too many concurrent SMTP probes from one IP (greylisting risk). We
// keep it small so LinkedIn actions always have >=~20 of the 24 slots; tune via
// EMAIL_FINDER_CONCURRENCY once the box's real /guess capacity is known.
const EMAIL_FINDER_CONCURRENCY = parseInt(process.env.EMAIL_FINDER_CONCURRENCY || '4', 10);

class Semaphore {
    private permits: number;
    private waiters: Array<() => void> = [];
    constructor(n: number) { this.permits = n; }
    async acquire(): Promise<void> {
        if (this.permits > 0) { this.permits--; return; }
        await new Promise<void>(resolve => this.waiters.push(resolve));
    }
    release(): void {
        const next = this.waiters.shift();
        if (next) next();
        else this.permits++;
    }
}
const emailFinderSemaphore = new Semaphore(EMAIL_FINDER_CONCURRENCY);

/**
 * Ask the email-finder to find an address for a person. Returns null on any
 * transport/config error (caller treats "no email" as a soft skip, never a
 * hard failure). The service itself decides verified/unverified — the caller
 * gates on `verified` before trusting the address for sending.
 *
 * Domain cache (Layer 1): when the caller doesn't pass a domain, the
 * Redis-backed domain cache short-circuits the resolve step on subsequent
 * calls for the same company. The box still does permute + SMTP verify on
 * each call, but the (often-slow) resolve step runs at most once per
 * company per 7 days.
 */
export async function findEmail(input: FindEmailInput): Promise<FindEmailResult | null> {
    if (!EMAIL_FINDER_TOKEN) {
        console.warn('[email-finder] EMAIL_FINDER_TOKEN not set — skipping lookup');
        return null;
    }
    if (!input.firstName || !input.lastName || !input.company) return null;

    // ── LAYER 1: domain cache ────────────────────────────────────────────
    // If the caller didn't pass a domain, ask the cache. A miss here means
    // we've never seen this company OR it was a negative cache hit.
    let domain = input.domain || null;
    let usedCache = false;
    if (!domain) {
        const cached = await getCachedDomain(input.company);
        if (cached && 'neg' in cached) {
            console.log(`[email-finder] domain cache miss for "${input.company}" — skipping`);
            return null;
        }
        if (cached && 'domain' in cached) {
            domain = cached.domain;
            usedCache = true;
            console.log(`[email-finder] domain cache hit: ${input.company} → ${domain}`);
        }
    }

    // Cap concurrent /guess calls so email-finder never monopolises worker slots.
    await emailFinderSemaphore.acquire();
    try {
        const { data } = await axios.post(
            `${EMAIL_FINDER_URL}/email-finder/guess`,
            {
                firstName: input.firstName,
                lastName: input.lastName,
                company: input.company,
                jobTitle: input.jobTitle,
                ...(domain ? { domain } : {}),
            },
            {
                headers: { 'X-API-Key': EMAIL_FINDER_TOKEN, 'Content-Type': 'application/json' },
                // 90s ceiling — sits above the box's own 60s hard deadline
                // (EMAIL_FINDER_GUESS_DEADLINE) plus the Hunter.io fallback, so
                // the box always returns first; still bounded so one bad lead
                // can't stall a campaign indefinitely.
                timeout: 90_000,
                // 5xx falls into the catch and marks the box down.
                validateStatus: (s) => s >= 200 && s < 300,
            }
        );
        const result: FindEmailResult = {
            email: data?.email ?? null,
            verified: !!data?.verified,
            confidence: data?.confidence ?? null,
            isCatchAll: !!data?.is_catch_all,
            source: data?.source ?? null,
            domain: data?.domain ?? null,
            domainConfidence: data?.domain_confidence ?? null,
        };
        // ── LAYER 1: write-through ───────────────────────────────────────
        // If we didn't have a domain in cache and the box resolved one,
        // store it for next time. Don't overwrite a positive entry on a
        // weaker result.
        if (!usedCache && result.domain) {
            await setCachedDomain(input.company, result.domain, result.domainConfidence, null);
        }
        if (!usedCache && !result.domain && data?.domain_confidence == null) {
            await setCachedDomainMiss(input.company);
        }
        return result;
    } catch (err: any) {
        console.error(`[email-finder] lookup failed: ${err?.message}`);
        markEmailFinderDown(err?.message || 'unknown');
        return null;
    } finally {
        emailFinderSemaphore.release();
    }
}
