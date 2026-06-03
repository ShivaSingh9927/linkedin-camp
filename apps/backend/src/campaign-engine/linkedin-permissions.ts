/**
 * LinkedIn permission model — single source of truth for what each
 * campaign node needs to actually work, plus helpers for predicting
 * how a flow will run against a list of leads.
 *
 * Consumed by:
 *   - B.3 templates: declare audience-appropriate flows
 *   - B.4 builder warnings: "this MESSAGE step will skip 38 of 50 leads"
 *   - B.5 builder gate auto-insert: "we'll wrap this in CHECK_CONNECTION"
 *   - B.6 gallery filter: hide cold-outreach templates from "Existing network" picks
 *
 * Assumptions baked in for v1 (per session 2026-06-03 decision):
 *   - No Open Profile modeling — treat everyone as "1st-degree-only for DM"
 *     even though ~5% of LinkedIn users let anyone DM them. Worst case is
 *     a redundant CONNECT step; the inverse (silent skip) is worse.
 *   - Sales Navigator + Premium Business lumped as one "Premium" tier;
 *     we don't track InMail credit balances per user.
 *   - LinkedIn's per-week caps (~100 invites, ~80 commercial searches) are
 *     enforced separately in safety/quota.ts — out of scope for this module.
 */

import { NodeType } from './types';

export interface NodePermissionProfile {
    /**
     * Action only succeeds when the lead is a 1st-degree connection.
     * Examples: send-message (LinkedIn renders no compose button for
     * non-1st-degree; the existing detectConnectionState gate skips
     * cleanly, but the user's flow has effectively no-op'd).
     */
    requiresConnected?: boolean;

    /**
     * Action runs without error on any degree but yields lower / null
     * results on non-1st-degree. Templates should ideally gate these
     * behind a degree check to avoid wasted DOM probes.
     * Examples: email-finder (LinkedIn hides contact-info modal for
     * non-1st-degree → returns null).
     */
    bestEffortOnNonConnected?: boolean;

    /**
     * Action works on any lead regardless of connection degree.
     * Examples: profile-visit, follow, connect, like, comment, delay,
     * if-else, check-connection, warmup, inbox-sync, email (uses
     * external email channel, not LinkedIn DM).
     */
    safeAlways?: boolean;

    /**
     * Builder hint: this node SHOULD have an upstream connection-
     * establishing gate (CONNECT → DELAY → CHECK_CONNECTION → IF_ELSE)
     * or a fast-path branch on lead.connectionDegree === 1. If not,
     * the builder shows a warning + offers a one-click gate insert.
     */
    needsConnectionGate?: boolean;

    /**
     * Action would benefit from Premium / Sales Nav (e.g. InMail) but
     * v1 doesn't enforce. Informational only — surfaces as a soft hint
     * in the builder, not a hard block.
     */
    premiumOnly?: boolean;

    /**
     * Action sends real outbound communication (DM, email, comment).
     * Used by the builder to surface "this step contacts the lead"
     * iconography and by safety/quota to count against daily caps.
     */
    isOutbound?: boolean;
}

export const NODE_PERMISSIONS: Record<NodeType, NodePermissionProfile> = {
    warmup:             { safeAlways: true },
    'profile-visit':    { safeAlways: true },
    connect:            { safeAlways: true, isOutbound: true },
    'like-nth-post':    { safeAlways: true, isOutbound: true },
    'comment-nth-post': { safeAlways: true, isOutbound: true },
    'send-message':     { requiresConnected: true, needsConnectionGate: true, isOutbound: true },
    delay:              { safeAlways: true },
    'inbox-sync':       { safeAlways: true },
    'if-else':          { safeAlways: true },
    'check-connection': { safeAlways: true },
    email:              { safeAlways: true, isOutbound: true },
    'email-finder':     { bestEffortOnNonConnected: true, needsConnectionGate: true },
    follow:             { safeAlways: true, isOutbound: true },
};

// ─── Prediction Helpers ──────────────────────────────────────

export type LeadFireOutcome = 'will_run' | 'will_skip' | 'will_probe';

/**
 * Predict whether a node will actually do meaningful work for a lead
 * with the given connection degree. Used by the builder to color steps
 * red/yellow/green for a lead list.
 *
 *   will_run   — degree is known + compatible (or node is safeAlways)
 *   will_skip  — degree is known + incompatible (e.g. MESSAGE on 3rd-degree)
 *   will_probe — degree is null, node would run CHECK_CONNECTION first
 *                (effectively "we don't know yet, depends on probe outcome")
 */
export function predictNodeOutcome(
    nodeType: NodeType,
    leadConnectionDegree: number | null | undefined,
): LeadFireOutcome {
    const perms = NODE_PERMISSIONS[nodeType];
    if (!perms || perms.safeAlways) return 'will_run';

    if (leadConnectionDegree == null) return 'will_probe';

    if (perms.requiresConnected) {
        return leadConnectionDegree === 1 ? 'will_run' : 'will_skip';
    }
    if (perms.bestEffortOnNonConnected) {
        // Returns null on non-1st-degree but still "runs" — the downstream
        // IF_ELSE handles the empty result. We surface it differently from
        // a hard skip so the builder can warn "yields nothing on cold leads".
        return leadConnectionDegree === 1 ? 'will_run' : 'will_probe';
    }
    return 'will_run';
}

/**
 * Summarize how a multi-step flow would execute over a list of leads.
 * Feeds the B.4 builder warning ("this MESSAGE will skip 38 of 50 leads").
 */
export interface FlowPrediction {
    totalLeads: number;
    /** Per-node outcome counts. Keyed by node type. */
    perNode: Record<string, { will_run: number; will_skip: number; will_probe: number }>;
    /** Whether the flow has at least one outbound step that requires a 1st-degree
     *  lead AND lacks an upstream connection gate (CONNECT or CHECK_CONNECTION). */
    hasUngatedRequiresConnected: boolean;
}

export function predictFlow(
    flowNodes: Array<{ node: NodeType }>,
    leads: Array<{ connectionDegree: number | null | undefined }>,
): FlowPrediction {
    const perNode: FlowPrediction['perNode'] = {};
    for (const step of flowNodes) {
        const counts = { will_run: 0, will_skip: 0, will_probe: 0 };
        for (const lead of leads) {
            counts[predictNodeOutcome(step.node, lead.connectionDegree)]++;
        }
        perNode[step.node] = counts;
    }

    // "Ungated" = a requiresConnected node appears in the linear flow
    // BEFORE any upstream node that would establish/verify connection
    // (connect or check-connection). IF_ELSE branches that contain those
    // are intentionally NOT counted here because B.4 inspects the raw flow
    // shape, not branch contents — the builder warning lives on the
    // top-level node.
    let hasUngatedRequiresConnected = false;
    let sawConnectionEstablisher = false;
    for (const step of flowNodes) {
        if (step.node === 'connect' || step.node === 'check-connection') {
            sawConnectionEstablisher = true;
            continue;
        }
        const perms = NODE_PERMISSIONS[step.node];
        if (perms?.requiresConnected && !sawConnectionEstablisher) {
            hasUngatedRequiresConnected = true;
            break;
        }
    }

    return { totalLeads: leads.length, perNode, hasUngatedRequiresConnected };
}

/**
 * Quick check used by the builder when the user drops a new node:
 * does this node need a connection gate upstream?
 */
export function nodeNeedsConnectionGate(nodeType: NodeType): boolean {
    return !!NODE_PERMISSIONS[nodeType]?.needsConnectionGate;
}
