/**
 * Probe: can we read a company's WEBSITE (→ email domain) from LinkedIn's
 * Voyager organization API, given its universalName slug?
 *
 * Proxy-safe by construction: rides launchAuthenticatedContext (correct pinned
 * proxy + session), same as capture-recent-posts.ts. Read-only, no writes.
 *
 * Usage:
 *   QCAP_USER=<userId> QCAP_SLUGS=asianpaints,capgemini,tellius \
 *     npx tsx src/scripts/probe-company-domain.ts
 */
import { launchAuthenticatedContext } from '../campaign-engine/session-launch';
import { voyagerFetch } from '../services/voyager-api.service';

const userId = process.env.QCAP_USER || process.argv[2] || '';
const slugs = (process.env.QCAP_SLUGS || 'asianpaints,capgemini,tellius')
    .split(',').map((s) => s.trim()).filter(Boolean);

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

// Pull any website-ish URL out of an arbitrary JSON blob.
function findWebsites(obj: any, out: Set<string> = new Set(), depth = 0): Set<string> {
    if (!obj || depth > 8) return out;
    if (typeof obj === 'string') {
        if (/^https?:\/\//i.test(obj) && !/linkedin\.com|licdn\.com|media\./i.test(obj)) out.add(obj);
        return out;
    }
    if (Array.isArray(obj)) { obj.forEach((v) => findWebsites(v, out, depth + 1)); return out; }
    if (typeof obj === 'object') {
        for (const [k, v] of Object.entries(obj)) {
            // Flag the keys most likely to hold the website.
            if (/companyPageUrl|websiteUrl|^url$|callToAction/i.test(k) && typeof v === 'string') {
                if (/^https?:\/\//i.test(v)) out.add(`${k}=${v}`);
            }
            findWebsites(v, out, depth + 1);
        }
    }
    return out;
}

(async () => {
    if (!userId) { console.error('Set QCAP_USER=<userId>'); process.exit(1); }
    console.log(`[probe] user=${userId} slugs=${slugs.join(',')}`);
    const launch = await launchAuthenticatedContext(userId);
    if (!launch.ok) { console.error(`[probe] launch failed at ${launch.failedAt}: ${launch.error}`); process.exit(1); }
    console.log(`[probe] launched via proxy ${launch.proxyServer}`);
    const { browser, page } = launch as any;

    try {
        await page.goto('https://www.linkedin.com/feed/', { waitUntil: 'domcontentloaded', timeout: 60000 }).catch(() => {});
        await page.mouse.wheel(0, 1000); await wait(2000);
        console.log(`[probe] feed landed: "${await page.title().catch(() => '?')}"`);

        for (const slug of slugs) {
            console.log(`\n===== ${slug} =====`);

            // Sniff every Voyager call the company page fires; record which one
            // carries a website + its request URL (→ the endpoint to replicate).
            const hits: { url: string; sites: string[] }[] = [];
            const onResp = async (resp: any) => {
                const u = resp.url();
                if (!/\/voyager\/api\//.test(u)) return;
                if (!/organi|company|companies|dash/i.test(u)) return;
                try {
                    const body = await resp.json();
                    const sites = [...findWebsites(body)];
                    if (sites.length) hits.push({ url: u, sites });
                } catch { /* non-json */ }
            };
            page.on('response', onResp);

            // Navigate the company About page — that's what loads the website field.
            const aboutUrl = `https://www.linkedin.com/company/${slug}/about/`;
            await page.goto(aboutUrl, { waitUntil: 'domcontentloaded', timeout: 60000 }).catch((e: any) => console.log(`  nav err: ${e.message}`));
            await wait(4000);
            await page.mouse.wheel(0, 1200); await wait(3000);
            console.log(`  landed: "${await page.title().catch(() => '?')}"  url=${page.url()}`);

            // Also try reading the website straight off the DOM (fallback signal).
            const domSite = await page.evaluate(() => {
                const a = Array.from(document.querySelectorAll('a'))
                    .map((x: any) => x.href)
                    .find((h: string) => h && /^https?:\/\//.test(h) && !/linkedin\.com|licdn/.test(h) && !/\/(feed|company|in|school)\//.test(h));
                return a || null;
            }).catch(() => null);

            page.off('response', onResp);
            if (hits.length) {
                console.log(`  ✅ Voyager calls carrying a website:`);
                for (const h of hits.slice(0, 4)) {
                    const qid = (h.url.match(/queryId=([^&]+)/) || [])[1] || '(rest)';
                    console.log(`     queryId=${qid}`);
                    console.log(`     url=${h.url.slice(0, 160)}`);
                    console.log(`     sites=${h.sites.slice(0, 5).join(' | ')}`);
                }
            } else {
                console.log(`  ✗ no Voyager call carried a website`);
            }
            console.log(`  DOM website link: ${domSite || '(none)'}`);
            await wait(1500);
        }
    } finally {
        await browser.close().catch(() => {});
    }
})();
