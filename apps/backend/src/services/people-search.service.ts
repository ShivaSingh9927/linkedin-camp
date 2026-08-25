// people-search.service.ts
//
// In-app LinkedIn people-search. Runs the search the copilot recommends and
// returns the first page of results so the user judges leads by results, not by
// having to leave for LinkedIn + paste keywords + scrape with the extension.
//
// Strategy (proven 2026-08-24 on rajaji — see memory project_people_search_browserfree):
//   • BROWSER-FREE (default): the authenticated + sticky-proxied APIRequestContext
//     GETs the SSR people-search page. Modern LinkedIn people-search is fully
//     server-side rendered — no search XHR / queryId exists to replay — so the
//     result rows are embedded directly in the returned HTML markup. We parse
//     that markup with cheerio.
//   • DOM FALLBACK: if the browser-free HTML has no result rows (authwall / markup
//     churn), launch a real Chromium via launchAuthenticatedContext, navigate the
//     same URL, and run the SAME parser on page.content().
//
// The parser keys on the ONE stable structural signal LinkedIn still exposes:
// each result is a `div[role="listitem"]`, and the FIRST /in/ anchor inside it is
// the result person (later /in/ anchors are mutual-connection insights). Name /
// degree / headline / location come from the name <p> (carries the "• 2nd" badge)
// and its following sibling <div>s. Everything else on the card (obfuscated CSS
// class names) is treated as noise. Parsing is the maintenance surface — same
// class as the extension's content.js selectors.

import { load } from 'cheerio';
import { getBrowserlessVoyagerContext, checkRateLimit } from './voyager-api.service';
import { launchAuthenticatedContext } from '../campaign-engine/session-launch';

export interface SearchFilters {
    title?: string;
    location?: string;
    industry?: string;
    // LinkedIn network degrees to include (1st / 2nd / 3rd+). Empty = any.
    degrees?: Array<1 | 2 | 3>;
}

export interface SearchPerson {
    firstName: string;
    lastName: string;
    name: string;
    headline: string;
    jobTitle: string;
    company: string;
    location: string;
    connectionDegree: 1 | 2 | 3 | null;
    linkedinUrl: string;
}

export interface SearchResult {
    people: SearchPerson[];
    via: 'browserless' | 'dom';
}

// Thrown when both the browser-free fetch and the DOM fallback indicate the
// user's LinkedIn session is dead (authwall) — so callers can tell the user to
// reconnect instead of surfacing a generic failure or blind-retrying.
export class SessionExpiredError extends Error {
    constructor() {
        super('session_expired');
        this.name = 'SessionExpiredError';
    }
}

// ---- text helpers ----

const clean = (t: string | null | undefined) => (t || '').replace(/\s+/g, ' ').trim();

// LinkedIn renders the degree badge as "• 1st" / "• 2nd" / "• 3rd+".
function degreeOf(txt: string): 1 | 2 | 3 | null {
    const m = (txt || '').match(/•\s*(1st|2nd|3rd\+?)/);
    if (!m) return null;
    return m[1] === '1st' ? 1 : m[1] === '2nd' ? 2 : 3;
}

// The name node sometimes concatenates the visible name with the avatar's
// screen-reader copy: "Naman Pilania Naman Pilania" → "Naman Pilania".
function dedouble(name: string): string {
    const parts = name.split(' ');
    if (parts.length >= 2 && parts.length % 2 === 0) {
        const a = parts.slice(0, parts.length / 2).join(' ');
        const b = parts.slice(parts.length / 2).join(' ');
        if (a === b) return a;
    }
    return name;
}

// Card sub-lines that are insights, not the person's own headline/location.
const INSIGHT_RE = /(is a (mutual|shared) connection|other mutual connections?|mutual connection|is open to work|is hiring)/i;

