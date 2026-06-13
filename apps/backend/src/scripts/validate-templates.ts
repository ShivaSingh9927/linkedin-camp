/**
 * Offline structural + metadata validator for all campaign templates.
 * Pure graph checks — no DB, no engine, no network. Mirrors the alias
 * vocabulary in campaign-engine/workflow-graph.ts so it flags exactly the
 * nodes the engine would drop as UNKNOWN.
 */
import { TEMPLATES } from '../campaign-templates';

// keep in sync with workflow-graph.ts SUBTYPE_ALIASES
const ALIASES: Record<string, string> = {
    PROFILE_VISIT: 'VISIT', VISIT: 'VISIT', VISIT_API: 'VISIT_API', PROFILE_VISIT_VOYAGER: 'VISIT_API',
    CONNECT: 'INVITE', INVITE: 'INVITE', INVITATION: 'INVITE',
    MESSAGE: 'MESSAGE', SEND_MESSAGE: 'MESSAGE',
    LIKE: 'LIKE_POST', LIKE_POST: 'LIKE_POST', COMMENT: 'COMMENT_POST', COMMENT_POST: 'COMMENT_POST',
    EMAIL: 'EMAIL', SEND_EMAIL: 'EMAIL', EMAIL_FINDER: 'EMAIL_FINDER', FIND_EMAIL: 'EMAIL_FINDER',
    FOLLOW: 'FOLLOW', CHECK_CONNECTION: 'CHECK_CONNECTION', CHECK_CONNECTION_VOYAGER: 'CHECK_CONNECTION_API',
    INBOX_SYNC: 'INBOX_SYNC', INBOX_SYNC_VOYAGER: 'INBOX_SYNC_API',
    IF_ELSE: 'IF_ELSE', WAIT: 'DELAY', DELAY: 'DELAY',
    START: 'NOOP', TRIGGER: 'NOOP', END: 'NOOP',
    UNFOLLOW: 'NOOP', TWITTER_DM: 'NOOP', SMS: 'NOOP', WEBHOOK: 'NOOP',
};
const step = (n: any) => ALIASES[(n.subType || '').toUpperCase()] || (n.type === 'CONDITION' ? 'IF_ELSE' : 'UNKNOWN');

let totalErr = 0, totalWarn = 0;
for (const t of TEMPLATES) {
    const errs: string[] = [], warns: string[] = [];
    const nodes: any[] = t.workflow.nodes, edges: any[] = t.workflow.edges;
    const byId = new Map(nodes.map((n) => [n.id, n]));
    const out = (id: string) => edges.filter((e) => e.source === id);

    // 1. dangling edge endpoints
    for (const e of edges) {
        if (!byId.has(e.source)) errs.push(`edge ${e.id} source '${e.source}' missing`);
        if (!byId.has(e.target)) errs.push(`edge ${e.id} target '${e.target}' missing`);
    }
    // 2. exactly one start
    const starts = nodes.filter((n) => (n.subType || '').toUpperCase() === 'START' || n.type === 'TRIGGER');
    if (starts.length !== 1) errs.push(`${starts.length} START nodes (want 1)`);
    // 3. unknown subtypes (engine would silently drop)
    for (const n of nodes) if (step(n) === 'UNKNOWN') errs.push(`node ${n.id} subType '${n.subType}' UNKNOWN to engine`);
    // 4. reachability from start
    const seen = new Set<string>(); const stack = starts[0] ? [starts[0].id] : [];
    while (stack.length) { const id = stack.pop()!; if (seen.has(id)) continue; seen.add(id); for (const e of out(id)) stack.push(e.target); }
    for (const n of nodes) if (!seen.has(n.id)) errs.push(`node ${n.id} (${n.subType}) unreachable from START`);
    // 5. IF_ELSE must have both true & false outgoing handles
    for (const n of nodes) if (step(n) === 'IF_ELSE') {
        const h = out(n.id).map((e) => e.sourceHandle);
        if (!h.includes('true')) errs.push(`IF_ELSE ${n.id} missing 'true' edge`);
        if (!h.includes('false')) errs.push(`IF_ELSE ${n.id} missing 'false' edge`);
    }
    // 6. terminal nodes (no outgoing) must be END
    for (const n of nodes) if (out(n.id).length === 0 && (n.subType || '').toUpperCase() !== 'END')
        warns.push(`dead-end node ${n.id} (${n.subType}) has no outgoing edge and is not END`);
    // 7. every EMAIL must have an EMAIL_FINDER ancestor (else nothing to send to)
    const ancestors = (target: string) => { const s = new Set<string>(), st = [target]; while (st.length) { const c = st.pop()!; for (const e of edges) if (e.target === c && !s.has(e.source)) { s.add(e.source); st.push(e.source); } } return s; };
    for (const n of nodes) if (step(n) === 'EMAIL') {
        const anc = ancestors(n.id);
        if (![...anc].some((id) => step(byId.get(id)) === 'EMAIL_FINDER')) errs.push(`EMAIL ${n.id} has no EMAIL_FINDER ancestor`);
    }
    // 8. metadata vs graph
    const delayCount = nodes.filter((n) => step(n) === 'DELAY').length;
    if (delayCount !== t.delayCount) warns.push(`delayCount declared ${t.delayCount}, graph has ${delayCount}`);
    // longest-path duration (DAG DFS summing delayDays)
    const memo = new Map<string, number>();
    const longest = (id: string): number => {
        if (memo.has(id)) return memo.get(id)!;
        const n = byId.get(id); const d = step(n) === 'DELAY' ? (n.data?.delayDays || 0) : 0;
        const outs = out(id);
        const best = outs.length ? Math.max(...outs.map((e) => longest(e.target))) : 0;
        const v = d + best; memo.set(id, v); return v;
    };
    const dur = starts[0] ? longest(starts[0].id) : 0;
    if (dur !== t.durationDays) warns.push(`durationDays declared ${t.durationDays}, longest path = ${dur}`);

    if (errs.length || warns.length) {
        console.log(`\n${errs.length ? '❌' : '⚠️ '} ${t.id}`);
        errs.forEach((e) => console.log(`    ERROR: ${e}`));
        warns.forEach((w) => console.log(`    warn:  ${w}`));
    }
    totalErr += errs.length; totalWarn += warns.length;
}
console.log(`\n=== ${TEMPLATES.length} templates checked — ${totalErr} errors, ${totalWarn} warnings ===`);
process.exit(0);
