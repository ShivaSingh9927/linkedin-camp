import { prisma } from '@repo/db';

/**
 * Template vocabulary (UPPERCASE subTypes shipped from campaign-templates/*)
 * mapped to the canonical stepType the linkedin worker dispatches on.
 *
 * Three buckets:
 *   - playwright actions: VISIT / INVITE / MESSAGE / LIKE_POST / COMMENT_POST
 *   - control flow:       IF_ELSE, DELAY (scheduler materializes the wait)
 *   - NOOP:               sentinels (START/TRIGGER/END) and not-yet-implemented
 *                         subTypes (FOLLOW, EMAIL, EMAIL_FINDER, ...). Treated
 *                         as no-op so the DAG continues rather than stalling.
 *                         When a real handler ships, move the entry to the
 *                         playwright bucket above.
 */
const SUBTYPE_ALIASES: Record<string, CanonicalStepType> = {
    PROFILE_VISIT: 'VISIT',
    VISIT: 'VISIT',
    CONNECT: 'INVITE',
    INVITE: 'INVITE',
    INVITATION: 'INVITE',
    MESSAGE: 'MESSAGE',
    SEND_MESSAGE: 'MESSAGE',
    LIKE: 'LIKE_POST',
    LIKE_POST: 'LIKE_POST',
    COMMENT: 'COMMENT_POST',
    COMMENT_POST: 'COMMENT_POST',

    IF_ELSE: 'IF_ELSE',
    WAIT: 'DELAY',
    DELAY: 'DELAY',

    START: 'NOOP',
    TRIGGER: 'NOOP',
    END: 'NOOP',

    FOLLOW: 'NOOP',
    UNFOLLOW: 'NOOP',
    EMAIL: 'NOOP',
    EMAIL_FINDER: 'NOOP',
    TWITTER_DM: 'NOOP',
    SMS: 'NOOP',
    WEBHOOK: 'NOOP',
};

export type CanonicalStepType =
    | 'VISIT'
    | 'INVITE'
    | 'MESSAGE'
    | 'LIKE_POST'
    | 'COMMENT_POST'
    | 'IF_ELSE'
    | 'DELAY'
    | 'NOOP'
    | 'UNKNOWN';

export function getStepType(node: any): CanonicalStepType {
    if (!node) return 'UNKNOWN';
    const data = node.data || node;
    const raw = String(data.subType || node.subType || node.type || '').toUpperCase();
    if (!raw) return 'UNKNOWN';
    if (raw === 'CONDITION') return 'IF_ELSE';
    // Bare 'ACTION'/'TRIGGER' type with no subType → treat as a default visit
    // for legacy node shapes; explicit subTypes always take precedence above.
    if (raw === 'ACTION') return 'VISIT';
    return SUBTYPE_ALIASES[raw] || 'UNKNOWN';
}

export interface WorkflowGraph {
    nodes: any[];
    edges: any[];
}

export function findNode(workflow: WorkflowGraph, id: string): any | null {
    if (!workflow?.nodes) return null;
    const direct = workflow.nodes.find((n: any) => n.id === id);
    if (direct) return direct;
    return (
        workflow.nodes.find(
            (n: any) =>
                n.nodeId === id ||
                n.id === `step_${id}` ||
                (typeof id === 'string' && id.includes(n.id))
        ) || null
    );
}

/**
 * Pick the next edge out of `currentId`. When `branch` is set (only for
 * IF_ELSE results), prefers an edge whose `sourceHandle` matches; falls
 * back to the first outgoing edge if no match (defensive — malformed
 * graph shouldn't strand a lead).
 */
export function pickNextEdge(
    workflow: WorkflowGraph,
    currentId: string,
    branch?: 'true' | 'false',
): any | null {
    const outgoing = (workflow.edges || []).filter((e: any) => e.source === currentId);
    if (outgoing.length === 0) return null;
    if (branch) {
        const matched = outgoing.find((e: any) => e.sourceHandle === branch);
        if (matched) return matched;
    }
    return outgoing[0];
}

export interface IfElseCondition {
    source?: 'storedOutputs' | 'connectionState';
    field: string;
    operator: string;
    value?: any;
}

/**
 * Evaluate an IF_ELSE condition without launching a browser. Reads
 * storedOutputs from CampaignLead.personalization.nodeOutputs and
 * connection/status from the Lead row.
 *
 * Missing-data behavior: when storedOutputs path resolves to undefined
 * (e.g. upstream node is a NOOP like EMAIL_FINDER), is_not_null → false
 * and is_null → true. This is the intended "treat absence as the
 * negative branch" semantics templates rely on.
 */