const slugOf = (href: string | undefined) => (href || '').match(/\/in\/([^/?#]+)/)?.[1] || null;

// Split "Software Project Manager at IDM VALLEY" → {jobTitle, company}. Best
// effort: LinkedIn headlines are free text, so only split on a clear " at " /
// " @ " company delimiter; otherwise keep the whole line as the title.
function splitHeadline(headline: string): { jobTitle: string; company: string } {
    const h = clean(headline);
    if (!h) return { jobTitle: '', company: '' };
    const at = h.match(/^(.+?)\s+(?:at|@)\s+(.+)$/i);
    if (at) {
        const jobTitle = clean(at[1]);
        // Company runs until the first separator LinkedIn uses to chain extra
        // headline fragments (pipe / bullet).
        const company = clean(at[2].split('|')[0].split('•')[0]);
        if (jobTitle.length >= 2 && company.length >= 1) return { jobTitle, company };
    }
    return { jobTitle: h, company: '' };
}

/**
 * Parse a LinkedIn people-search results page (SSR HTML or a live DOM's
 * page.content()) into structured people. Pure + synchronous so it can be
 * unit-tested against a fixture with no network.
 */
export function parseSearchPeopleHtml(html: string, limit = 10): SearchPerson[] {
    const $ = load(html);
    const people: SearchPerson[] = [];
    const seen = new Set<string>();

    $('div[role="listitem"]').each((_, it) => {
        if (people.length >= limit) return false as any;
        const $it = $(it);

        // The result person = the FIRST /in/ anchor in the listitem.
        const slug = slugOf($it.find('a[href*="/in/"]').first().attr('href'));
        if (!slug || seen.has(slug)) return;

        // Name <p>: prefer the <p> carrying the degree badge; else the first <p>
        // holding a child-less anchor to this slug that isn't an insight line.
        let $nameP: any = null;
        $it.find('p').each((_, p) => {
            if ($nameP) return;
            const $p = $(p);
            if (/•\s*(1st|2nd|3rd\+?)/.test($p.text())) $nameP = $p;
        });
        if (!$nameP) {
            $it.find('p').each((_, p) => {
                if ($nameP) return;
                const $p = $(p);
                const hit = $p.find('a[href*="/in/"]').filter(
                    (_, a) => $(a).children().length === 0 && slugOf($(a).attr('href')) === slug,
                );
                if (hit.length && !INSIGHT_RE.test($p.text())) $nameP = $p;
            });
        }
        if (!$nameP) return;

        // Name = text before the degree bullet, minus badges, de-doubled.
        let name = clean($nameP.text().split('•')[0]);
        name = name.replace(/\s+is open to work$/i, '').replace(/\s+is hiring$/i, '').trim();
        name = dedouble(name);
        if (!name || name.length < 2 || name.length > 60) return;

        const connectionDegree = degreeOf($nameP.text());

        // headline + location = the following sibling <div>s, dropping insights.
        const infos: string[] = [];
        $nameP.nextAll('div').each((_: number, d: any) => {
            const t = clean($(d).text());
            if (t && !INSIGHT_RE.test(t)) infos.push(t);
        });
        const headline = infos[0] || '';
        const location = infos[1] || '';
        const { jobTitle, company } = splitHeadline(headline);

        const nameParts = name.split(' ');
        seen.add(slug);
        people.push({
            firstName: nameParts[0] || '',
            lastName: nameParts.slice(1).join(' ') || '',
            name,
            headline,
            jobTitle,
            company,
            location,
            connectionDegree,
            linkedinUrl: `https://www.linkedin.com/in/${slug}/`,
        });
    });

    return people;
}

// LinkedIn network-degree URL tokens: 1st=F, 2nd=S, 3rd+=O.
const DEGREE_TOKEN: Record<1 | 2 | 3, string> = { 1: 'F', 2: 'S', 3: 'O' };

// Fold the free-text filters into the keyword string. A proper geoUrn/industry
// URN lookup needs a typeahead round-trip we deliberately skip for v1 — LinkedIn
// keyword search already ranks title/location/industry text well, and this keeps
// the request a single GET. Degree is a clean enum, so it goes on as a real param.
export function buildSearchUrl(keywords: string, filters?: SearchFilters, page?: number): string {
    const terms = [keywords, filters?.title, filters?.location, filters?.industry]
        .map((t) => clean(t || ''))
        .filter(Boolean);
    const kw = terms.join(' ');
    const params = new URLSearchParams();
    params.set('keywords', kw);
    params.set('origin', 'SWITCH_SEARCH_VERTICAL');
    if (filters?.degrees?.length) {
        const tokens = filters.degrees.map((d) => DEGREE_TOKEN[d]).filter(Boolean);
        if (tokens.length) params.set('network', JSON.stringify(tokens));
    }
    // Page 2+ for "show more" — LinkedIn people-search paginates via `page`.
    if (page && page > 1) params.set('page', String(page));
    return `https://www.linkedin.com/search/results/people/?${params.toString()}`;
}

// Cheap authwall / empty-shell detection on a raw HTML body.
function looksBlocked(html: string): boolean {
    if (!html || html.length < 2000) return true;
    return /(authwall|uas\/login|Sign in to LinkedIn|please sign in|linkedin\.com\/login)/i.test(
        html.slice(0, 4000),
    );
}

/**
 * Run a people-search for a user and return the first page of results.
 * Browser-free first; falls back to a real Chromium only when the browser-free
 * HTML is blocked or yields nothing. Honors the read rate-limit and the
 * sticky-proxy invariant (both enforced by the underlying context builders).
 */
export async function searchPeople(
    userId: string,
    opts: { keywords: string; filters?: SearchFilters; limit?: number; page?: number },
): Promise<SearchResult> {
    const limit = Math.min(Math.max(opts.limit ?? 10, 1), 10);
    const url = buildSearchUrl(opts.keywords, opts.filters, opts.page);
    let sawAuthwall = false; // browser-free signalled a dead session

    // ---- browser-free ----
    const bl = await getBrowserlessVoyagerContext(userId);
    if (bl) {
        try {
            await checkRateLimit(userId);
            const resp = await bl.ctx.get(url, {
                headers: {
                    accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                    'accept-language': 'en-US,en;q=0.9',
                },
            });
            const status = resp.status();
            const html = await resp.text().catch(() => '');
            if (status === 200 && !looksBlocked(html)) {
                const people = parseSearchPeopleHtml(html, limit);
                if (people.length > 0) return { people, via: 'browserless' };
            } else if (status === 401 || status === 403 || looksBlocked(html)) {
                sawAuthwall = true; // dead session, not just markup churn
                console.warn(`[people-search] browser-free authwall (status=${status}) — trying DOM to confirm`);
            } else {
                console.warn(`[people-search] browser-free status=${status} empty — DOM fallback`);
            }
        } catch (e: any) {
            console.warn(`[people-search] browser-free error: ${e?.message || e} — DOM fallback`);
        } finally {
            await bl.dispose();
        }
    }

    // ---- DOM fallback ----
    const launch = await launchAuthenticatedContext(userId);
    if (!launch.ok) {
        // A launch that fails on session/proxy setup, after browser-free already
        // authwalled, means the session is gone — surface it as such.
        if (sawAuthwall || /session|login|auth|proxy-snapshot/i.test(launch.failedAt || '')) {
            throw new SessionExpiredError();
        }
        throw new Error(`people-search: DOM fallback launch failed at ${launch.failedAt}: ${launch.error}`);
    }
    const { browser, context, page } = launch;
    try {
        // Warm up on /feed — a cold deep-link to search can authwall.
        await page.goto('https://www.linkedin.com/feed/', { waitUntil: 'domcontentloaded', timeout: 60000 }).catch(() => {});
        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
        // If LinkedIn bounced us to a login/authwall, the session is dead.
        const landed = page.url();
        if (/\/(login|authwall|uas\/login)/i.test(landed)) throw new SessionExpiredError();
        // Nudge lazy rendering, then read the hydrated markup and reuse the parser.
        for (let i = 0; i < 4; i++) { await page.mouse.wheel(0, 1400).catch(() => {}); await page.waitForTimeout(800); }
        const html = await page.content().catch(() => '');
        const people = parseSearchPeopleHtml(html, limit);
        // Browser-free authwalled AND the live DOM returned nothing → session dead.
        if (people.length === 0 && sawAuthwall) throw new SessionExpiredError();
        return { people, via: 'dom' };
    } finally {
        await context.close().catch(() => {});
        await browser.close().catch(() => {});
    }
}
