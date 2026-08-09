/**
 * verify-inbox-health-recording.ts
 *
 * The inbox worker gets the single strongest signal in the system — LinkedIn
 * bouncing an authenticated navigation to a login wall — and used to throw it
 * away, logging it and writing a notification but never recording the health
 * change. Five accounts were sitting at accountHealth=HEALTHY on 2026-08-09
 * while LinkedIn bounced them nightly; one had been stale since June.
 *
 * These assertions pin the fix in place: detection must WRITE, must use the
 * canonical classifier rather than ad-hoc URL substring matching, and must not
 * reinstate the per-night notification spam (257 + 63 rows accumulated).
 *
 *   npx ts-node --transpile-only src/scripts/verify-inbox-health-recording.ts
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
/** Comments deliberately describe the OLD broken shape; assert against code. */
const readCode = (rel: string) =>
    read(rel).replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');

const worker = readCode('workers/inbox.worker.ts');

console.log('\n--- detection must RECORD, not just log ---');
check('stripper left real code (guards a vacuous test)',
    worker.includes('launchAuthenticatedContext') && worker.includes('INBOX-WORKER'));
check('calls handleCheckpoint', worker.includes('handleCheckpoint'));
check('uses the canonical classifier', worker.includes('classifyPage') && worker.includes('isCheckpoint'));
check('no ad-hoc URL substring matching for session state',
    !/feedUrl\.includes\(/.test(worker),
    'URL substring matching bypasses classifyPage and cannot tell otp from authwall from login.');

console.log('\n--- the notification spam must not come back ---');
check('no bespoke "Inbox Sync Failed" notification (257 rows accumulated)',
    !worker.includes('Inbox Sync Failed'));
check('no bespoke "Inbox Sync Skipped" notification (63 rows accumulated)',
    !worker.includes('Inbox Sync Skipped'));
check('proxy-snapshot-missing also routed through handleCheckpoint',
    /proxy-snapshot-missing[\s\S]{0,400}handleCheckpoint/.test(worker));

console.log('\n--- handleCheckpoint still provides what this relies on ---');
{
    const cp = read('campaign-engine/safety/checkpoint.ts');
    check('sets sessionInvalid (so the 4am sweep stops re-driving the account)',
        /sessionInvalid:\s*true/.test(cp));
    check('sets accountHealth per kind', /accountHealth:\s*health/.test(cp));
    check('notifies only on transition (this is what kills the spam)',
        /transitioning\s*=\s*current\?\.accountHealth\s*!==\s*health/.test(cp) && /if\s*\(transitioning\)/.test(cp));
    check('maps authwall -> SESSION_EXPIRED', /authwall:\s*'SESSION_EXPIRED'/.test(cp));
    check('maps still_login -> NEEDS_LOGIN', /still_login:\s*'NEEDS_LOGIN'/.test(cp));
    check('maps otp -> OTP_REQUIRED', /otp:\s*'OTP_REQUIRED'/.test(cp));
    check('campaignId/leadId optional, so a non-campaign caller can use it',
        /campaignId\?:\s*string/.test(cp) && /leadId\?:\s*string/.test(cp));
}

console.log('\n--- isCheckpoint gate: bail on challenges, proceed on a real feed ---');
{
    const cp = read('campaign-engine/safety/checkpoint.ts');
    // 'unknown' must NOT trigger a health write — an unrecognised page is not
    // evidence of a dead session, and writing NEEDS_LOGIN on it would lock out
    // healthy accounts whenever LinkedIn ships a new URL shape.
    check('isCheckpoint excludes both feed and unknown',
        /kind\s*!==\s*'feed'\s*&&\s*info\.kind\s*!==\s*'unknown'/.test(cp.replace(/info\.kind\s*!==\s*'feed'/, "kind !== 'feed'")));
    check('handleCheckpoint no-ops on a kind with no health mapping',
        /if\s*\(!health\)[\s\S]{0,120}return;/.test(cp));
}

console.log(`\n${pass} passed, ${fail} failed\n`);
process.exit(fail === 0 ? 0 : 1);
