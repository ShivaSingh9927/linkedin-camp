import { NodeHandler, NodeResult, CampaignFlowNode, IfElseCondition, IfElseOutput, NodeType, NodeContext } from '../types';
import { executeNode } from '../engine';
import { recordNodeExecution } from '../node-record';
import { runConnectionCheck, resolveConnectionBackend } from './connection-check';
import { prisma } from '@repo/db';
import { resolveConnection, ResolvedConnection } from '../connection-resolve';
// Re-exported so existing importers (and the gate verifier script) keep working.
export { resolveConnection };
export type { ResolvedConnection };
import { checkQuota, checkWeeklyQuota, checkBurst, nextDayRetryAt, nextHourRetryAt, DAILY_CAPS, GovernedAction } from '../safety/quota';
import { paceAction, markActionAt } from '../safety/pacing';

// Resolved connection state for this gate, plus where it came from.
// `connected: null` means genuinely unknown — no source could answer.


export function readFieldValue(
    condition: IfElseCondition,
    resolved: ResolvedConnection,
    storedOutputs: Record<string, Record<string, any>>,
): any {
    const { field, source } = condition;
    if (source === 'storedOutputs') {
        return field.split('.').reduce<any>((obj, key) => obj?.[key], storedOutputs);
    }
    // Each of these can legitimately return null = "unknown". Callers must not
    // coerce that to false: null is what makes probeOnNull fire and what marks
    // an unknown-skip as explainable rather than silent.
    if (field === 'connectionStatus') {
        return resolved.connectionStatus === 'unknown' ? null : resolved.connectionStatus;
    }
    if (field === 'connected') return resolved.connected;
    if (field === 'connectionDegree') {
        if (resolved.connectionDegree != null) return resolved.connectionDegree;
        return resolved.connected === true ? 1 : null;
    }
    return undefined;
}

export function evaluateOperator(operator: string, fieldValue: any, value: any): boolean {
    switch (operator) {
        case 'equals':       return fieldValue === value;
        case 'not_equals':   return fieldValue !== value;
        case 'is_true':      return fieldValue === true || fieldValue === 'connected' || fieldValue === '1st' || fieldValue === 1;
        // Every value that means "cannot DM this person yet". `pending` and
        // 2nd-degree were missing: a lead whose invite is sent-but-unaccepted
        // answered false to is_true AND false to is_false, so a gate worded as
        // is_false routed it down the CONNECTED branch and tried to message
        // someone who had not accepted. No shipped template gates on
        // connectionStatus (they all use `connected`, which is a plain boolean
        // and was never affected), so this is closing the hole rather than
        // fixing a live break — but the operator should not depend on which
        // field it happens to be pointed at.
        case 'is_false':     return fieldValue === false
                                || fieldValue === 'not_connected'
                                || fieldValue === 'pending'
                                || fieldValue === '2nd' || fieldValue === 2
                                || fieldValue === '3rd+' || fieldValue === 3;
        case 'is_null':      return fieldValue === null || fieldValue === undefined;
        case 'is_not_null':  return fieldValue !== null && fieldValue !== undefined;
        case 'is_empty':     return fieldValue === null || fieldValue === undefined || fieldValue === '';
        case 'is_not_empty': return fieldValue !== null && fieldValue !== undefined && fieldValue !== '';
        default:             return false;
    }
}

