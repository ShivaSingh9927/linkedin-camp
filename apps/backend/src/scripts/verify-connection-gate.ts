/**
 * verify-connection-gate.ts
 *
 * Deterministic check on the IF_ELSE connection gate — the bug where a lead
 * confirmed 1st-degree by CHECK_CONNECTION was still skipped, because the gate
 * read PROFILE_VISIT's (possibly day-old, possibly error-swallowed) answer
 * instead. See docs/user-testing-bugs-2026-07-28.md P0 #1.
 *
 * No DB, no browser, no network — it exercises the pure decision path exactly
 * as the handler composes it:
 *     resolveConnection() → readFieldValue() → evaluateOperator()
 *
 * Run:  npx ts-node src/scripts/verify-connection-gate.ts
 */
import { resolveConnection, readFieldValue, evaluateOperator } from '../campaign-engine/nodes/if-else';
import type { IfElseCondition } from '../campaign-engine/types';

// The condition every DM template ships (campaign-templates/shapes.ts).
const GATE: IfElseCondition = {
    source: 'connectionState',
    field: 'connected',
    operator: 'is_true',
    probeOnNull: true,
} as IfElseCondition;

interface Case {
    name: string;
    // Inputs
    storedOutputs: Record<string, Record<string, any>>;
    leadStatus: string | null;
    leadDegree: number | null;
    ctxStatus?: 'not_connected' | 'pending' | 'connected' | 'unknown';
    // Expectations
    expectPass: boolean;
    expectFrom: 'check-connection' | 'lead-row' | 'profile-visit' | 'none';
    expectSkipReason?: 'connection_unknown' | 'connection_not_confirmed' | null;
    why: string;
}

const CASES: Case[] = [
    {
        name: "Akash: fresh check says connected, day-old profile-visit says not",
        storedOutputs: {
            'profile-visit': { connected: false },          // written a day ago, pre-delay
            'check-connection': { connected: true, connectionStatus: 'connected', connectionDegree: 1 },
        },
        leadStatus: 'CONNECTED',
        leadDegree: 1,
        expectPass: true,
        expectFrom: 'check-connection',
        expectSkipReason: null,
        why: 'THE BUG. Old code read profile-visit only and skipped the message.',
    },
    {
        name: 'Voyager probe failed, but the Lead row remembers CONNECTED',
        storedOutputs: {
            'profile-visit': { connected: null },            // fetch failed → unknown, not false
            'check-connection': { connected: null, connectionStatus: 'unknown' },
        },
        leadStatus: 'CONNECTED',
        leadDegree: 1,
        expectPass: true,
        expectFrom: 'lead-row',
        expectSkipReason: null,
        why: 'Free DB fallback rescues a transient probe failure. No retry, no extra call.',
    },
    {
        name: 'Genuinely not connected (confirmed 3rd-degree)',
        storedOutputs: {
            'check-connection': { connected: false, connectionStatus: 'not_connected', connectionDegree: 3 },
        },
        leadStatus: 'NEW',
        leadDegree: 3,
        expectPass: false,
        expectFrom: 'check-connection',
        expectSkipReason: 'connection_not_confirmed',
        why: 'Correct skip. Terminal, no retry — nothing to gain from re-checking.',
    },
    {
        name: 'Nobody knows anything',
        storedOutputs: {},
        leadStatus: null,
        leadDegree: null,
        expectPass: false,
        expectFrom: 'none',
        expectSkipReason: 'connection_unknown',
        why: 'Skip, but labelled connection_unknown so it is visible in the funnel.',
    },
    {
        name: 'Fresh negative must beat a stale positive (they disconnected)',
        storedOutputs: {
            'check-connection': { connected: false, connectionStatus: 'not_connected' },
        },
        leadStatus: 'CONNECTED',    // stale — was true last week
        leadDegree: 1,
        expectPass: false,
        expectFrom: 'check-connection',
        expectSkipReason: 'connection_not_confirmed',
        why: 'Recency wins in BOTH directions, or we would DM ex-connections forever.',
    },
    {
        name: 'Invite still pending',
        storedOutputs: {
            'check-connection': { connected: false, connectionStatus: 'pending' },
        },
        leadStatus: 'PENDING',
        leadDegree: null,
        expectPass: false,
        expectFrom: 'check-connection',
        expectSkipReason: 'connection_not_confirmed',
        why: 'Invite sent, not accepted — cannot DM yet. A real answer, not unknown.',
    },
    {
        name: 'Voyager check-connection backend (fast mode) is read too',
        storedOutputs: {
            'check-connection-voyager': { connected: true, connectionStatus: 'connected', connectionDegree: 1 },
        },
        leadStatus: 'NEW',
        leadDegree: null,
        expectPass: true,
        expectFrom: 'check-connection',
        expectSkipReason: null,
        why: 'Both node variants persist under their own key; the gate must read either.',
    },
    {
        name: 'Regression: profile-visit alone still works (no check node in flow)',
        storedOutputs: {
            'profile-visit': { connected: true, connectionDegree: 1 },
        },
        leadStatus: 'NEW',
        leadDegree: null,
        expectPass: true,
        expectFrom: 'profile-visit',
        expectSkipReason: null,
        why: 'Flows that gate straight off a visit must keep working.',
    },
    {
        name: 'Lead row degree 1 from extension scrape, nothing else ran',
        storedOutputs: {},
        leadStatus: 'NEW',
        leadDegree: 1,
        expectPass: true,
        expectFrom: 'lead-row',
        expectSkipReason: null,
        why: 'Scrape-time degree is a legitimate free source.',
    },
];

