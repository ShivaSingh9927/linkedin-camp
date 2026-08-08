/**
 * verify-sticky-proxy.ts
 *
 * Guards the load-bearing invariant: every runtime path that carries a user's
 * LinkedIn session MUST egress through that user's pinned dedicated-ISP proxy
 * (`linkedinProxySnapshot`), applied at Playwright LAUNCH level.
 *
 * This exists because the failure is silent and expensive. withdraw.worker.ts
 * read `(user as any).proxy` behind a `@ts-ignore` — a value that was ALWAYS
 * undefined, since findUnique loads no relations and the relation is named
 * `Proxy` anyway. It therefore launched with NO proxy, injected real cookies,
 * and browsed LinkedIn from the datacenter IP. tsc couldn't see it, the job
 * reported success, and it destroyed a session every night for weeks.
 *
 * So: source-level assertions over every launch site. Adding a new
 * `chromium.launch` that touches a session should fail this until it either
 * goes through launchAuthenticatedContext or pins the snapshot itself.
 *
 *   npx ts-node --transpile-only src/scripts/verify-sticky-proxy.ts
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

/**
 * Source with comments removed.
 *
 * The "must not contain X" assertions below have to test CODE, not prose —
 * these files deliberately document the old broken patterns (`(user as any).proxy`,
 * `@ts-ignore`) in their headers so the next reader knows why the current shape
 * matters. Matching raw text would flag the explanation as the defect.
 */
const readCode = (rel: string) =>
    read(rel)
        .replace(/\/\*[\s\S]*?\*\//g, '')   // block comments
        .replace(/(^|[^:])\/\/.*$/gm, '$1'); // line comments (":" guard keeps http:// intact)

// Walk every runtime .ts file (scripts/ are dev tools, not runtime paths).
function walk(dir: string, out: string[] = []): string[] {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
        const p = path.join(dir, e.name);
        if (e.isDirectory()) {
            if (e.name === 'scripts' || e.name === 'node_modules') continue;
            walk(p, out);
        } else if (e.name.endsWith('.ts')) out.push(p);
    }
    return out;
}

console.log('\n--- the canonical launcher still enforces the invariant ---');
{
    const s = read('campaign-engine/session-launch.ts');
    check('pins linkedinProxySnapshot', s.includes('linkedinProxySnapshot'));
    check('applies proxy at LAUNCH level', /launchOptions\.proxy\s*=/.test(s));
    check('ABORTS when no snapshot (never falls back to another IP)',
        s.includes('proxy-snapshot-missing'));
}

console.log('\n--- every runtime browser launch is accounted for ---');
{
    const files = walk(SRC).filter(f => !f.endsWith('verify-sticky-proxy.ts'));
    const launchers: string[] = [];
    for (const f of files) {
        const s = fs.readFileSync(f, 'utf8');
        if (/chromium\.launch(PersistentContext)?\s*\(/.test(s)) {
            launchers.push(path.relative(SRC, f));
        }
    }

    // Known launch sites and why each is allowed to build its own launch.
    const ALLOWED: Record<string, string> = {
        'campaign-engine/session-launch.ts': 'the canonical launcher itself',
        'services/session-manager.service.ts': 'COLD LOGIN — establishes the snapshot, so none exists yet',
        'services/login-with-otp.service.ts': 'RE-LOGIN — proxy passed in by the caller at launch level',
        'services/session-validator.service.ts': 'pins the snapshot at launch level itself',
        'workers/linkedin.worker.ts': 'dormant legacy worker; pins the snapshot at launch level itself',
    };

    for (const rel of launchers) {
        if (ALLOWED[rel]) {
            check(`${rel} — known (${ALLOWED[rel]})`, true);
        } else {
            check(`${rel} — UNREVIEWED launch site`, false,
                'Route it through launchAuthenticatedContext, or pin linkedinProxySnapshot at launch level and add it to ALLOWED with a reason.');
        }
    }
    check('no launch site disappeared from the audit', launchers.length >= 5,
        `found ${launchers.length}, expected >= 5`);
}

console.log('\n--- session-bearing workers use the canonical launcher ---');
{
    for (const rel of ['workers/inbox.worker.ts', 'workers/withdraw.worker.ts', 'services/self-enrichment.service.ts']) {
        const s = read(rel);
        check(`${rel} calls launchAuthenticatedContext`, s.includes('launchAuthenticatedContext'));
        check(`${rel} does not hand-roll chromium.launch`, !/chromium\.launch\s*\(/.test(s));
    }
}

console.log('\n--- the exact defects that caused the nightly session loss ---');
{
    // Self-check: a comment stripper that ate the whole file would make every
    // "must not contain" assertion below pass vacuously. Prove it left code.
    const stripped = readCode('workers/withdraw.worker.ts');
    check('comment stripper preserves code (guards against a vacuous test)',
        stripped.includes('launchAuthenticatedContext') && stripped.includes('withdrawOldInvites'));
    check('comment stripper actually removes prose',
        !stripped.includes('HISTORY — why this file is written the way it is'));

    const w = stripped;
    check('withdraw: no `(user as any).proxy` (relation is `Proxy`, and was never loaded)',
        !/\(user as any\)\.proxy\b/.test(w));
    check('withdraw: no @ts-ignore hiding the launch config', !w.includes('@ts-ignore'));
    check('withdraw: no random UA (must use the pinned fingerprint)',
        !w.includes('getRandomUserAgent'));
    check('withdraw: refuses when session is invalid / not HEALTHY',
        w.includes('sessionInvalid') && w.includes('accountHealth'));
    check('withdraw: distinguishes authwall from "no invitations"',
        w.includes('authwall'));

    const sched = read('cron/scheduler.ts');
    check('auto-withdraw cron is opt-in (ENABLE_AUTO_WITHDRAW)',
        sched.includes('ENABLE_AUTO_WITHDRAW'));
}

console.log('\n--- browser-free reads are pinned too ---');
{
    const v = read('services/voyager-api.service.ts');
    check('getBrowserlessVoyagerContext uses the snapshot', v.includes('linkedinProxySnapshot'));
    check('...and refuses to build without it', /refusing to build/.test(v));
    check('...and passes proxy into request.newContext',
        /request\.newContext\(\{[\s\S]{0,400}proxy:/.test(v));
}

console.log('\n--- session-validator no longer context-only / current-assignment ---');
{
    const s = read('services/session-validator.service.ts');
    check('pins the snapshot, not getOrAssignProxy', s.includes('linkedinProxySnapshot'));
    check('proxy applied at LAUNCH level', /launchOptions\.proxy\s*=/.test(s));
    check('getOrAssignProxy no longer imported', !/^import .*getOrAssignProxy/m.test(s));
}

console.log(`\n${pass} passed, ${fail} failed\n`);
process.exit(fail === 0 ? 0 : 1);
