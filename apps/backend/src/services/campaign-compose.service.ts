/**
 * Campaign composition: the structure always comes from a TEMPLATE.
 *
 * WHY. A hand-built sequence can do things LinkedIn punishes — invite the same
 * person twice, message a 2nd-degree who never accepted, fire five actions with
 * no gap — and it is the USER'S ACCOUNT that gets restricted, not the graph.
 * Templates are the shapes we have actually run and verified. So the product
 * rule is: pick a template, then tune the content inside it.
 *
 * HOW IT'S ENFORCED. We do not validate a graph the client submits — we REBUILD
 * it from the template and copy across only whitelisted per-node fields. A
 * forged structure is not rejected; it is impossible, because the submitted
 * structure is never read. (The UI has hidden the from-scratch path for months,
 * but that was a convention, not a rule: anyone with a JWT and curl could post
 * an arbitrary workflow.)
 *
 * WHAT A USER MAY CHANGE
 *   - copy and AI settings per node: message, subject, aiEnabled, aiPrompt,
 *     tone, cta, label
 *   - delay length, subject to the floor below
 *
 * WHAT THEY MAY NOT
 *   - node types, order, edges, adding or removing steps
 *   - branch conditions — deliberately template-owned: a mis-set condition
 *     silently routes cold leads into a 1st-degree-only branch, which looks
 *     like "nothing happened" rather than an error.
 */

import { getTemplateById } from '../campaign-templates';

/** Per-node fields a user may set. Everything else is template-owned. */
export const EDITABLE_NODE_FIELDS = [
    'message', 'subject', 'aiEnabled', 'aiPrompt', 'tone', 'cta', 'label',
] as const;

/**
 * Minimum delay a USER may set: 1 day.
 *
 * Shortening the gap between steps is the single easiest way to get an account
 * restricted — same-hour visit → connect → message is not human. A template's
 * OWN delay is exempt: those shapes are verified, and some legitimately wait
 * hours rather than days. The floor applies to overrides only.
 */
export const MIN_USER_DELAY_DAYS = 1;

export interface ComposeResult {
    ok: boolean;
    workflow?: any;
    /** Present when ok === false. */
    error?: string;
    /** Non-fatal: fields that were ignored, so the caller can tell the user. */
    warnings: string[];
}

const isDelayNode = (n: any): boolean => {
    const sub = String(n?.data?.subType || n?.subType || '').toUpperCase();
    return sub === 'DELAY' || sub === 'WAIT';
};

/**
 * The delay a node carries, in days, however the shape spells it. Returns null
 * only when the node names NO delay field at all.
 *
 * The distinction matters: an explicit `delayDays: 0` must reach validation and
 * be REFUSED, not read as "nothing specified" and silently replaced by the
 * template's value. Asking for zero and receiving two days without a word is
 * the same silent-substitution failure as a write that reports success and
 * changes nothing.
 */
const DELAY_KEYS = ['delayDays', 'days', 'delayHours', 'hours'] as const;

function delayDaysOf(n: any): number | null {
    const d = n?.data || n || {};
    if (!DELAY_KEYS.some((k) => d[k] !== undefined && d[k] !== null)) return null;
    const days = Number(d.delayDays ?? d.days ?? 0);
    const hours = Number(d.delayHours ?? d.hours ?? 0);
    if (!Number.isFinite(days) || !Number.isFinite(hours)) return null;
    return days + hours / 24;
}

/**
 * Build a campaign workflow from `templateId`, applying only the user's
 * permitted per-node edits from `clientWorkflow` (which may be undefined).
 */
export function composeCampaignWorkflow(templateId: string, clientWorkflow?: any): ComposeResult {
    const template = getTemplateById(templateId);
    if (!template) {
        return { ok: false, error: `Unknown template "${templateId}".`, warnings: [] };
    }

    const warnings: string[] = [];
    // Deep clone so a request can never mutate the shared template registry —
    // that would leak one user's copy into every later campaign in the process.
    const workflow = JSON.parse(JSON.stringify(template.workflow));

    const clientById = new Map<string, any>();
    for (const n of clientWorkflow?.nodes || []) {
        if (n?.id) clientById.set(String(n.id), n);
    }

    if (clientWorkflow?.nodes && clientWorkflow.nodes.length !== workflow.nodes.length) {
        warnings.push(
            `Structure is template-owned: ${clientWorkflow.nodes.length} node(s) submitted, `
            + `${workflow.nodes.length} kept from the template.`,
        );
    }

    for (const node of workflow.nodes) {
        const from = clientById.get(String(node.id));
        if (!from) continue;
        const src = from.data || from;
        node.data = node.data || {};

        for (const field of EDITABLE_NODE_FIELDS) {
            if (src[field] !== undefined) node.data[field] = src[field];
        }

        if (isDelayNode(node)) {
            const requested = delayDaysOf(from);
            const templateDays = delayDaysOf(node);
            if (requested !== null && requested !== templateDays) {
                if (!Number.isInteger(requested) || requested < MIN_USER_DELAY_DAYS) {
                    return {
                        ok: false,
                        error: `Delay on "${node.data.label || node.id}" must be a whole number of days, `
                            + `at least ${MIN_USER_DELAY_DAYS}. Shorter gaps between steps get LinkedIn accounts restricted.`,
                        warnings,
                    };
                }
                node.data.delayDays = requested;
                delete node.data.delayHours;
                delete node.data.hours;
                delete node.data.days;
            }
        }

        // Branch conditions stay exactly as the template defines them.
        if (src.condition !== undefined) {
            warnings.push(`Branch condition on "${node.data.label || node.id}" is template-owned and was not changed.`);
        }
    }

    // Provenance, so a later edit can re-compose against the same template
    // without a schema migration for one column.
    workflow.templateId = templateId;
    return { ok: true, workflow, warnings };
}

/** The templateId a campaign was composed from, if it carries one. */
export function templateIdOf(workflowJson: any): string | null {
    const id = workflowJson?.templateId;
    return typeof id === 'string' && id ? id : null;
}
