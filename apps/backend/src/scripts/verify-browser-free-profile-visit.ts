/**
 * verify-browser-free-profile-visit.ts
 *
 * Truth table for the "does profile-visit need Chromium?" decision.
 *
 * This matters because the decision is made TWICE: the engine calls
 * profileVisitNeedsDom() to decide whether to launch a browser, and the Voyager
 * node calls effectiveEnrichPosts() to decide whether to scrape. If those ever
 * disagree we either pay for Chromium we never touch, or try to scrape with a
 * null page. Both directions are asserted below.
 *
 * Pure functions only — no DB, no network, no browser.
 *
 *   npx ts-node --transpile-only src/scripts/verify-browser-free-profile-visit.ts
 */
import {
    postsCoveredLater,
    effectiveEnrichPosts,
    profileVisitNeedsDom,
    POST_READING_NODES,
} from '../campaign-engine/nodes/read-backend';
import { CampaignFlowNode } from '../campaign-engine/types';

let pass = 0;
let fail = 0;

function check(name: string, actual: any, expected: any) {
    const ok = JSON.stringify(actual) === JSON.stringify(expected);
    if (ok) { pass++; console.log(`  ✅ ${name}`); }
    else { fail++; console.log(`  ❌ ${name}\n       expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`); }
}

const n = (node: string, extra: any = {}): CampaignFlowNode => ({ node, ...extra } as any);

console.log('\n--- postsCoveredLater: only nodes AFTER the index count ---');
{
    const flow = [n('profile-visit', { enrichPosts: true }), n('delay'), n('comment-nth-post')];
    check('comment later in flow -> covered', postsCoveredLater(flow, 0), true);
    check('from the comment index itself -> not covered', postsCoveredLater(flow, 2), false);

    // A comment BEFORE profile-visit must not suppress the scrape: it already ran,
    // possibly days ago, and cannot populate a later profile-visit's output.
    const before = [n('comment-nth-post'), n('profile-visit', { enrichPosts: true })];
    check('comment BEFORE profile-visit -> not covered', postsCoveredLater(before, 1), false);

    check('like counts too', postsCoveredLater([n('profile-visit'), n('like-nth-post')], 0), true);
    check('message does not count', postsCoveredLater([n('profile-visit'), n('send-message')], 0), false);
    check('empty tail', postsCoveredLater([n('profile-visit')], 0), false);
    check('non-array flow is safe', postsCoveredLater(undefined as any, 0), false);
    check('post-reading set is exactly comment+like',
        [...POST_READING_NODES].sort(), ['comment-nth-post', 'like-nth-post']);
}

console.log('\n--- effectiveEnrichPosts ---');
{
    check('enrichPosts off', effectiveEnrichPosts(n('profile-visit'), false), false);
    check('enrichPosts on, not covered -> scrape', effectiveEnrichPosts(n('profile-visit', { enrichPosts: true }), false), true);
    check('enrichPosts on, covered -> skip', effectiveEnrichPosts(n('profile-visit', { enrichPosts: true }), true), false);
    check('covered but enrichPosts off -> still false', effectiveEnrichPosts(n('profile-visit'), true), false);
}

console.log('\n--- profileVisitNeedsDom ---');
{
    check('plain profile-visit -> BROWSER-FREE', profileVisitNeedsDom(n('profile-visit'), false), false);
    check('enrichExperience only -> BROWSER-FREE (pure API)',
        profileVisitNeedsDom(n('profile-visit', { enrichExperience: true }), false), false);
    check('enrichContact -> needs DOM (contact card is API-redacted)',
        profileVisitNeedsDom(n('profile-visit', { enrichContact: true }), false), true);
    check('enrichPosts, not covered -> needs DOM',
        profileVisitNeedsDom(n('profile-visit', { enrichPosts: true }), false), true);
    check('enrichPosts, covered later -> BROWSER-FREE',
        profileVisitNeedsDom(n('profile-visit', { enrichPosts: true }), true), false);
    check('explicit dom backend -> needs DOM',
        profileVisitNeedsDom(n('profile-visit', { backend: 'dom' }), false), true);
    check('dom backend ignored for the explicit -voyager node type',
        profileVisitNeedsDom(n('profile-visit-voyager', { backend: 'dom' }), false, true), false);
    check('enrichContact still wins on -voyager node type',
        profileVisitNeedsDom(n('profile-visit-voyager', { enrichContact: true }), false, true), true);
}

console.log('\n--- the invariant: the two decisions must never disagree ---');
{
    // If the engine skips the browser, the node must not want to scrape; if the
    // node wants to scrape, the engine must have launched a browser.
    for (const enrichPosts of [true, false]) {
        for (const enrichContact of [true, false]) {
            for (const covered of [true, false]) {
                const cfg = n('profile-visit', { enrichPosts, enrichContact });
                const needsDom = profileVisitNeedsDom(cfg, covered);
                const willScrape = effectiveEnrichPosts(cfg, covered);
                const label = `posts=${enrichPosts} contact=${enrichContact} covered=${covered}`;
                if (willScrape && !needsDom) {
                    fail++; console.log(`  ❌ ${label}: node would scrape with no browser`);
                } else if (!needsDom && (enrichContact || willScrape)) {
                    fail++; console.log(`  ❌ ${label}: DOM work requested but browser skipped`);
                } else {
                    pass++; console.log(`  ✅ ${label} -> browser=${needsDom} scrape=${willScrape}`);
                }
            }
        }
    }
}

console.log(`\n${pass} passed, ${fail} failed\n`);
process.exit(fail === 0 ? 0 : 1);
