// Walk every shipped template through the REAL DAG compiler and report the
// structures that bit us this week.
//
// Reading the template sources is not enough: the shapes are built by helpers
// and the compiler decides what ends up inside a conditional branch — which is
// exactly where the bugs lived.

import { getTemplates } from '../campaign-templates';
import { flattenDagToFlow } from '../campaign-engine/workflow-graph';

const GOVERNED = new Set(['connect', 'send-message', 'like-nth-post', 'comment-nth-post', 'follow']);
const WRITES = new Set(['connect', 'send-message']);

interface Finding { level: 'BLOCK' | 'WARN' | 'NOTE'; msg: string; }

function describe(flow: any[], depth = 0): string[] {
    const out: string[] = [];
    for (const n of flow) {
        const pad = '  '.repeat(depth);
        out.push(`${pad}${n.node}${n.node === 'delay' ? ` (${n.hours}h)` : ''}`);
        if (n.node === 'if-else') {
            out.push(`${pad}  true:`);
            out.push(...describe(n.trueBranch || [], depth + 2));
            out.push(`${pad}  false:`);
            out.push(...describe(n.falseBranch || [], depth + 2));
        }
    }
    return out;
}

function audit(flow: any[]): Finding[] {
    const f: Finding[] = [];

    const walk = (nodes: any[], inBranch: boolean, path: string) => {
        let sinceDelay: string[] = [];
        nodes.forEach((n, i) => {
            const t = String(n.node);

            if (t === 'delay') {
                const hours = Number(n.hours);
                if (!Number.isFinite(hours)) {
                    f.push({ level: 'BLOCK', msg: `${path} delay #${i} has no resolvable hours (got ${JSON.stringify(n.hours)})` });
                } else if (hours < 24) {
                    f.push({ level: 'BLOCK', msg: `${path} waits only ${hours}h — under the 1-day floor` });
                }
                if (inBranch) {
                    f.push({ level: 'NOTE', msg: `${path} has a ${n.hours}h wait INSIDE a branch (needs the branch-park fix)` });
                }
                sinceDelay = [];
                return;
            }

            if (inBranch && GOVERNED.has(t)) {
                f.push({ level: 'NOTE', msg: `${path} runs ${t} inside a branch (needs the branch-caps fix)` });
            }

            // Two writes with no wait between them is the shape that sent two
            // DMs 78 seconds apart.
            if (WRITES.has(t) && sinceDelay.some((p) => WRITES.has(p))) {
                f.push({ level: 'BLOCK', msg: `${path} does ${sinceDelay.filter(x => WRITES.has(x)).join(' + ')} then ${t} with NO wait between them` });
            }
            sinceDelay.push(t);

            if (t === 'if-else') {
                const tb = n.trueBranch || [];
                const fb = n.falseBranch || [];
                if (!tb.length && !fb.length) {
                    f.push({ level: 'WARN', msg: `${path} if-else #${i} has two empty branches — the sequence stops here` });
                }
                walk(tb, true, `${path}→true`);
                walk(fb, true, `${path}→false`);
            }
        });
    };

    walk(flow, false, 'flow');

    // A DM to someone who was never confirmed connected.
    const flat = (ns: any[]): any[] => ns.flatMap((n) => n.node === 'if-else'
        ? [n, ...flat(n.trueBranch || []), ...flat(n.falseBranch || [])] : [n]);
    const all = flat(flow);
    const msgIdx = all.findIndex((n) => n.node === 'send-message');
    const gateIdx = all.findIndex((n) => n.node === 'if-else' || String(n.node).startsWith('check-connection'));
    if (msgIdx >= 0 && (gateIdx < 0 || gateIdx > msgIdx)) {
        const hasConnect = all.some((n) => n.node === 'connect');
        if (hasConnect) f.push({ level: 'WARN', msg: 'flow invites then messages with no connection check between' });
    }
    return f;
}

const verbose = process.argv.includes('--verbose');

const templates = getTemplates();
console.log(`Auditing ${templates.length} campaign templates through the DAG compiler\n`);

let blocks = 0, warns = 0, notes = 0;
const clean: string[] = [];
const branchWait = new Set<string>();
const branchGoverned = new Set<string>();

for (const t of templates) {
    const flow = flattenDagToFlow(t.workflow as any);
    const findings = audit(flow);

    for (const x of findings) {
        if (x.msg.includes('wait INSIDE a branch')) branchWait.add(t.id);
        if (x.msg.includes('branch-caps')) branchGoverned.add(t.id);
    }

    const serious = findings.filter(x => x.level !== 'NOTE');
    blocks += findings.filter(x => x.level === 'BLOCK').length;
    warns += findings.filter(x => x.level === 'WARN').length;
    notes += findings.filter(x => x.level === 'NOTE').length;

    if (!findings.length) clean.push(t.id);
    if (!serious.length && !verbose) continue;

    console.log(`### ${t.id}  (${t.name})`);
    for (const x of (verbose ? findings : serious)) console.log(`    ${x.level.padEnd(5)} ${x.msg}`);
    if (serious.some(x => x.level === 'BLOCK')) console.log(describe(flow).map(l => '      ' + l).join('\n'));
    console.log();
}

// NOTEs are not failures: they record which templates depend on the engine
// handling branches correctly (waits parking, caps applying). Every one of
// these was broken until 2026-10-01, which is why the count is worth printing
// even when nothing fails — it is the blast radius if that code regresses.
console.log('---');
console.log(`clean of branch dependencies : ${clean.length}/${templates.length}`);
console.log(`governed action in a branch  : ${branchGoverned.size}/${templates.length} (needs per-branch caps)`);
console.log(`multi-day wait in a branch   : ${branchWait.size}/${templates.length} (needs branch parking)`);
console.log(`BLOCK ${blocks}   WARN ${warns}   NOTE ${notes}`);

if (blocks || warns) {
    console.error(`\nFAILED: ${blocks} blocking and ${warns} warning finding(s). `
        + `A template must not wait less than a day, fire two writes with no gap, `
        + `message without a connection check, or end in an empty branch.`);
    process.exit(1);
}
console.log('\nOK — no template has a structure that is unsafe on its own.');
