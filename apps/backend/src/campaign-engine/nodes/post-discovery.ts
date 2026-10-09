/**
 * Shared post-URN discovery for the like/comment nodes.
 *
 * Both engagement nodes need the same thing: the permalink of a target
 * profile's Nth recent post. That discovery used to be copy-pasted verbatim
 * into both handlers, so selector rot had to be fixed in two places and the
 * two copies could (and did) drift. This is the single source of truth.
 *
 * Discovery is DOM-based on purpose. LinkedIn's guest *profile* page is
 * 999-walled, so a login-free listing is impossible, and the private Voyager
 * `ProfileUpdates` queryId rotates and 404s (see capture-recent-posts.ts).
 * Since like/comment are already DOM writes that must load the post page
 * anyway, scraping the logged-in `/recent-activity/shares/` feed is the
 * robust path — no unverified API dependency.
 *
 * Hardening over the old inline version:
 *   - dedupes by URN value, so nested/repeated `data-urn` wrappers can no
 *     longer make "post #2" silently resolve to a duplicate of post #1;
 *   - merges the anchor-href fallback into the SAME ordered/deduped list
 *     rather than treating it as a separate index space;
 *   - emits a one-line canary so a discovery miss is visible in logs
 *     (0 posts vs. requested index out of range) instead of a bare null.
 */

const wait = (ms: number) => new Promise((res) => setTimeout(res, ms));
const randomRange = (min: number, max: number) => Math.floor(Math.random() * (max - min + 1) + min);

async function safeGoto(page: any, url: string, retries = 3) {
    for (let i = 0; i < retries; i++) {
        try {
            await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
            return true;
        } catch (err: any) {
            if (i === retries - 1) throw err;
            await wait(3000);
        }
    }
}

/**
 * Browser-context extractor: returns the target profile's post URNs in feed
 * order (deduped) and the one at `targetNum` (1-based). Defined at module top
 * level and self-contained (references only `document` + its arg) so it is
 * both serialisable into `page.evaluate` AND directly exercisable by the
 * verify script against a fixture page — one implementation, no drift.
 */
export function extractOrderedPostUrns(targetNum: number): { count: number; urn: string | null; urns: string[] } {
    const targetIndex = targetNum - 1;
    const seen = new Set<string>();
    const urns: string[] = [];

    // Primary: the post-wrapper divs, in document (top-to-bottom) order.
    // Dedupe by URN value — a single post can carry the same data-urn on
    // several nested elements, and counting those as separate posts is
    // exactly what made the old index drift.
    const wrappers = document.querySelectorAll(
        'div[data-urn*="urn:li:activity"], div[data-urn*="urn:li:ugcPost"], div[data-urn*="urn:li:share"]',
    );
    wrappers.forEach((el) => {
        const urn = el.getAttribute('data-urn') || '';
        if (urn && !seen.has(urn)) {
            seen.add(urn);
            urns.push(urn);
        }
    });

    // Fallback: permalink anchors, merged into the SAME list so the index
    // space stays consistent whether or not wrappers were found.
    const anchors = document.querySelectorAll('a[href*="/feed/update/urn:li:"]');
    anchors.forEach((a) => {
        const href = (a as HTMLAnchorElement).href;
        if (href.includes('?commentUrn=')) return; // that's a comment permalink, not the post
        const m = href.match(/\/feed\/update\/(urn:li:[^/?]+)/);
        if (m && m[1] && !seen.has(m[1])) {
            seen.add(m[1]);
            urns.push(m[1]);
        }
    });

    return { count: urns.length, urn: urns[targetIndex] || null, urns };
}

/**
 * Choose the post to engage with, given the feed in order and the posts this
 * campaign has already liked/commented on for this lead.
 *
 * Position alone is not stable: "post #2" is a different post once the lead
 * publishes something new, and a ladder that trusted it commented on the same
 * post twice, three days apart (2026-10-09). So once anything has been
 * engaged, take the newest post NOT yet engaged — round k of a ladder still
 * lands on post #k when nothing new was posted, and on the new post when
 * something was. Before any engagement, the requested position applies.
 *
 * Returns null when every post on the feed has already been engaged.
 */
export function pickPost(urns: string[], n: number, engaged: string[]): string | null {
    if (!engaged.length) return urns[n - 1] || null;
    const done = new Set(engaged);
    return urns.find((u) => !done.has(u)) || null;
}

export interface DiscoveredPost {
    /** Canonical permalink: https://www.linkedin.com/feed/update/<urn>/ */
    url: string;
    /** The bare activity/ugcPost/share URN. */
    urn: string;
    /** How many distinct posts were found on the feed (for observability). */
    discoveredCount: number;
}

/** Discovery outcome that separates "empty feed" (terminal) from a transient miss. */
export interface DiscoveryResult {
    post: DiscoveredPost | null;
    /**
     * True when the feed genuinely had NO posts (or fewer than N) after all
     * retries — a deterministic miss the caller should retire the lead on,
     * rather than defer-and-retry. Distinct from a null caused by a flaky load,
     * where retrying later is legitimate.
     */
    emptyFeed: boolean;
    /** Posts seen on the last attempt (0 = nothing rendered / no posts). */
    lastCount: number;
    /** The feed has posts, but this campaign already engaged with all of them. */
    allEngaged?: boolean;
}

