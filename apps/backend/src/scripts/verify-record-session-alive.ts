/**
 * verify-record-session-alive.ts
 *
 * The inbox worker recorded FAILURE (handleCheckpoint) but nothing on SUCCESS,
 * so sessionValidatedAt went stale on accounts that sync cleanly every night
 * but whose UI is never opened — six days stale on a live account, 2026-08-18.
 * recordSessionAlive closes that, and reuses the validator's healable-states
 * rule rather than carrying a second copy that can drift.
 *
 * Static checks only (no DB): assert the wiring and the two-path logic.
 *
 *   npx ts-node --transpile-only src/scripts/verify-record-session-alive.ts
 */
import * as fs from 'fs';
import * as path from 'path';

const SRC = path.join(__dirname, '..');
let pass = 0, fail = 0;
const check = (name: string, ok: boolean, detail = '') =>
    ok ? (pass++, console.log(`  ✅ ${name}`)) : (fail++, console.log(`  ❌ ${name}${detail ? `\n       ${detail}` : ''}`));

const read = (rel: string) => fs.readFileSync(path.join(SRC, rel), 'utf8');
const readCode = (rel: string) =>
    read(rel).replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');

const cp = readCode('campaign-engine/safety/checkpoint.ts');
const worker = readCode('workers/inbox.worker.ts');
const validator = readCode('services/session-validator.service.ts');

console.log('\n--- the shared healable-states rule ---');
check('isHealableHealth is exported', /export function isHealableHealth/.test(cp));
check('heals SESSION_EXPIRED and NEEDS_LOGIN', /'SESSION_EXPIRED'[\s\S]{0,40}'NEEDS_LOGIN'/.test(cp));
check('does NOT list OTP_REQUIRED or RESTRICTED as healable',
    !/HEALABLE_HEALTH[\s\S]{0,120}OTP_REQUIRED/.test(cp) && !/HEALABLE_HEALTH[\s\S]{0,120}RESTRICTED/.test(cp),
    'auto-healing a challenged account is how "OTP please" escalates to a real restriction');
check('validator consumes the shared rule, not a private copy',
    validator.includes('isHealableHealth'));
check('validator no longer hardcodes the two states inline',
    !/currentHealth !== 'SESSION_EXPIRED' && currentHealth !== 'NEEDS_LOGIN'/.test(validator),
    'a second copy of the rule can drift from the first');

console.log('\n--- recordSessionAlive: two paths ---');
check('recordSessionAlive is exported', /export async function recordSessionAlive/.test(cp));
check('a healable account goes through the full recovery (markAccountHealthy)',
    /isHealableHealth\(user\?\.accountHealth\)[\s\S]{0,200}markAccountHealthy\(userId\)/.test(cp));
check('a non-healable account only stamps the timestamp (no nightly un-park/resume)',
    /sessionValidatedAt: new Date\(\)/.test(cp) &&
    !/recordSessionAlive[\s\S]{0,600}\$executeRaw/.test(cp));
check('resolves the HEALTHY+sessionInvalid contradiction the 4am sweep warns about',
    /accountHealth === 'HEALTHY'[\s\S]{0,80}sessionInvalid: false/.test(cp));
check('a challenged account keeps its gating flags (stamps time only)',
    /\{ sessionValidatedAt: new Date\(\) \}/.test(cp));

console.log('\n--- worker wiring ---');
check('imports recordSessionAlive', worker.includes('recordSessionAlive'));
check('called only after a completed sync, not on the failure paths',
    worker.indexOf('recordSessionAlive(userId)') > worker.indexOf('Inbox sync complete'));
check('best-effort — a bookkeeping write cannot fail the sync',
    /recordSessionAlive\(userId\)\.catch\(/.test(worker));

console.log(`\n${pass} passed, ${fail} failed\n`);
process.exit(fail === 0 ? 0 : 1);
