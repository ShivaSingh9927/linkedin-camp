// How far a campaign has actually got — one definition, used everywhere.
//
// There were two, and they disagreed. The campaign detail page divided
// completed leads by total leads; the dashboard counted leads that had left
// PENDING status. Both answered 0% for a campaign that had visited every
// profile and sent every invite, because neither measured the thing that had
// moved — the lead's position in the sequence. A user watching real work
// happen was told nothing was happening.
//
// Measure distance travelled, not arrivals.

/** Run states where the lead is finished, whatever the outcome. */
const TERMINAL = new Set(['COMPLETED', 'STALLED', 'FAILED', 'REPLIED']);

export interface ProgressRow {
    currentNodeIndex: number;
    status: string;
}

/**
 * Average how far the leads have travelled, 0-100.
 *
 * A terminal lead counts as 100% regardless of outcome: one retired as "not
 * accepted" is finished with, not stuck at the step where it stopped. The
 * index is clamped so a lead parked past the last node cannot push a campaign
 * over 100%.
 *
 * `nodeCount` is the workflow's node total; one is subtracted because the
 * trigger is a node a lead never occupies. With no progress rows at all the
 * caller's fallback applies — that is the one case where 0% is honest.
 */
export function campaignProgressPct(
    rows: ProgressRow[],
    nodeCount: number,
    fallbackPct = 0,
): number {
    if (!rows.length) return fallbackPct;
    const stepCount = Math.max(1, nodeCount - 1);
    const total = rows.reduce((sum, r) => sum + (
        TERMINAL.has(r.status) ? 1 : Math.min(1, Math.max(0, r.currentNodeIndex || 0) / stepCount)
    ), 0);
    return Math.round((total / rows.length) * 100);
}

/** Node count from a stored workflowJson, tolerant of the column being absent. */
export function workflowNodeCount(workflowJson: unknown): number {
    const nodes = (workflowJson as any)?.nodes;
    return Array.isArray(nodes) ? nodes.length : 0;
}
