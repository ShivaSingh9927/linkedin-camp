// people-serp.js
//
// LinkedIn profile discovery via a public search engine, as a second source
// alongside in-app LinkedIn people-search. The point is reach: LinkedIn's
// Commercial Use Limit caps a free account at ~280 searches/month, and this
// path doesn't touch that counter at all.
//
// Measured on this box 2026-09-22 (see memory project_serp_lead_discovery):
//   • Yahoo via Lightpanda returns ~7 real profiles per page.
//   • Paging with `b=1/11/21` gives 22 distinct slugs over 3 pages — real depth,
//     not the same rows re-ranked.
//   • DuckDuckGo's html endpoint is hard-blocked from here: HTTP 202 and an
//     identically-sized ~2KB shell for every query. Do not re-add it.
//   • Two quoted phrases collapse the result set to 0-1. One is fine. Hence
//     `serpQuery()` keeps at most one.
//
// Unlike the competitive-landscape pipeline in research.js, this runs on a
// user-facing path, so renders here are async (spawn, not spawnSync) and capped
// by a semaphore. research.js still uses spawnSync; converting it is separate
// work. Both are stopgaps for Lightpanda's CDP server mode, which would replace
// process-per-render with pages in one long-lived browser.

const { spawn } = require('child_process');
const { parseYahooMarkdown } = require('./research');

const LIGHTPANDA_PATH = process.env.LIGHTPANDA_PATH || '/usr/local/bin/lightpanda';
const SERP_PAGE_TIMEOUT_MS = parseInt(process.env.SERP_PAGE_TIMEOUT_MS || '30000', 10);
const SERP_CACHE_TTL_SECONDS = parseInt(process.env.SERP_CACHE_TTL_SECONDS || String(7 * 24 * 60 * 60), 10);
// Concurrent Lightpanda renders. Rendering is CPU-bound and this box also runs
// Postgres, so the cap protects the database, not memory (Lightpanda does 100
// pages in ~123MB). Default 2 because the db box is a 2-core machine — measured,
// not guessed. Raise it only alongside nproc.
const SERP_MAX_CONCURRENT = parseInt(process.env.SERP_MAX_CONCURRENT || '2', 10);
// Yahoo yields ~7 profiles/page, so 2 pages covers the ~10 we merge in.
const SERP_DEFAULT_PAGES = parseInt(process.env.SERP_DEFAULT_PAGES || '2', 10);

// ---------- concurrency ----------

let active = 0;
const waiting = [];

function acquire() {
    if (active < SERP_MAX_CONCURRENT) {
        active++;
        return Promise.resolve();
    }
    return new Promise((resolve) => waiting.push(resolve));
}

function release() {
    const next = waiting.shift();
    if (next) next();
    else active = Math.max(0, active - 1);
}

// ---------- async Lightpanda ----------

// Async twin of research.js's fetchMarkdown. argv form (never a shell string),
// so a hostile query can't inject extra commands.
function fetchMarkdownAsync(url, timeoutMs = SERP_PAGE_TIMEOUT_MS) {
    return new Promise((resolve) => {
        let out = '';
        let done = false;
        const finish = (v) => { if (!done) { done = true; resolve(v); } };

        let child;
        try {
            child = spawn(LIGHTPANDA_PATH, ['fetch', url, '--dump', 'markdown'], {
                stdio: ['ignore', 'pipe', 'ignore'],
            });
        } catch {
            return finish('');
        }

        const timer = setTimeout(() => { try { child.kill('SIGKILL'); } catch {} finish(''); }, timeoutMs);
        child.stdout.on('data', (c) => {
            // Bound the buffer — a pathological page shouldn't eat the heap.
            if (out.length < 4 * 1024 * 1024) out += c.toString('utf8');
        });
        child.on('error', () => { clearTimeout(timer); finish(''); });
        child.on('close', () => { clearTimeout(timer); finish(out.trim()); });
    });
}

// ---------- query ----------

// Yahoo collapses to 0-1 results when a query carries two or more quoted
// phrases (measured: `"talent acquisition" "Enphase Energy"` → 1, dropping
// either quote → 8). Keep the FIRST quoted phrase, unquote the rest.
function oneQuotedPhrase(input) {
    const s = String(input || '').replace(/\s+/g, ' ').trim();
    let kept = false;
    return s
        .replace(/"([^"]*)"/g, (_m, inner) => {
            if (!kept) { kept = true; return `"${inner}"`; }
            return inner;
        })
        .replace(/\s+/g, ' ')
        .trim();
}

// Build the engine query. `site:` restricts to profile pages; without it the
// results fill with /jobs/ and /company/ pages.
function serpQuery(keywords) {
    const kw = oneQuotedPhrase(keywords).slice(0, 160);
    return `site:linkedin.com/in/ ${kw}`.trim();
}

// ---------- parsing ----------

