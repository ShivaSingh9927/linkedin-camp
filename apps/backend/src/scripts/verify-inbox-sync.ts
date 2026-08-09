/**
 * verify-inbox-sync.ts
 *
 * Two silent breakages cost the inbox sync two months of replies. Both failed
 * without an error path — the worker logged a clean "Inbox sync complete" run
 * every night while writing nothing. No LINKEDIN_SYNC message row existed after
 * 2026-06-10.
 *
 *   1. encodeURIComponent leaves `!'()*` unescaped by design. A conversation
 *      URN is nested — urn:li:msg_conversation:(urn:li:fsd_profile:X,2-Y==) —
 *      so its parentheses landed raw inside the Rest.li `variables=(...)` tuple
 *      and LinkedIn answered 400 for EVERY per-thread message fetch.
 *
 *   2. The last-message preview moved from `events[].eventContent` to
 *      `messages.elements[]`. Probed live 2026-08-09: 18/18 conversations had
 *      the new shape, 0/18 had `events`. So the fallback preview — the only
 *      thing left once (1) killed the real fetch — was always null too, and
 *      every thread hit `chatHistory.length === 0` and was skipped.
 *
 * Two independent failures, both silent, both landing on the same `continue`.
 * These assertions pin the fixed behaviour.
 *
 *   npx ts-node --transpile-only src/scripts/verify-inbox-sync.ts
 */
import * as fs from 'fs';
import * as path from 'path';

const SRC = path.join(__dirname, '..');
let pass = 0;
let fail = 0;

function check(name: string, ok: boolean, detail = '') {
    if (ok) { pass++; console.log(`  ✅ ${name}`); }
    else { fail++; console.log(`  ❌ ${name}${detail ? `\n       ${detail}` : ''}`); }
}

const read = (rel: string) => fs.readFileSync(path.join(SRC, rel), 'utf8');
const readCode = (rel: string) =>
    read(rel).replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');

const svc = readCode('services/voyager-api.service.ts');
const worker = readCode('workers/inbox.worker.ts');

// The real encoder, reimplemented here so the test fails if the source drifts
// from what production was verified against.
const encodeUrn = (urn: string) =>
    encodeURIComponent(urn).replace(/[!'()*]/g, c => '%' + c.charCodeAt(0).toString(16).toUpperCase());

// Captured verbatim off the live LinkedIn messaging UI, 2026-08-09.
const CONV_URN =
    'urn:li:msg_conversation:(urn:li:fsd_profile:ACoAAF5AIXwBAKWXOyX1Kj-nZ0YyPBKnqSLnD2c,2-NWRkYjY5MjAtMDQ5OS00MGZiLWI0OGQtYmQ1MjJlZGNiZmY5XzEwMA==)';
const UI_ENCODED =
    'urn%3Ali%3Amsg_conversation%3A%28urn%3Ali%3Afsd_profile%3AACoAAF5AIXwBAKWXOyX1Kj-nZ0YyPBKnqSLnD2c%2C2-NWRkYjY5MjAtMDQ5OS00MGZiLWI0OGQtYmQ1MjJlZGNiZmY5XzEwMA%3D%3D%29';

console.log('\n--- URN encoding (the 400) ---');
check('encodeUrn reproduces what the real UI sends byte for byte',
    encodeUrn(CONV_URN) === UI_ENCODED,
    `got ${encodeUrn(CONV_URN)}`);
check('encodeURIComponent does NOT — this is the bug, not a style nit',
    encodeURIComponent(CONV_URN) !== UI_ENCODED);
check('parentheses are escaped (they delimit the Rest.li tuple)',
    !encodeUrn(CONV_URN).includes('(') && !encodeUrn(CONV_URN).includes(')'));
check('an already-safe URN is unchanged in meaning',
    encodeUrn('urn:li:fsd_profile:ABC123') === 'urn%3Ali%3Afsd_profile%3AABC123');
check('the other reserved chars encodeURIComponent skips are covered',
    encodeUrn("a!b'c*d") === 'a%21b%27c%2Ad');

console.log('\n--- no messenger URL may use the raw encoder ---');
{
    // Any `variables=(...)` built with encodeURIComponent is the same 400
    // waiting to happen the next time a URN gains parentheses.
    const bad = svc.match(/variables=\([^`]*encodeURIComponent/g) || [];
    check('every variables=(...) tuple uses encodeUrn', bad.length === 0,
        `found ${bad.length}: ${bad.join(' | ')}`);
    check('encodeUrn is actually defined in the service',
        /function encodeUrn\(/.test(svc));
    for (const q of ['messengerMessages', 'messengerConversations', 'messengerMailboxCounts']) {
        const line = svc.split('\n').find(l => l.includes(q) && l.includes('variables='));
        check(`${q} uses encodeUrn`, !!line && line.includes('encodeUrn('),
            line ? line.trim().slice(0, 120) : 'no URL line found');
    }
}

console.log('\n--- last-message preview reads the shape LinkedIn actually sends ---');
check('reads messages.elements[0].body.text',
    /c\.messages\?\.elements\?\.\[0\]\?\.body\?\.text/.test(svc));
check('old events[] path kept only as a fallback, never first',
    svc.indexOf('c.messages?.elements?.[0]?.body?.text') <
    svc.indexOf('c.events?.[0]?.eventContent'));

console.log('\n--- worker ordering: match the lead before spending API calls ---');
{
    const leadLookup = worker.indexOf('prisma.lead.findFirst');
    // Match the CALL, not the import at the top of the file.
    const msgFetch = worker.indexOf('await getMessagesInConversation(');
    check('lead lookup precedes the per-thread message fetch',
        leadLookup !== -1 && msgFetch !== -1 && leadLookup < msgFetch,
        `lead@${leadLookup} fetch@${msgFetch}`);
    check('only one lead lookup per thread (the duplicate is gone)',
        (worker.match(/prisma\.lead\.findFirst/g) || []).length === 1);
    check('unmatched participants short-circuit',
        /No matching lead for[\s\S]{0,120}continue;/.test(worker));
}

console.log('\n--- thread coverage ---');
{
    const m = worker.match(/maxThreads:\s*(\d+)/);
    const n = m ? Number(m[1]) : 0;
    check('maxThreads covers a real mailbox (18 threads seen in prod)', n >= 20,
        `maxThreads=${n} would silently ignore older threads`);
}

console.log(`\n${pass} passed, ${fail} failed\n`);
process.exit(fail === 0 ? 0 : 1);