/**
 * Navigate to a lead's recent-activity feed and return the permalink of the
 * Nth post (1-based). Returns null if the feed had fewer than N posts after
 * all retries. Logs a canary line describing what it saw.
 */
export async function discoverNthPostUrl(
    page: any,
    linkedinUrl: string,
    n: number,
    logPrefix: string,
    engaged: string[] = [],
): Promise<DiscoveryResult> {
    const cleanUrl = linkedinUrl.split('?')[0].replace(/\/$/, '');
    const activityUrl = cleanUrl + '/recent-activity/shares/';

    let lastCount = 0;

    for (let attempt = 1; attempt <= 3; attempt++) {
        await safeGoto(page, activityUrl);
        await wait(4000);

        await page
            .waitForSelector(
                'div[data-urn*="urn:li:activity"], div[data-urn*="urn:li:ugcPost"], div[data-urn*="urn:li:share"], a[href*="/feed/update/urn:li:"]',
                { timeout: 15000 },
            )
            .catch(() => {});

        // Scroll past the target so the Nth post is definitely rendered.
        for (let i = 0; i < Math.max(n, engaged.length + 1) + 2; i++) {
            await page.mouse.wheel(0, 800);
            await wait(1500);
        }

        const found = await page.evaluate(extractOrderedPostUrns, n);

        lastCount = found.count;
        const urn = pickPost(found.urns, n, engaged);

        if (urn) {
            const how = engaged.length
                ? `newest of ${found.count} not already engaged (${engaged.length} engaged)`
                : `#${n} of ${found.count}`;
            console.log(`[${logPrefix}] Discovered ${found.count} post(s); picked ${how} (${urn}).`);
            return {
                post: {
                    url: `https://www.linkedin.com/feed/update/${urn}/`,
                    urn,
                    discoveredCount: found.count,
                },
                emptyFeed: false,
                lastCount: found.count,
            };
        }

        // Posts exist, and this campaign has engaged with every one of them.
        // Only concluded on the last attempt: a half-rendered feed showing
        // just the engaged post would otherwise read as "nothing new".
        if (engaged.length && found.count > 0 && attempt === 3) {
            console.log(`[${logPrefix}] All ${found.count} post(s) on the feed already engaged by this campaign — nothing new.`);
            return { post: null, emptyFeed: false, allEngaged: true, lastCount: found.count };
        }

        if (attempt < 3) {
            console.log(`[${logPrefix}] Post #${n} not found (saw ${found.count}), retrying (${attempt}/3)...`);
            await wait(randomRange(3000, 5000));
        }
    }

    // Canary: distinguish "profile has no/too-few posts" from "feed never
    // loaded" — the two failure modes need different fixes.
    if (lastCount === 0) {
        console.warn(`[${logPrefix}] [POST-DISCOVERY] No posts found on ${activityUrl} — empty feed or selector rot.`);
    } else {
        console.warn(`[${logPrefix}] [POST-DISCOVERY] Only ${lastCount} post(s) on feed; #${n} is out of range.`);
    }
    // Consistent "few but not enough" and "none at all" both mean this profile
    // won't yield post #n on a retry either — treat as an empty/insufficient
    // feed so the caller retires the lead instead of re-scraping it 3x.
    return { post: null, emptyFeed: true, lastCount };
}

/**
 * Discover the Nth post ONCE per lead per run, sharing the result between the
 * like and comment nodes.
 *
 * like-nth-post and comment-nth-post each used to scrape the same profile's
 * recent-activity feed independently. Two DOM scrapes of the same page is
 * wasted load and — worse — non-deterministic: the feed can render differently
 * on the second pass, so like would find post #1 and comment would then report
 * "Post #1 not found" for the very same target (the exact contradiction that
 * surfaced this). Discovering once and caching in the in-memory storedOutputs
 * for this run removes both the double load and the inconsistency. The cache is
 * per-run (not persisted); on a resume the fallback is simply to discover
 * again, which is correct, just not free.
 */
const DISCOVERY_CACHE_KEY = '__postDiscovery';

export async function getOrDiscoverNthPost(
    storedOutputs: Record<string, any>,
    page: any,
    linkedinUrl: string,
    n: number,
    logPrefix: string,
    engaged: string[] = [],
): Promise<DiscoveryResult> {
    const cache = (storedOutputs[DISCOVERY_CACHE_KEY] ||= {}) as Record<string, DiscoveredPost>;
    // The choice depends on what was already engaged, so that is part of the
    // key: a like and a comment with the same history still share one scrape.
    const key = `${n}|${[...engaged].sort().join(',')}`;
    const cached = cache[key];
    if (cached?.url) {
        console.log(`[${logPrefix}] Reusing post #${n} discovered earlier this run (${cached.urn}) — no re-scrape.`);
        return { post: cached, emptyFeed: false, lastCount: cached.discoveredCount };
    }
    const result = await discoverNthPostUrl(page, linkedinUrl, n, logPrefix, engaged);
    if (result.post) cache[key] = result.post;
    return result;
}
