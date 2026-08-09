/**
 * verify-refresh-state.ts
 *
 * Login progress used to live in a `Map` inside the API process. That is
 * correct only for exactly one backend-api that never restarts: POST /refresh
 * and the status polls that follow are separate requests, so a second replica
 * answers "unknown" forever, and a deploy mid-login does the same to a single
 * replica. Neither failure throws — the UI just spins — so these are the
 * assertions that keep it from creeping back.
 *
 * Runs against a real Redis when REDIS_URL is set (docker compose exposes one);
 * otherwise the live round-trip section is skipped and the static checks still
 * run.
 *
 *   npx ts-node --transpile-only src/scripts/verify-refresh-state.ts
 */
import * as fs from 'fs';
import * as path from 'path';

const SRC = path.join(__dirname, '..');
let pass = 0;
let fail = 0;
let skipped = 0;

function check(name: string, ok: boolean, detail = '') {
    if (ok) { pass++; console.log(`  ✅ ${name}`); }
    else { fail++; console.log(`  ❌ ${name}${detail ? `\n       ${detail}` : ''}`); }
}

const read = (rel: string) => fs.readFileSync(path.join(SRC, rel), 'utf8');
const readCode = (rel: string) =>
    read(rel).replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');

const routes = readCode('routes/session.routes.ts');
const relay = readCode('services/otp-relay.service.ts');

console.log('\n--- the in-process Map must be gone ---');
check('no `new Map` holding refresh state in the route file',
    !/refreshState\s*=\s*new Map/.test(routes));
check('no lingering refreshState references at all',
    !routes.includes('refreshState'),
    'a single surviving read would silently answer "unknown" on the other replica');
check('no setTimeout-based cleanup (a restart skips it; Redis TTL cannot be skipped)',
    !/setTimeout\([^)]*refreshState/.test(routes));

console.log('\n--- state goes through the shared store ---');
check('route writes via setRefreshState', routes.includes('setRefreshState'));
check('route reads via getRefreshState', routes.includes('getRefreshState'));
check('helpers are defined in the relay service (which already owns the client)',
    /export async function setRefreshState/.test(relay) &&
    /export async function getRefreshState/.test(relay));
check('status handler is async (it now awaits Redis)',
    /router\.get\('\/refresh-status',\s*authMiddleware,\s*async/.test(routes),
    'a non-async handler would serialise a Promise and the UI would read undefined');
check('every phase transition is persisted, not just the terminal one',
    (routes.match(/setRefreshState\(/g) || []).length >= 5);

console.log('\n--- failure modes ---');
check('a failed write cannot break the login (caught, not thrown)',
    /export async function setRefreshState[\s\S]{0,600}catch\s*\(/.test(relay));
check('a failed read degrades to null rather than a 500',
    /export async function getRefreshState[\s\S]{0,500}catch[\s\S]{0,120}return null/.test(relay));
check('running TTL outlasts a login',
    /REFRESH_RUNNING_TTL_SEC\s*=\s*15\s*\*\s*60/.test(relay));
check('done TTL keeps the old 5-minute retention',
    /REFRESH_DONE_TTL_SEC\s*=\s*5\s*\*\s*60/.test(relay));
check('an empty code stays awaiting_otp (relay timeout is not a verification)',
    /phase:\s*code\s*\?\s*'verifying'\s*:\s*'awaiting_otp'/.test(routes));

(async () => {
    console.log('\n--- live Redis round-trip ---');
    if (!process.env.REDIS_URL) {
        skipped++;
        console.log('  ⏭  REDIS_URL unset — skipping (static checks above still ran)');
    } else {
        const { setRefreshState, getRefreshState } = await import('../services/otp-relay.service');
        const id = `verify-${Date.now()}`;

        await setRefreshState(id, { status: 'running', phase: 'awaiting_otp', attempt: 2 });
        const back = await getRefreshState(id);
        check('round-trips through Redis with fields intact',
            back?.phase === 'awaiting_otp' && back?.attempt === 2 && back?.status === 'running',
            JSON.stringify(back));

        // This is the case the whole change exists for: a DIFFERENT process
        // must be able to answer. Same Redis, no shared memory.
        await setRefreshState(id, { status: 'done', phase: 'done', outcome: { kind: 'success' } });
        const after = await getRefreshState(id);
        check('a later read sees the newer phase (last write wins)',
            after?.phase === 'done' && after?.outcome?.kind === 'success',
            JSON.stringify(after));

        check('an unknown requestId reads back as null, not a throw',
            (await getRefreshState(`nope-${Date.now()}`)) === null);
    }

    console.log(`\n${pass} passed, ${fail} failed${skipped ? `, ${skipped} skipped` : ''}\n`);
    process.exit(fail === 0 ? 0 : 1);
})();
