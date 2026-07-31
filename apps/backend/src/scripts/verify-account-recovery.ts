/**
 * verify-account-recovery.ts
 *
 * Checks the account-health recovery wiring — bug #4 in
 * docs/user-testing-bugs-2026-07-28.md ("no auto-resume after re-login").
 *
 * `markAccountHealthy()` was always correct; it just had ONE caller
 * (login-with-otp), so a COLD re-login left accountHealth at NEEDS_LOGIN and
 * the engine's pre-flight gate kept refusing to launch. This asserts every
 * success path now calls it, and that the narrow heal rule holds.
 *
 * Static analysis, not a runtime test — no DB, browser, or network. It reads
 * the source so it keeps working when the DB is unavailable and fails loudly if
 * someone adds a session-success path without the health flip.
 *
 * Run:  npx ts-node --transpile-only src/scripts/verify-account-recovery.ts
 */
import * as fs from 'fs';
import * as path from 'path';

const SRC = path.resolve(__dirname, '..');
const read = (p: string) => fs.readFileSync(path.join(SRC, p), 'utf8');

interface Check {
    name: string;
    ok: boolean;
    detail: string;
}
const checks: Check[] = [];
const check = (name: string, ok: boolean, detail: string) => checks.push({ name, ok, detail });

// ---------------------------------------------------------------------------
// 1. Every session-success path calls markAccountHealthy
// ---------------------------------------------------------------------------
const sm = read('services/session-manager.service.ts');
const otp = read('services/login-with-otp.service.ts');
const sv = read('services/session-validator.service.ts');

check(
    'session-manager imports markAccountHealthy',
    /import\s*\{\s*markAccountHealthy\s*\}\s*from\s*'\.\.\/campaign-engine\/safety\/checkpoint'/.test(sm),
    'cold-login path needs the health flip',
);

// Two distinct success routes live in session-manager: the inline
// credential-login success, and handleSuccess() (already-logged-in / 2FA /
// app-approval). Both must flip health.
const smCalls = (sm.match(/markAccountHealthy\(userId\)/g) || []).length;
check(
    'session-manager calls markAccountHealthy on BOTH success paths',
    smCalls >= 2,
    `found ${smCalls} call(s); expected >= 2 (inline credential login + handleSuccess)`,
);

check(
    'login-with-otp still calls it (pre-existing path not regressed)',
    /markAccountHealthy\(userId\)/.test(otp),
    'the /session/refresh route depends on this',
);

