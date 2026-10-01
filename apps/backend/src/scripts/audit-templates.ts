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

const templates = getTemplates();
console.log(`Auditing ${templates.length} templates\n`);
let blocks = 0, warns = 0, notes = 0;
const clean: string[] = [];

for (const t of templates) {
    const flow = flattenDagToFlow(t.workflow as any);
    const findings = audit(flow);
    if (!findings.length) { clean.push(t.id); continue; }
    const b = findings.filter(x => x.level === 'BLOCK');
    const w = findings.filter(x => x.level === 'WARN');
    const n = findings.filter(x => x.level === 'NOTE');
    blocks += b.length; warns += w.length; notes += n.length;
    console.log(`### ${t.id}  (${t.name})`);
    for (const x of [...b, ...w, ...n]) console.log(`    ${x.level.padEnd(5)} ${x.msg}`);
    if (b.length) console.log(describe(flow).map(l => '      ' + l).join('\n'));
    console.log();
}
console.log(`\nCLEAN (${clean.length}): ${clean.join(', ')}`);
console.log(`\nTOTals — BLOCK ${blocks}, WARN ${warns}, NOTE ${notes}`);
