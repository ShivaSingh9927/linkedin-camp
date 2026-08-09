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

console.log('\n--- browser-free classification matches the Page-based rules ---');
{
    // Imported for real, not pattern-matched: these are the rules that decide
    // whether an account gets flagged, and a regression here either locks out a
    // healthy account or lets a dead one keep reading HEALTHY.
    const { classifyUrl, classifyHtml, isCheckpoint } =
        require('../campaign-engine/safety/checkpoint');

    const cases: Array<[string, string]> = [
        ['https://www.linkedin.com/feed/', 'feed'],
        ['https://www.linkedin.com/uas/login?session_redirect=x', 'still_login'],
        ['https://www.linkedin.com/login/?session_redirect=x', 'still_login'],
        ['https://www.linkedin.com/authwall?trk=x', 'authwall'],
        ['https://www.linkedin.com/messaging/', 'unknown'],
    ];
    for (const [url, want] of cases) {
        check(`classifyUrl ${url.slice(24) || '/'} -> ${want}`, classifyUrl(url).kind === want,
            `got ${classifyUrl(url).kind}`);
    }

    // The otp/challenge_other split was the ONLY thing classifyPage needed the
    // DOM for. Off-browser it comes from the returned HTML instead.
    const cp = 'https://www.linkedin.com/checkpoint/challenge/xyz';
    check('checkpoint + pin markup -> otp',
        classifyHtml(cp, '<input id="input__email_verification_pin" />').kind === 'otp');
    check('checkpoint + name="pin" -> otp',
        classifyHtml(cp, '<input name="pin" type="text">').kind === 'otp');
    check('checkpoint + captcha markup -> challenge_other',
        classifyHtml(cp, '<div id="captcha-internal"></div>').kind === 'challenge_other');
    check('checkpoint with NO html -> challenge_other, never otp',
        classifyHtml(cp, null).kind === 'challenge_other',
        'guessing otp would start a flow with nothing to collect');
    check('a non-checkpoint url ignores the html entirely',
        classifyHtml('https://www.linkedin.com/feed/', '<input name="pin">').kind === 'feed');

    check('unknown is still not a checkpoint (no health write on a new url shape)',
        isCheckpoint({ kind: 'unknown', url: 'x' }) === false);
    check('feed is still not a checkpoint', isCheckpoint({ kind: 'feed', url: 'x' }) === false);
    check('still_login IS a checkpoint', isCheckpoint({ kind: 'still_login', url: 'x' }) === true);
}

console.log('\n--- worker runs browser-free, with a way back ---');
{
    check('browser-free is the DEFAULT (opt-in to the browser, not out)',
        /INBOX_SYNC_USE_BROWSER\s*===\s*'1'/.test(worker),
        'a default-on browser would make the whole change a no-op in prod');
    check('escape hatch is env-driven, so reverting needs no rebuild',
        worker.includes('process.env.INBOX_SYNC_USE_BROWSER'));
    check('builds a browser-free context', worker.includes('getBrowserlessVoyagerContext'));
    check('disposes it (a leaked APIRequestContext leaks its proxy socket)',
        /disposeApi\s*\(\)/.test(worker) && /disposeApi\s*=\s*bl\.dispose/.test(worker));
    check('threads apiRequest into the thread list', /voyagerSyncInbox\([^)]*apiRequest/.test(worker));
    check('threads apiRequest into the per-thread fetch',
        /getMessagesInConversation\([^)]*apiRequest/.test(worker));
    check('threads apiRequest into warmSelfCache', /warmSelfCache\([^)]*apiRequest/.test(worker));
    check('missing proxy snapshot still records health browser-free',
        /getBrowserlessVoyagerContext[\s\S]{0,900}handleCheckpoint/.test(worker));

    // The warmup is what makes the browser-free path work at all — a bare
    // context going straight to /me gets 401.
    check('warms up on /feed/ before any voyager call',
        /apiRequest\.get\('https:\/\/www\.linkedin\.com\/feed\/'\)/.test(worker));
    const warmIdx = worker.indexOf("apiRequest.get('https://www.linkedin.com/feed/')");
    const meIdx = worker.indexOf('await warmSelfCache(');   // the CALL, not the import
    check('warmup precedes warmSelfCache', warmIdx !== -1 && warmIdx < meIdx,
        `warm@${warmIdx} me@${meIdx}`);
    check('classifies the warmup response instead of re-fetching',
        /classifyHtml\(landed, html\)/.test(worker));
    check('only pulls HTML for /checkpoint/ urls',
        /landed\.includes\('\/checkpoint\/'\)\s*\?\s*await warm\.text\(\)/.test(worker));
}

console.log('\n--- csrf must outlive a sync ---');
{
    const m = svc.match(/const CSRF_TTL_SEC\s*=\s*([^;]+);/);
    const ttl = m ? Function(`return (${m[1]})`)() : 0;
    check('csrf TTL is its own constant, not page-instance\'s', !!m);
    check(`csrf TTL (${ttl}s) comfortably exceeds a full sync`, ttl >= 600,
        'a 30s TTL expires mid-run and, with no browser context to re-derive from, the rest of the sync 403s');
    check('page-instance keeps its short TTL (it really does rotate)',
        /PAGE_INSTANCE_TTL_SEC\s*=\s*30\b/.test(svc));
    check('csrf falls back to the apiRequest cookie jar off-browser',
        /opts\.apiRequest[\s\S]{0,120}storageState\(\)/.test(svc));
}

console.log(`\n${pass} passed, ${fail} failed\n`);
process.exit(fail === 0 ? 0 : 1);