export async function evaluateIfElseCondition(
    condition: IfElseCondition | undefined,
    ctx: { campaignId: string; leadId: string },
): Promise<'true' | 'false'> {
    if (!condition) return 'false';

    let fieldValue: any = undefined;

    if (condition.source === 'storedOutputs') {
        const cl = await prisma.campaignLead.findUnique({
            where: { campaignId_leadId: { campaignId: ctx.campaignId, leadId: ctx.leadId } },
            select: { personalization: true },
        });
        const outputs = ((cl?.personalization as any)?.nodeOutputs) || {};
        fieldValue = condition.field
            .split('.')
            .reduce((obj: any, key: string) => obj?.[key], outputs);
    } else {
        const lead = await prisma.lead.findUnique({ where: { id: ctx.leadId } });
        const status = lead?.status || 'IMPORTED';
        const connected = status === 'CONNECTED';
        if (condition.field === 'connected') fieldValue = connected;
        else if (condition.field === 'connectionDegree') fieldValue = connected ? '1st' : '3rd+';
        else if (condition.field === 'connectionStatus')
            fieldValue = connected ? 'connected' : 'not_connected';
    }

    const { operator, value } = condition;
    let result: boolean;
    switch (operator) {
        case 'equals': result = fieldValue === value; break;
        case 'not_equals': result = fieldValue !== value; break;
        case 'is_true': result = fieldValue === true || fieldValue === 'connected' || fieldValue === '1st'; break;
        case 'is_false': result = fieldValue === false || fieldValue === 'not_connected' || fieldValue === '3rd+'; break;
        case 'is_null': result = fieldValue === null || fieldValue === undefined; break;
        case 'is_not_null': result = fieldValue !== null && fieldValue !== undefined; break;
        case 'is_empty': result = fieldValue === null || fieldValue === undefined || fieldValue === ''; break;
        case 'is_not_empty': result = fieldValue !== null && fieldValue !== undefined && fieldValue !== ''; break;
        default: result = false;
    }
    return result ? 'true' : 'false';
}

/**
 * Compute millisecond delay for a WAIT/DELAY node. Accepts the multiple
 * key shapes templates and the legacy builder use (delayDays vs days,
 * delayHours vs hours, nested under .data or hoisted on the node).
 * Falls back to 1 day if nothing parseable is present — same fallback
 * the old inline worker code used.
 */
export function delayMsFromNode(node: any): number {
    const data = node?.data || node || {};
    const days = data.delayDays || data.days || node?.delayDays || 0;
    const hours = data.delayHours || data.hours || node?.delayHours || 0;
    const ms = days * 86_400_000 + hours * 3_600_000;
    return ms || 86_400_000;
}

export type AdvanceResult =
    | {
        kind: 'execute';
        nodeId: string;
        node: any;
        stepType: CanonicalStepType;
        /**
         * Sum of DELAY nodes walked through to reach this executable.
         * Caller sets nextActionDate = now + delayMs and stores
         * currentStepId = nodeId, so the next worker tick lands on
         * the executable with the wait already satisfied.
         */
        delayMs: number;
    }
    | { kind: 'complete' };

/**
 * Walk forward from `startId` through every control-flow node (NOOP,
 * IF_ELSE, DELAY) until landing on a node the worker must execute, or
 * until the graph ends. DELAY nodes accumulate into `delayMs` rather
 * than stopping the walk — the scheduler materializes the wait via
 * nextActionDate before the worker fires again.
 *
 * Cycle guard: revisiting a node ends the walk (malformed graph
 * shouldn't loop a lead forever).
 */
export async function advanceUntilExecutable(
    workflow: WorkflowGraph,
    startId: string,
    ctx: { campaignId: string; leadId: string },
): Promise<AdvanceResult> {
    let currentId: string | null = startId;
    let delayMs = 0;
    const visited = new Set<string>();

    while (currentId) {
        if (visited.has(currentId)) {
            console.error(`[GRAPH] Cycle detected at ${currentId}, ending workflow.`);
            return { kind: 'complete' };
        }
        visited.add(currentId);

        const node = findNode(workflow, currentId);
        if (!node) {
            console.error(`[GRAPH] Node ${currentId} not found, ending workflow.`);
            return { kind: 'complete' };
        }

        const stepType = getStepType(node);

        if (stepType === 'NOOP') {
            console.log(`[GRAPH] Skip NOOP ${currentId} (${node.data?.subType || node.subType || node.type})`);
            const edge = pickNextEdge(workflow, currentId);
            if (!edge) return { kind: 'complete' };
            currentId = edge.target;
            continue;
        }

        if (stepType === 'IF_ELSE') {
            const data = node.data || node;
            const branch = await evaluateIfElseCondition(data.condition, ctx);
            console.log(`[GRAPH] IF_ELSE ${currentId} → ${branch} branch`);
            const edge = pickNextEdge(workflow, currentId, branch);
            if (!edge) return { kind: 'complete' };
            currentId = edge.target;
            continue;
        }

        if (stepType === 'DELAY') {
            delayMs += delayMsFromNode(node);
            console.log(`[GRAPH] Accumulated DELAY ${currentId} (+${delayMsFromNode(node)}ms, total ${delayMs}ms)`);
            const edge = pickNextEdge(workflow, currentId);
            if (!edge) return { kind: 'complete' };
            currentId = edge.target;
            continue;
        }

        return { kind: 'execute', nodeId: currentId, node, stepType, delayMs };
    }

    return { kind: 'complete' };
}
