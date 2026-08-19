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
export function extractOrderedPostUrns(targetNum: number): { count: number; urn: string | null } {
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

    return { count: urns.length, urn: urns[targetIndex] || null };
}

export interface DiscoveredPost {
    /** Canonical permalink: https://www.linkedin.com/feed/update/<urn>/ */
    url: string;
    /** The bare activity/ugcPost/share URN. */
    urn: string;
    /** How many distinct posts were found on the feed (for observability). */
    discoveredCount: number;
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
): Promise<DiscoveredPost | null> {
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
        for (let i = 0; i < n + 2; i++) {
            await page.mouse.wheel(0, 800);
            await wait(1500);
        }

        const found = await page.evaluate(extractOrderedPostUrns, n);

        lastCount = found.count;

        if (found.urn) {
            console.log(`[${logPrefix}] Discovered ${found.count} post(s); picked #${n} (${found.urn}).`);
            return {
                url: `https://www.linkedin.com/feed/update/${found.urn}/`,
                urn: found.urn,
                discoveredCount: found.count,
            };
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
    return null;
}
