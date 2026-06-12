/**
 * capture-recent-posts.ts
 *
 * Live capture of the Voyager GraphQL call LinkedIn's own UI fires to load a
 * member's recent posts — so we can learn the CURRENT queryId + variable
 * shape (the stale `voyagerIdentityDashProfileUpdates.5b87bc20…` 404s now).
 *
 * Proxy-safe by construction: launches through launchAuthenticatedContext,
 * which pins the account's stored proxy snapshot (sticky-proxy invariant).
 * PASSIVE — it only navigates and listens; it sends no writes.
 *
 *   QCAP_USER=<userId> QCAP_TARGET=https://www.linkedin.com/in/<vanity>/ \
 *     npx tsx src/scripts/capture-recent-posts.ts
 *
 * On success it prints every graphql call seen during the recent-activity
 * navigation, flags the post-bearing one, and writes the full request+body to
 * /tmp/recent-posts-capture.json for analysis.
 */
import fs from 'fs';
import { launchAuthenticatedContext } from '../campaign-engine/session-launch';

const wait = (ms: number) => new Promise(r => setTimeout(r, ms));

const userId = process.env.QCAP_USER || process.argv[2] || '';
const target = process.env.QCAP_TARGET || process.argv[3] || '';

function parseGraphql(url: string) {
    const queryId = url.match(/queryId=([A-Za-z]+\.[a-f0-9]+)/)?.[1] || null;
    const variables = url.match(/variables=(\([^&]*\)|[^&]+)/)?.[1] || null;
    return { queryId, variables };
}

// Heuristic: does this graphql body look like it carries posts?
function looksLikePosts(body: string): boolean {
    return /commentary|socialDetail|updateMetadata|feedTopic|UpdateV2|"shareUrn"|reshare|numLikes|"text":\{/.test(body);
}

(async () => {
    if (!userId || !target) {
        console.error('Usage: QCAP_USER=<userId> QCAP_TARGET=<profileUrl> npx tsx src/scripts/capture-recent-posts.ts');
        process.exit(2);
    }

    console.log(`[capture] user=${userId} target=${target}`);
    const launch = await launchAuthenticatedContext(userId);
    if (!launch.ok) {
        console.error(`[capture] launch failed at ${launch.failedAt}: ${launch.error}`);
        process.exit(1);
    }
    console.log(`[capture] launched via proxy ${launch.proxyServer}`);
    const { browser, context, page } = launch;

    const seen: Array<{ queryId: string | null; variables: string | null; status: number; isPosts: boolean; bodyLen: number; bodySnippet: string; url: string; body?: string }> = [];

    page.on('request', (req: any) => {
        const u = req.url();
        if (u.includes('/voyager/api/')) console.log(`   →REQ ${u.slice(0, 140)}`);
    });
    page.on('response', async (resp: any) => {
        const url = resp.url();
        if (!url.includes('/voyager/api/')) return;
        let body = '';
        try { body = await resp.text(); } catch { /* streamed/aborted */ }
        const { queryId, variables } = parseGraphql(url);
        const isPosts = looksLikePosts(body);
        seen.push({ queryId, variables, status: resp.status(), isPosts, bodyLen: body.length, bodySnippet: body.slice(0, 300), url, body });
        console.log(`  ${isPosts ? '★POSTS' : '      '} [${resp.status()}] ${queryId || (url.split('/voyager/api/')[1] || '').slice(0, 60)}  vars=${(variables || '').slice(0, 70)}`);
    });

    // Feed-first: a cold browser hitting a deep /recent-activity link gets
    // authwalled. Land on /feed to establish the in-app session, then visit
    // the profile base, THEN the activity pages — same warmup the engine does.
    console.log('\n[capture] warmup → /feed/');
    await page.goto('https://www.linkedin.com/feed/', { waitUntil: 'domcontentloaded', timeout: 60000 }).catch(() => {});
    await wait(5000);
    console.log(`[capture] feed landed url=${page.url()} title="${await page.title().catch(() => '?')}"`);
    await page.mouse.wheel(0, 1200); await wait(2000);

    const base = target.replace(/\/$/, '');
    console.log(`[capture] visiting profile ${base}`);
    await page.goto(base, { waitUntil: 'domcontentloaded', timeout: 60000 }).catch(() => {});
    await wait(4000);

    for (const path of ['/recent-activity/all/', '/recent-activity/shares/']) {
        const navUrl = base + path;
        console.log(`\n[capture] navigating ${navUrl}`);
        try {
            await page.goto(navUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });
            await wait(4000);
            // Scroll to trigger lazy-loaded post fetches.
            for (let i = 0; i < 4; i++) { await page.mouse.wheel(0, 1400); await wait(1500); }
            await wait(2000);
            const title = await page.title().catch(() => '?');
            console.log(`[capture] landed url=${page.url()} title="${title}"`);
            const shot = `/tmp/capture_${path.replace(/[^a-z]/gi, '_')}.png`;
            await page.screenshot({ path: shot, fullPage: false }).catch(() => {});
        } catch (err: any) {
            console.warn(`[capture] nav error: ${err.message}`);
        }
    }

    const postCalls = seen.filter(s => s.isPosts && s.status === 200);
    console.log(`\n[capture] ${seen.length} graphql/feed calls seen, ${postCalls.length} look like posts.`);
    if (postCalls.length) {
        console.log('\n=== POST-BEARING CALLS ===');
        for (const c of postCalls) {
            console.log(`queryId : ${c.queryId}`);
            console.log(`variables: ${c.variables}`);
            console.log(`bodyLen : ${c.bodyLen}`);
        }
    } else {
        console.log('[capture] No post-bearing call detected — profile may have no posts, or the UI structure changed. Inspect the dump.');
    }

    fs.writeFileSync('/tmp/recent-posts-capture.json', JSON.stringify(seen, null, 1));
    console.log('\n[capture] full dump → /tmp/recent-posts-capture.json');

    await context.close().catch(() => {});
    await browser.close().catch(() => {});
    process.exit(0);
})();
