/**
 * Live LinkedIn search scrape + connection-degree extraction.
 *
 * Runs inside the backend-worker container on the prod Hetzner box so it
 * uses the exact same session + sticky proxy + Playwright/stealth setup as
 * the campaign engine. That guarantees:
 *   - Same network egress as the user's logged-in session (no OTP risk)
 *   - Selectors we discover here will hit the same DOM the Chrome extension
 *     content-script sees on the user's machine
 *
 * USAGE (from worker box):
 *   docker cp scrape_search_degree.js backend-worker:/app/
 *   docker exec -w /app backend-worker node scrape_search_degree.js
 *
 * ENV:
 *   USER_ID   — required, the qampi user whose session/proxy to reuse
 *   QUERY     — boolean search string; default "\"founder\" AND \"saas\""
 *   HEADLESS  — 'false' to watch (requires xvfb); default true
 */
const { PrismaClient } = require('@prisma/client');
const { chromium } = require('playwright-extra');
const stealth = require('puppeteer-extra-plugin-stealth')();
chromium.use(stealth);

const USER_ID = process.env.USER_ID || 'cmpposqs50000mj08zdxpcuz2'; // rajaji98971
const QUERY = process.env.QUERY || '"founder" AND "saas"';
const HEADLESS = process.env.HEADLESS !== 'false';

const wait = (ms) => new Promise(r => setTimeout(r, ms));