// A Yahoo results page echoes the URL-encoded query back into the markup, and
// because our query *contains* "linkedin.com/in/", a naive regex harvests the
// query string itself as a profile slug. That artifact is why raw counts read 8
// where only 7 are real people.
function slugFromUrl(url) {
    const m = String(url || '').match(/^https?:\/\/(?:[a-z0-9-]+\.)*linkedin\.com\/in\/([^/?#]+)/i);
    if (!m) return null;
    const slug = m[1];
    if (!slug || slug.length > 100) return null;
    // Percent-encoding never appears in a real vanity slug but always appears in
    // the echoed-query artifact.
    if (slug.includes('%')) return null;
    if (!/^[A-Za-z0-9._-]+$/.test(slug)) return null;
    // Guard against a slug that is really a LinkedIn path segment.
    if (/^(edit|public-profile|in)$/i.test(slug)) return null;
    return slug.toLowerCase();
}

// SERP titles for a profile look like:
//   "Naveen kumar E - Senior Software Engineer at Enphase ... | LinkedIn"
//   "Mark Alfaro - Non-Profit Board Member & Retired - LinkedIn"
// Split the person's name off the front and keep the remainder as the headline.
function parseTitle(rawTitle) {
    let t = String(rawTitle || '').replace(/\s+/g, ' ').trim();
    // Lightpanda sometimes leaves the markdown link brackets on the heading
    // ("### [Name - Headline]") and sometimes doesn't. Tolerate both rather
    // than depending on which.
    if (t.startsWith('[') && t.endsWith(']')) t = t.slice(1, -1).trim();
    t = t.replace(/^\[+/, '').replace(/\]+$/, '').trim();
    t = t.replace(/\s*[|\-–—]\s*LinkedIn\s*$/i, '').trim();
    t = t.replace(/\s*\|\s*$/, '').trim();
    const parts = t.split(/\s+[-–—]\s+/);
    const name = (parts.shift() || '').trim();
    const headline = parts.join(' - ').trim();
    return { name, headline };
}

function splitName(name) {
    const parts = String(name || '').replace(/\s+/g, ' ').trim().split(' ').filter(Boolean);
    if (!parts.length) return { firstName: '', lastName: '' };
    return { firstName: parts[0], lastName: parts.slice(1).join(' ') };
}

/**
 * Turn raw engine hits into profile records. Exported for unit testing — pure
 * and synchronous, no network.
 */
function parseSerpHits(hits, limit = 20) {
    const people = [];
    const seen = new Set();
    for (const hit of hits || []) {
        if (people.length >= limit) break;
        const slug = slugFromUrl(hit && hit.url);
        if (!slug || seen.has(slug)) continue;
        const { name, headline } = parseTitle(hit.title);
        // A hit with no recoverable name is a directory/anchor page, not a person.
        if (!name || name.length < 2) continue;
        seen.add(slug);
        const { firstName, lastName } = splitName(name);
        people.push({
            firstName,
            lastName,
            name,
            headline: headline || String((hit && hit.snippet) || '').slice(0, 200),
            // Always the canonical host: Yahoo returns country subdomains
            // (in.linkedin.com), which would otherwise dedupe as distinct leads.
            linkedinUrl: `https://www.linkedin.com/in/${slug}`,
            slug,
            // The engine can't see connection degree. Null is a first-class case
            // downstream — smartAudienceRouter probes degree at run time.
            connectionDegree: null,
            source: 'serp',
        });
    }
    return people;
}

// ---------- entry point ----------

/**
 * Discover LinkedIn profiles for a keyword phrase via Yahoo.
 * Returns { people, pagesFetched, cached, query }.
 */
async function searchLinkedInProfiles({ keywords, pages, limit, startPage } = {}, redis) {
    const kw = String(keywords || '').replace(/\s+/g, ' ').trim();
    if (!kw) return { people: [], pagesFetched: 0, cached: false, query: '' };

    const wantPages = Math.min(Math.max(parseInt(pages, 10) || SERP_DEFAULT_PAGES, 1), 5);
    const wantLimit = Math.min(Math.max(parseInt(limit, 10) || 20, 1), 50);
    // 1-based engine page to start from, so "show more" reads deeper instead of
    // re-rendering the pages the user already saw.
    const from = Math.min(Math.max(parseInt(startPage, 10) || 1, 1), 10);
    const query = serpQuery(kw);

    const cacheKey = `serp:people:${query.toLowerCase()}:s${from}:p${wantPages}`;
    if (redis) {
        try {
            const hit = await redis.get(cacheKey);
            if (hit) {
                const parsed = JSON.parse(hit);
                return { ...parsed, cached: true };
            }
        } catch { /* cache is an optimization, never a dependency */ }
    }

    // Pages are independent GETs, so fetch them together and let the semaphore
    // decide how many actually render at once.
    const offsets = Array.from({ length: wantPages }, (_, i) => 1 + (from - 1 + i) * 10);
    const settled = await Promise.all(offsets.map(async (b) => {
        await acquire();
        try {
            return await yahooHits(query, b);
        } catch (e) {
            console.error(`[people-serp] page b=${b} failed: ${e && e.message}`);
            return [];
        } finally {
            release();
        }
    }));

    const people = parseSerpHits(settled.flat(), wantLimit);
    const result = { people, pagesFetched: offsets.length, cached: false, query };

    if (redis && people.length > 0) {
        try { await redis.setex(cacheKey, SERP_CACHE_TTL_SECONDS, JSON.stringify(result)); } catch { /* ignore */ }
    }
    return result;
}

// research.js's searchYahoo is sync (spawnSync), which is fine for the
// background research pipeline but not for a user-facing path. Redo the fetch
// half asynchronously and reuse that module's markdown parser so there is one
// reader of Yahoo's markup, not two that drift apart.
async function yahooHits(query, b) {
    const offset = b > 1 ? `&b=${b}` : '';
    const url = `https://search.yahoo.com/search?p=${encodeURIComponent(query)}${offset}`;
    const markdown = await fetchMarkdownAsync(url);
    if (!markdown) return [];
    return parseYahooMarkdown(markdown);
}

module.exports = {
    searchLinkedInProfiles,
    // exported for tests
    parseSerpHits,
    serpQuery,
    oneQuotedPhrase,
    slugFromUrl,
    parseTitle,
};