export const ifElse: NodeHandler = async (ctx, config): Promise<NodeResult> => {
    const { connectionStatus, storedOutputs } = ctx;
    
    const output: IfElseOutput = { branch: 'false', executed: false };

    try {
        const condition = config.condition;
        if (!condition) {
            return { success: false, error: 'No condition provided for if-else node' };
        }

        // Fetch the Lead row's last known connection state so connectionState
        // conditions have a free, no-network fallback when the live probe
        // couldn't answer. Populated by the extension scrape, profile-visit,
        // and check-connection.
        let leadStatus: string | null = null;
        let leadConnectionDegree: number | null = null;
        try {
            const row = await prisma.lead.findUnique({
                where: { id: ctx.lead.id },
                select: { status: true, connectionDegree: true },
            });
            leadStatus = (row?.status as string | undefined) ?? null;
            leadConnectionDegree = row?.connectionDegree ?? null;
        } catch { /* tolerate transient DB errors — fall back to null */ }

        let resolved = resolveConnection(connectionStatus, storedOutputs, leadStatus, leadConnectionDegree);
        let fieldValue = readFieldValue(condition, resolved, storedOutputs);

        // probeOnNull: only reached when NO source could answer (see
        // resolveConnection). In the standard templates CHECK_CONNECTION runs
        // immediately before this gate, so this costs nothing on the normal
        // path — it exists for flows that gate without a check node in front,
        // and as a last resort when a probe failed and the Lead row is blank.
        if (condition.probeOnNull && fieldValue == null && ctx.page) {
            // Voyager by default (cheap, no profile navigation); switchable to
            // DOM via condition.backend or the CONNECTION_CHECK_BACKEND env.
            const probeConfig = { node: 'check-connection', backend: condition.backend } as CampaignFlowNode;
            const backend = resolveConnectionBackend(probeConfig);
            console.log(`[IF-ELSE] field "${condition.field}" is unknown and probeOnNull is set — running connection check (backend=${backend}).`);
            try {
                const probeResult = await runConnectionCheck(ctx, probeConfig);
                if (probeResult.success && probeResult.output) {
                    // Mirror to storedOutputs so downstream nodes see it too.
                    ctx.storedOutputs['check-connection'] = probeResult.output;
                    if (probeResult.output.connectionDegree != null) {
                        leadConnectionDegree = probeResult.output.connectionDegree;
                    }
                }
            } catch (err: any) {
                console.log(`[IF-ELSE] CHECK_CONNECTION probe failed: ${err.message}`);
            }
            resolved = resolveConnection(ctx.connectionStatus, ctx.storedOutputs, leadStatus, leadConnectionDegree);
            fieldValue = readFieldValue(condition, resolved, storedOutputs);
        }

        // Resuming a branch that parked at a DELAY.
        //
        // Re-evaluating the gate here would be wrong: the condition is a
        // snapshot of the moment the sequence entered the branch, and days may
        // have passed. A lead who was connected when the branch started and has
        // since disconnected would flip mid-sequence and run the other path
        // from halfway through. The decision is already recorded — honour it.
        const prior = ctx.storedOutputs['if-else'] as IfElseOutput | undefined;
        const resumingAt = prior?.resumeAt && prior.resumeAt > 0 ? prior.resumeAt : 0;
        if (resumingAt > 0 && prior?.branch) {
            console.log(`[IF-ELSE] Resuming the ${prior.branch} branch at node ${resumingAt} after a parked wait.`);
            return runBranch(
                ctx,
                prior.branch === 'true' ? config.trueBranch : config.falseBranch,
                { ...output, branch: prior.branch, resolvedFrom: prior.resolvedFrom },
                resumingAt,
            );
        }

        const result = evaluateOperator(condition.operator, fieldValue, condition.value);

        output.branch = result ? 'true' : 'false';

        // Record how this gate decided. For connection gates this is the
        // difference between "we confirmed they aren't connected" and "we never
        // found out" — previously indistinguishable, and the reason a dropped
        // message looked identical to a correct skip.
        const isConnectionGate = condition.source === 'connectionState';
        if (isConnectionGate) {
            output.resolvedFrom = resolved.from;
            if (!result) {
                // Terminal either way — per product decision we do NOT retry a
                // lead whose gate declined. But we label it, so the funnel can
                // show "couldn't confirm" separately from "not connected".
                output.skipReason = fieldValue == null ? 'connection_unknown' : 'connection_not_confirmed';
            }
            const verdict = result ? 'PASS' : 'SKIP';
            console.log(
                `[IF-ELSE] connection gate ${verdict}: field=${condition.field} value=${JSON.stringify(fieldValue)} ` +
                `status=${resolved.connectionStatus} degree=${resolved.connectionDegree ?? 'unknown'} source=${resolved.from}` +
                (output.skipReason ? ` reason=${output.skipReason}` : '')
            );
            if (output.skipReason === 'connection_unknown') {
                console.warn(
                    `[IF-ELSE] Lead ${ctx.lead.firstName || ctx.lead.id}: connection state UNKNOWN — no source could confirm. ` +
                    `Skipping without retry (recorded as connection_unknown).`
                );
            }
        }

        return runBranch(ctx, result ? config.trueBranch : config.falseBranch, output, 0);

    } catch (err: any) {
        return { success: false, error: err.message };
    }
};

/**
 * Run the chosen branch, starting at `from`.
 *
 * A DELAY inside the branch parks the lead instead of returning instantly.
 * Parking is normally the engine loop's job and it addresses positions by
 * top-level index, which cannot point inside a branch — so a wait in here used
 * to be a no-op and the rest of the branch fired immediately. Rather than
 * invent an index space, the lead parks at the IF_ELSE node itself and the
 * branch records how far in to resume. The engine honours `parkHours`.
 */