(async () => {
    const prisma = new PrismaClient();
    const user = await prisma.user.findUnique({ where: { id: USER_ID } });
    if (!user) { console.error('user not found:', USER_ID); process.exit(1); }
    if (!user.linkedinCookie) { console.error('user has no linkedinCookie'); process.exit(1); }

    const cookies = JSON.parse(user.linkedinCookie);
    const localStorageData = user.linkedinLocalStorage ? JSON.parse(user.linkedinLocalStorage) : {};
    const fingerprint = user.linkedinFingerprint ? JSON.parse(user.linkedinFingerprint) : {};
    const proxySnap = user.linkedinProxySnapshot;
    if (!proxySnap?.server) { console.error('no linkedinProxySnapshot pinned'); process.exit(1); }

    console.log(`[SCRAPE] user=${user.email} cookies=${cookies.length} proxy=${proxySnap.server}`);
    console.log(`[SCRAPE] query="${QUERY}"`);

    const browser = await chromium.launch({
        headless: HEADLESS,
        proxy: {
            server: proxySnap.server,
            username: proxySnap.username || undefined,
            password: proxySnap.password || undefined,
        },
        args: ['--disable-blink-features=AutomationControlled', '--no-sandbox'],
    });
    const context = await browser.newContext({
        userAgent: fingerprint.userAgent || 'Mozilla/5.0',
        viewport: fingerprint.viewport || { width: 1280, height: 800 },
        locale: 'en-US',
    });
    await context.addCookies(cookies);
    const page = await context.newPage();

    // Inject localStorage at https://www.linkedin.com origin before navigation.
    await page.goto('https://www.linkedin.com/', { waitUntil: 'domcontentloaded' });
    if (Object.keys(localStorageData).length) {
        await page.evaluate((ls) => {
            for (const [k, v] of Object.entries(ls)) localStorage.setItem(k, v);
        }, localStorageData);
    }

    // Quick session sanity: hit /feed/. Auth-walled = session dead.
    await page.goto('https://www.linkedin.com/feed/', { waitUntil: 'domcontentloaded' });
    await wait(3000);
    if (/authwall|login|checkpoint/.test(page.url())) {
        console.error(`[SCRAPE] session invalid — redirected to ${page.url()}`);
        await browser.close(); await prisma.$disconnect(); process.exit(2);
    }
    console.log('[SCRAPE] session valid.');

    // People-search page. /search/results/people with keywords URL-encoded.
    const searchUrl = `https://www.linkedin.com/search/results/people/?keywords=${encodeURIComponent(QUERY)}`;
    console.log(`[SCRAPE] navigating: ${searchUrl}`);
    await page.goto(searchUrl, { waitUntil: 'domcontentloaded' });
    await wait(5000);

    // Aggressive scroll + wait so lazy-rendered cards hydrate. LinkedIn 2026
    // lazy-renders results as you scroll; without this we capture pre-hydration
    // DOM and miss `data-view-name="people-search-result"` cards entirely.
    for (let i = 0; i < 5; i++) {
        await page.mouse.wheel(0, 1500);
        await wait(1200);
    }
    await wait(2000);
    // Scroll back to top so screenshot shows the top of the result list.
    await page.evaluate(() => window.scrollTo(0, 0));
    await wait(1500);

    // Save a full snapshot for debugging selector misses.
    const html = await page.content();
    require('fs').writeFileSync('/tmp/search_results.html', html);
    await page.screenshot({ path: '/tmp/search_results.png', fullPage: false });
    console.log('[SCRAPE] snapshot saved: /tmp/search_results.html + .png');

    // LinkedIn 2026 layout uses obfuscated dynamic CSS class names so
    // traditional class-based card selectors all whiff. The only stable
    // anchor is the profile-link anchor: `a[href*="/in/<slug>/"]`. Strategy:
    //   1. Find every unique profile slug on the page
    //   2. For each slug, walk UP from its anchor to the smallest ancestor
    //      that contains a degree badge text ("1st" / "2nd" / "3rd+")
    //   3. That ancestor IS the card — extract name + headline from it
    //
    // All work happens in page.evaluate() (single round-trip) for speed.
    const results = await page.evaluate(() => {
        // ANCHOR ON DEGREE SPANS, not profile anchors. The degree badge sits
        // in a sibling subtree of the profile link (not a descendant), so
        // walking up from the anchor often hits a multi-card ancestor before
        // reaching the degree. Inverting the search: find every degree span,
        // then walk UP from each to the smallest ancestor containing exactly
        // one /in/ slug. That ancestor is the card.

        const isFilterPill = (el) => {
            for (let n = el; n && n !== document.body; n = n.parentElement) {
                const al = (n.getAttribute && n.getAttribute('aria-label')) || '';
                if (/Filter by .* connections/.test(al)) return true;
                // Filter pills also wrap the degree text in a <label for="«r...»">.
                if (n.tagName === 'LABEL') return true;
            }
            return false;
        };

        const uniqueSlugsUnder = (el) => {
            const set = new Set();
            for (const a of el.querySelectorAll('a[href*="/in/"]')) {
                const m = (a.getAttribute('href') || '').match(/\/in\/([^/?#]+)/);
                if (m) set.add(m[1]);
            }
            return set;
        };

        // Find every text-leaf node containing a degree token.
        const degreeRe = /(?:^|\s|•\s*)(1st|2nd|3rd\+?)(?:\s|$|\b)/;
        const allTextNodes = document.evaluate(
            '//text()[contains(., "1st") or contains(., "2nd") or contains(., "3rd")]',
            document, null, XPathResult.ORDERED_NODE_SNAPSHOT_TYPE, null
        );

        const rows = [];
        const seenSlugs = new Set();

        for (let i = 0; i < allTextNodes.snapshotLength; i++) {
            const textNode = allTextNodes.snapshotItem(i);
            const text = textNode.textContent || '';
            const m = text.match(degreeRe);
            if (!m) continue;
            const degreeRaw = m[1];

            // Walk up from the text node to find the smallest ancestor whose
            // subtree contains exactly one /in/ slug. Skip filter pills.
            let el = textNode.parentElement;
            if (!el || isFilterPill(el)) continue;

            let cardEl = null;
            let slug = null;
            for (let depth = 0; depth < 20 && el && el !== document.body; depth++, el = el.parentElement) {
                if (el.closest('nav, header, [role="banner"]')) { el = null; break; }
                const slugs = uniqueSlugsUnder(el);
                if (slugs.size === 1) {
                    cardEl = el;
                    slug = [...slugs][0];
                    // Keep walking — the card might be a bigger element. Stop
                    // when slugs.size grows beyond 1.
                } else if (slugs.size > 1) {
                    break;
                }
            }
            if (!cardEl || !slug) continue;
            if (seenSlugs.has(slug)) continue;
            seenSlugs.add(slug);

            let degreeParsed = null;
            if (degreeRaw === '1st') degreeParsed = 1;
            else if (degreeRaw === '2nd') degreeParsed = 2;
            else if (degreeRaw.startsWith('3rd')) degreeParsed = 3;

            // Pick the FIRST profile anchor inside the card.
            const anchor = cardEl.querySelector('a[href*="/in/"]');
            const href = anchor ? (anchor.getAttribute('href') || '') : '';
            const url = href.startsWith('http') ? href.split('?')[0] : `https://www.linkedin.com${href.split('?')[0]}`;

            // Name extraction has two LinkedIn quirks to handle:
            //   1. Anchor text often duplicates: "Aditya Singhi Aditya Singhi"
            //      (visible aria-hidden span + screen-reader span both render).
            //   2. Some cards inline the degree + opener inside the anchor:
            //      "Pragnesh Makwana (Founder) • 3rd+Founder @ Webdroids".
            //      Strip on the first "•" to drop the degree-and-after.
            // Order: strip on '•' first, THEN dedupe the doubled half.
            let name = '';
            if (anchor) {
                name = (anchor.textContent || '').trim().replace(/\s+/g, ' ');
                const bulletIdx = name.indexOf('•');
                if (bulletIdx > 0) name = name.substring(0, bulletIdx).trim();
                if (name.length) {
                    const halves = name.split(' ');
                    if (halves.length >= 2 && halves.length % 2 === 0) {
                        const first  = halves.slice(0, halves.length / 2).join(' ');
                        const second = halves.slice(halves.length / 2).join(' ');
                        if (first === second) name = first;
                    }
                }
                name = name.substring(0, 80);
            }

            // Headline: largest text node in card that isn't name + isn't UI noise.
            let headline = null;
            const txts = Array.from(cardEl.querySelectorAll('div, span, p'))
                .map(n => (n.textContent || '').trim().replace(/\s+/g, ' '))
                .filter(t =>
                    t.length > 20 && t.length < 250
                    && !t.includes('Filter by')
                    && !/^(Connect|Follow|Message|Promoted|Sponsored|View profile|View .* profile)$/i.test(t)
                    && !t.startsWith(name)
                );
            if (txts.length) {
                // Smallest qualifying text node — bigger ones usually concatenate everything.
                headline = txts.sort((a, b) => a.length - b.length)[0];
            }

            rows.push({ slug, url, name, headline, degreeRaw, degreeParsed });
            if (rows.length >= 12) break;
        }
        return rows;
    });

    console.log('\n[SCRAPE] per-card extraction:');
    for (const r of results) {
        const idx = String(results.indexOf(r) + 1).padStart(2);
        console.log(`  [${idx}] ${(r.name || '(no name)').padEnd(30)} | deg=${r.degreeParsed ?? 'null'} (raw="${r.degreeRaw ?? ''}")`);
        if (r.headline) console.log(`        headline: ${r.headline.substring(0, 100)}`);
        if (r.url)      console.log(`        url:      ${r.url}`);
    }

    console.log('\n[SCRAPE] summary:');
    const byDegree = { 1: 0, 2: 0, 3: 0, null: 0 };
    for (const r of results) byDegree[r.degreeParsed ?? 'null']++;
    console.log(`  1st: ${byDegree[1]} / 2nd: ${byDegree[2]} / 3rd+: ${byDegree[3]} / unknown: ${byDegree.null}`);
    console.log(`  total cards: ${results.length}`);

    await browser.close();
    await prisma.$disconnect();
    process.exit(0);
})().catch(async (e) => { console.error(e); process.exit(1); });
