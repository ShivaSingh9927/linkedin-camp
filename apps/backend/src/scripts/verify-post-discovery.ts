/**
 * verify-post-discovery.ts
 *
 * The like/comment nodes used to carry a copy-pasted DOM post-discovery block.
 * The two copies drifted, and both had the same latent bug: they indexed into
 * `data-urn` wrappers WITHOUT deduping, so a post whose wrapper is repeated /
 * nested made "post #2" silently resolve to a duplicate of "post #1".
 *
 * This verifies the fix two ways:
 *   1. Static — both nodes consume the single shared helper, the inline block
 *      is gone, and the hardening (dedupe + anchor-merge + canary) is present.
 *   2. Functional — the REAL `extractOrderedPostUrns` (same function prod ships
 *      into page.evaluate) run in a headless Chromium against a fixture feed
 *      that contains a nested duplicate wrapper, an anchor-only post, and a
 *      comment permalink that must be ignored. Zero LinkedIn contact.
 *
 *   node .verify-tmp/scripts/verify-post-discovery.js      (see runner below)
 */
import * as fs from 'fs';
import * as path from 'path';
import { chromium } from 'playwright';
import { extractOrderedPostUrns } from '../campaign-engine/nodes/post-discovery';

// Resolve source files from the real src/ (run this from apps/backend), so
// the static reads work whether launched via ts-node or a compiled temp copy.
const SRC = path.join(process.cwd(), 'src');
let pass = 0, fail = 0;
const check = (name: string, ok: boolean, detail = '') =>
    ok ? (pass++, console.log(`  ✅ ${name}`)) : (fail++, console.log(`  ❌ ${name}${detail ? `\n       ${detail}` : ''}`));

const read = (rel: string) => fs.readFileSync(path.join(SRC, rel), 'utf8');
const readCode = (rel: string) =>
    read(rel).replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');

const helper = readCode('campaign-engine/nodes/post-discovery.ts');
const comment = readCode('campaign-engine/nodes/comment-nth-post.ts');
const like = readCode('campaign-engine/nodes/like-nth-post.ts');

console.log('\n--- both nodes use the ONE shared helper ---');
check('comment node imports discoverNthPostUrl', /import\s*\{[^}]*discoverNthPostUrl[^}]*\}\s*from\s*'\.\/post-discovery'/.test(comment));
check('like node imports discoverNthPostUrl', /import\s*\{[^}]*discoverNthPostUrl[^}]*\}\s*from\s*'\.\/post-discovery'/.test(like));
check('comment node calls the helper', /await discoverNthPostUrl\(/.test(comment));
check('like node calls the helper', /await discoverNthPostUrl\(/.test(like));
check('no copy-pasted inline discovery left in comment node',
    !comment.includes("'/recent-activity/shares/'"),
    'the activity-feed URL should only exist inside the shared helper now');
check('no copy-pasted inline discovery left in like node',
    !like.includes("'/recent-activity/shares/'"),
    'the activity-feed URL should only exist inside the shared helper now');

console.log('\n--- the hardening is actually in the helper ---');
check('dedupes by URN value (the index-drift fix)', /new Set<string>\(\)/.test(helper) && /seen\.has\(/.test(helper));
check('merges the anchor-href fallback into the same list', /a\[href\*="\/feed\/update\/urn:li:"\]/.test(helper));
check('skips comment permalinks (?commentUrn=)', /\?commentUrn=/.test(helper));
check('emits a POST-DISCOVERY canary on miss', /\[POST-DISCOVERY\]/.test(helper));
check('extractOrderedPostUrns is exported (single source, no drift)', /export function extractOrderedPostUrns/.test(helper));

// -----------------------------------------------------------------------------
// Functional: run the REAL extractor in a real browser against a fixture feed.
// -----------------------------------------------------------------------------
// Post AAA has a NESTED duplicate wrapper (the drift trap) + its own anchor.
// Post BBB is a plain ugcPost wrapper. Post CCC exists ONLY as an anchor.
// ZZZ is a comment permalink that must never be picked.
const FIXTURE = `<!doctype html><html><body>
  <div data-urn="urn:li:activity:AAA">
    <div data-urn="urn:li:activity:AAA"><span>nested duplicate wrapper</span></div>
    <a href="https://www.linkedin.com/feed/update/urn:li:activity:AAA/">post A permalink</a>
  </div>
  <div data-urn="urn:li:ugcPost:BBB"><p>post B</p></div>
  <a href="https://www.linkedin.com/feed/update/urn:li:activity:ZZZ/?commentUrn=urn:li:comment:12345">a comment, not a post</a>
  <a href="https://www.linkedin.com/feed/update/urn:li:activity:CCC/">post C (anchor only)</a>
</body></html>`;

async function functional() {
    console.log('\n--- functional: real extractor in headless Chromium ---');
    let browser;
    try {
        browser = await chromium.launch({ headless: true });
    } catch (e: any) {
        console.log(`  ⚠️  Chromium unavailable (${e.message.split('\n')[0]}) — skipping functional checks.`);
        return;
    }
    try {
        const page = await browser.newPage();
        await page.setContent(FIXTURE, { waitUntil: 'domcontentloaded' });

        const r1 = await page.evaluate(extractOrderedPostUrns, 1);
        const r2 = await page.evaluate(extractOrderedPostUrns, 2);
        const r3 = await page.evaluate(extractOrderedPostUrns, 3);
        const r4 = await page.evaluate(extractOrderedPostUrns, 4);

        check('counts exactly 3 distinct posts (nested dup + comment excluded)', r1.count === 3, `got count=${r1.count}`);
        check('post #1 = AAA', r1.urn === 'urn:li:activity:AAA', `got ${r1.urn}`);
        check('post #2 = BBB (NOT a duplicate of AAA — the core fix)', r2.urn === 'urn:li:ugcPost:BBB', `got ${r2.urn}`);
        check('post #3 = CCC (anchor-only post merged into the list)', r3.urn === 'urn:li:activity:CCC', `got ${r3.urn}`);
        check('post #4 = null (out of range, not a wraparound)', r4.urn === null, `got ${r4.urn}`);
        check('comment permalink ZZZ never picked', ![r1.urn, r2.urn, r3.urn].includes('urn:li:activity:ZZZ'));
    } finally {
        await browser.close();
    }
}

functional()
    .catch((e) => { console.error(e); fail++; })
    .finally(() => {
        console.log(`\n${pass} passed, ${fail} failed\n`);
        process.exit(fail === 0 ? 0 : 1);
    });