check(
    'session-validator heals stale health on a confirmed-live session',
    /healStaleAccountHealth/.test(sv) && (sv.match(/healStaleAccountHealth\(/g) || []).length >= 3,
    'expected the helper plus calls from validateSession and liveCheck',
);

// ---------------------------------------------------------------------------
// 2. The heal rule is NARROW — only states a live session disproves
// ---------------------------------------------------------------------------
const healBody = sv.slice(sv.indexOf('private async healStaleAccountHealth'));
const healGuard = healBody.slice(0, healBody.indexOf('\n    }'));

check(
    'heal covers SESSION_EXPIRED + NEEDS_LOGIN',
    /SESSION_EXPIRED/.test(healGuard) && /NEEDS_LOGIN/.test(healGuard),
    'these two are directly disproved by a working session',
);
check(
    'heal does NOT touch OTP_REQUIRED / RESTRICTED',
    !/OTP_REQUIRED/.test(healGuard) && !/RESTRICTED/.test(healGuard),
    'auto-resuming a challenged account escalates the flag — must stay manual',
);
check(
    'heal short-circuits when already HEALTHY (no cost on the hourly sweep)',
    /if\s*\(currentHealth\s*!==/.test(healGuard),
    'guard must return before doing any query',
);

// ---------------------------------------------------------------------------
// 3. Ordering — session must be persisted BEFORE campaigns resume
// ---------------------------------------------------------------------------
// A resumed campaign can be picked up by a worker immediately; if health flips
// before the cookies land, that worker reads a half-written session.
const inlineIdx = sm.indexOf('linkedinProxySnapshot: proxySnapshot as any');
const inlineHeal = sm.indexOf('markAccountHealthy(userId)', inlineIdx);
check(
    'cold login: session write precedes markAccountHealthy',
    inlineIdx > 0 && inlineHeal > inlineIdx,
    'health flip can trigger an immediate campaign run',
);

const hsIdx = sm.indexOf('linkedinProxySnapshot: proxySnapshotForReval as any');
const hsHeal = sm.indexOf('markAccountHealthy(userId)', hsIdx);
check(
    'handleSuccess: session write precedes markAccountHealthy',
    hsIdx > 0 && hsHeal > hsIdx,
    'same ordering requirement',
);

// ---------------------------------------------------------------------------
// 4. Auto-resume respects 1-ACTIVE-campaign-per-user
// ---------------------------------------------------------------------------
const cp = read('campaign-engine/safety/checkpoint.ts');
const resumeBody = cp.slice(cp.indexOf('export async function markAccountHealthy'));

check(
    'auto-resume no longer blanket-flips PAUSED -> ACTIVE',
    !/updateMany\(\{\s*where:\s*\{\s*userId,\s*status:\s*'PAUSED'/.test(resumeBody),
    'a blanket updateMany could leave the user with two ACTIVE campaigns',
);
check(
    'auto-resume checks for an existing ACTIVE campaign first',
    /findFirst\(\{[\s\S]{0,120}status:\s*'ACTIVE'/.test(resumeBody),
    'the slot must be claimed only if free',
);
check(
    'overflow campaigns go to QUEUED with a queuePosition',
    /status:\s*'QUEUED'/.test(resumeBody) && /queuePosition:/.test(resumeBody),
    'queued campaigns must have a position or the FIFO order breaks',
);
check(
    'notification distinguishes resumed from queued',
    /queuedCampaignIds/.test(resumeBody) && /is queued behind/.test(resumeBody),
    'telling a user a queued campaign "resumed" sends them hunting for activity',
);

// ---------------------------------------------------------------------------
// 5. De-park still present (the 365-day defer must be undone)
// ---------------------------------------------------------------------------
check(
    'markAccountHealthy un-parks account_* deferred leads',
    /UPDATE\s+"CampaignLeadProgress"/.test(resumeBody) && /statusReason"\s+LIKE\s+'account_%'/.test(resumeBody),
    'without this a recovered user waits 365 days for the cron',
);

// ---------------------------------------------------------------------------
// 6. Bug #5 — don't hand out work the engine will refuse
// ---------------------------------------------------------------------------
// The engine's pre-flight gate already refuses a non-HEALTHY account, but by
// then we've enqueued a job, taken the per-account Redis lock, and loaded the
// user + campaign + leads + session to do nothing — 1440x/day on a 1-minute
// heartbeat. The scheduler is the right layer to stop it.
const sched = read('cron/scheduler.ts');

check(
    'heartbeat selects accountHealth',
    /accountHealth:\s*true/.test(sched),
    'cannot gate on a field it does not fetch',
);
check(
    'heartbeat skips non-HEALTHY accounts',
    /user\.accountHealth\s*!==\s*'HEALTHY'/.test(sched),
    'without this, an unhealthy user is re-queued every 60s forever',
);
check(
    'delayed-leads sweep checks the campaign owner\'s health',
    /User:\s*\{\s*select:\s*\{\s*accountHealth/.test(sched) && /accountHealth=\$\{health\}/.test(sched),
    'the 5-minute resume sweep is a second path to the same waste',
);
check(
    'owner-health lookup uses the CAPITALIZED User relation',
    /select:\s*\{[^}]*User:\s*\{/.test(sched),
    'lowercase `user` silently yields undefined in prod — the gate would never fire',
);

// ---------------------------------------------------------------------------
// 7. Bug #5 — parked leads are not failures
// ---------------------------------------------------------------------------
const types = read('campaign-engine/types.ts');
const eng = read('campaign-engine/engine.ts');
const cw = read('workers/campaign-worker.ts');

check(
    'CampaignSummary has a `parked` counter',
    /parked:\s*number/.test(types),
    'parked leads need their own bucket, separate from succeeded/failed',
);
check(
    "the 'paused' branch increments parked, NOT failed",
    /summary\.parked\+\+/.test(eng) && !/\/\/ 'paused'[\s\S]{0,400}summary\.failed\+\+/.test(eng),
    "this is the line that produced the misleading 'Succeeded: 0, Failed: 2'",
);
check(
    'worker stats line reports Parked',
    /Parked:\s*\$\{summary\.parked\}/.test(cw),
    'this is the exact log line that appeared in the user-testing report',
);

// ---------------------------------------------------------------------------
let failed = 0;
console.log('\nAccount-health recovery + gating\n' + '='.repeat(78));
for (const c of checks) {
    if (!c.ok) failed++;
    console.log(`${c.ok ? '✅' : '❌'} ${c.name}`);
    if (!c.ok) console.log(`     ${c.detail}`);
}
console.log('\n' + '='.repeat(78));
console.log(`${checks.length - failed} passed, ${failed} failed\n`);
process.exit(failed === 0 ? 0 : 1);