async function runBranch(
    ctx: NodeContext,
    branch: CampaignFlowNode[] | undefined,
    output: IfElseOutput,
    from: number,
): Promise<NodeResult> {
    if (!branch || branch.length === 0) {
        console.log(`[IF-ELSE] No nodes to execute for branch: ${output.branch}`);
        output.executed = false;
        output.resumeAt = undefined;
        return { success: true, output };
    }

    if (from === 0) {
        console.log(`[IF-ELSE] Executing ${output.branch} branch with ${branch.length} nodes`);
    }

    for (let idx = from; idx < branch.length; idx++) {
        const nodeConfig = branch[idx];

        // A wait is a stage boundary, exactly as it is at the top level.
        if (nodeConfig.node === 'delay') {
            const hours = nodeConfig.hours ?? 24;
            output.executed = true;
            output.resumeAt = idx + 1;
            console.log(`[IF-ELSE] Branch hit a ${hours}h wait — parking. Resumes at branch node ${idx + 1}.`);
            return { success: true, output, parkHours: hours };
        }

        // Per-account safety caps, applied here too.
        //
        // The engine gates governed actions with `if (nodeType in DAILY_CAPS)`,
        // keyed on the node it dispatched — and that is `if-else` for anything
        // in a branch, which is in no cap table. So every invite and message
        // inside a branch bypassed the daily cap, the weekly ceiling, the
        // hourly burst limit AND the inter-action pacing, while the engine
        // believed the account was governed. Caps are per LinkedIn account, so
        // a bypass here is exactly the behaviour that gets one restricted.
        const governed = nodeConfig.node as GovernedAction;
        if (nodeConfig.node in DAILY_CAPS) {
            const park = (until: Date, why: string): NodeResult => {
                console.log(`[IF-ELSE] ${nodeConfig.node} held by ${why} — parking until ${until.toISOString()}, resumes at branch node ${idx}.`);
                output.executed = true;
                output.resumeAt = idx;
                return { success: true, output, parkUntil: until.toISOString() };
            };

            const quota = await checkQuota(ctx.userId, governed);
            if (!quota.allowed) return park(nextDayRetryAt(), `the daily cap (${quota.used}/${quota.cap})`);

            const week = await checkWeeklyQuota(ctx.userId, governed);
            if (!week.allowed) return park(nextDayRetryAt(), `the weekly cap (${week.used}/${week.cap})`);

            const burst = await checkBurst(ctx.userId, governed);
            if (!burst.allowed) return park(nextHourRetryAt(), `the hourly burst cap (${burst.used}/${burst.cap})`);

            // Human-paced gap between actions, same as the top-level loop.
            await paceAction(ctx.userId, nodeConfig.node);
        }

        const nodeResult = await executeNode(ctx, nodeConfig);

        const innerType = nodeConfig.node as NodeType;
        const execAt = new Date().toISOString();
        // Start the cooldown from a real action only, as the engine does.
        if (nodeResult.success && nodeConfig.node in DAILY_CAPS) markActionAt(ctx.userId, nodeConfig.node);
        if (nodeResult.success && nodeResult.output) {
            ctx.storedOutputs[innerType] = nodeResult.output;
        }
        // The same bookkeeping a top-level node gets: audit row, node output,
        // DM persistence, CRM event, enrichment, status projection. This used
        // to be writeNodeOutput alone, so a message sent from inside a branch
        // left no ActionLog row, no inbox record and no CRM event — and since
        // the compiler puts the whole post-gate sequence inside the branch,
        // that was most of the run.
        await recordNodeExecution({
            userId: ctx.userId,
            campaignId: ctx.campaignId,
            leadId: ctx.lead.id,
            leadName: ctx.lead.firstName || ctx.lead.linkedinUrl,
            nodeType: innerType,
            result: nodeResult,
            at: execAt,
        });

        if (!nodeResult.success) {
            console.log(`[IF-ELSE] Node ${nodeConfig.node} failed: ${nodeResult.error}`);
            // Stay put so a retry re-enters here rather than at the top of the
            // branch — re-running an already-sent message would duplicate it.
            output.resumeAt = idx;
            return {
                success: false,
                error: `Node ${nodeConfig.node} failed: ${nodeResult.error}`,
                // Name the node that actually failed. The engine's recovery
                // rules are per node type, and a branch failure arriving as a
                // bare 'if-else' matched none of them — a SEND_MESSAGE that
                // died in here was swept up as an ordinary non-fatal failure
                // and the lead retired as 'sequence_finished'.
                failedNode: innerType,
                // Terminality belongs to the node that decided it, not to the
                // branch that happened to contain it.
                terminal: nodeResult.terminal,
                terminalReason: nodeResult.terminalReason,
                output,
            };
        }
    }

    output.executed = true;
    output.resumeAt = undefined;
    return { success: true, output };
}