/**
 * The pre-fix logic, verbatim, for comparison:
 *     const connected = storedOutputs['profile-visit']?.connected || false;
 * `readFieldValue` returned that directly for field==='connected', and
 * probeOnNull could never fire because `false` is not `null`.
 *
 * Kept here so this script demonstrates what changed rather than just
 * asserting the new behaviour — if someone reintroduces the old precedence,
 * the diff below is the evidence.
 */
function legacyDecision(storedOutputs: Record<string, Record<string, any>>): boolean {
    const connected = storedOutputs['profile-visit']?.connected || false;
    return evaluateOperator(GATE.operator, connected, (GATE as any).value);
}

let passed = 0;
let failed = 0;
let regressionsFixed = 0;

console.log('\nIF_ELSE connection gate — decision matrix\n' + '='.repeat(78));

for (const c of CASES) {
    const resolved = resolveConnection(c.ctxStatus, c.storedOutputs, c.leadStatus, c.leadDegree);
    const fieldValue = readFieldValue(GATE, resolved, c.storedOutputs);
    const pass = evaluateOperator(GATE.operator, fieldValue, (GATE as any).value);

    // Mirrors the handler's labelling of a declined connection gate.
    const skipReason = pass ? null : (fieldValue == null ? 'connection_unknown' : 'connection_not_confirmed');

    const okPass = pass === c.expectPass;
    const okFrom = resolved.from === c.expectFrom;
    const okReason = (c.expectSkipReason ?? null) === skipReason;
    const ok = okPass && okFrom && okReason;

    if (ok) passed++; else failed++;

    const legacy = legacyDecision(c.storedOutputs);
    const changed = legacy !== pass;
    if (changed && pass) regressionsFixed++;

    console.log(`\n${ok ? '✅' : '❌'} ${c.name}`);
    console.log(`   → ${pass ? 'SEND' : 'SKIP'}  source=${resolved.from}  value=${JSON.stringify(fieldValue)}` +
                `  status=${resolved.connectionStatus}${skipReason ? `  reason=${skipReason}` : ''}`);
    console.log(`   ${c.why}`);
    if (changed) {
        console.log(`   ⚠  BEHAVIOUR CHANGED — old code: ${legacy ? 'SEND' : 'SKIP'} → now: ${pass ? 'SEND' : 'SKIP'}`);
    }
    if (!ok) {
        if (!okPass)   console.log(`   MISMATCH decision: expected ${c.expectPass ? 'SEND' : 'SKIP'}, got ${pass ? 'SEND' : 'SKIP'}`);
        if (!okFrom)   console.log(`   MISMATCH source:   expected ${c.expectFrom}, got ${resolved.from}`);
        if (!okReason) console.log(`   MISMATCH reason:   expected ${c.expectSkipReason ?? 'none'}, got ${skipReason ?? 'none'}`);
    }
}

console.log('\n' + '='.repeat(78));
console.log(`${passed} passed, ${failed} failed`);
console.log(`${regressionsFixed} case(s) that the old gate silently skipped now send.\n`);
process.exit(failed === 0 ? 0 : 1);
