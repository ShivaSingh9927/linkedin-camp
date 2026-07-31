import { NodeHandler, NodeResult, CampaignFlowNode, IfElseCondition, IfElseOutput, NodeType } from '../types';
import { executeNode } from '../engine';
import { writeNodeOutput } from '../storage';
import { runConnectionCheck, resolveConnectionBackend } from './connection-check';
import { prisma } from '@repo/db';

// Resolved connection state for this gate, plus where it came from.
// `connected: null` means genuinely unknown — no source could answer.
export interface ResolvedConnection {
    connected: boolean | null;
    connectionStatus: 'not_connected' | 'pending' | 'connected' | 'unknown';
    connectionDegree: number | null;
    from: 'check-connection' | 'lead-row' | 'profile-visit' | 'none';
}

/**
 * Decide the lead's connection state, freshest source first.
 *
 * Order matters and is the whole point of this function:
 *
 *   1. CHECK_CONNECTION's output — the node sitting immediately before this
 *      gate in every DM template. It ran seconds ago. It is the answer.
 *   2. The Lead row — last confirmed state from any earlier run, the extension
 *      scrape, or a previous probe. Free (already fetched), no network.
 *   3. PROFILE_VISIT's output — correct when it's all we have, but in the
 *      standard templates it sits on the far side of a `WAIT 1d`, so it can be
 *      a day or more stale.
 *
 * The old code read ONLY (3), which is why a lead confirmed 1st-degree seconds
 * earlier by CHECK_CONNECTION was skipped on the strength of a day-old cached
 * `false`. Recency wins now.
 *
 * A source only counts as having answered when it actually knows. `null`/
 * `'unknown'` falls through to the next source, and if nothing knows we return
 * `connected: null` rather than inventing a negative.
 */
export function resolveConnection(
    ctxConnectionStatus: 'not_connected' | 'pending' | 'connected' | 'unknown' | undefined,
    storedOutputs: Record<string, Record<string, any>>,
    leadStatus: string | null,
    leadConnectionDegree: number | null,
): ResolvedConnection {
    // ---- 1. Freshest: whichever CHECK_CONNECTION backend just ran ----
    // Both node variants persist under their own key; prefer the DOM one when
    // both are present since it reads the exact degree.
    const cc = storedOutputs['check-connection'] || storedOutputs['check-connection-voyager'];
    if (cc && cc.connected != null) {
        return {
            connected: !!cc.connected,
            connectionStatus: cc.connectionStatus || (cc.connected ? 'connected' : 'not_connected'),
            connectionDegree: cc.connectionDegree ?? (cc.connected ? 1 : leadConnectionDegree),
            from: 'check-connection',
        };
    }
    // The node may have run and reported 'pending' — a real answer (invite
    // sent, not yet accepted) even though `connected` is false-y.
    if (cc?.connectionStatus === 'pending') {
        return { connected: false, connectionStatus: 'pending', connectionDegree: leadConnectionDegree, from: 'check-connection' };
    }

    // ---- 2. Last known DB state (free — the row is already loaded) ----
    // This is the fallback that rescues the exact bug we're fixing: a live
    // probe that failed, on a lead we have previously confirmed as 1st-degree.
    if (leadStatus === 'CONNECTED' || leadConnectionDegree === 1) {
        return { connected: true, connectionStatus: 'connected', connectionDegree: leadConnectionDegree ?? 1, from: 'lead-row' };
    }
    if (leadConnectionDegree != null && leadConnectionDegree > 1) {
        return { connected: false, connectionStatus: 'not_connected', connectionDegree: leadConnectionDegree, from: 'lead-row' };
    }

    // ---- 3. Oldest: PROFILE_VISIT, possibly from before a multi-day delay ----
    const pv = storedOutputs['profile-visit'] || storedOutputs['profile-visit-voyager'];
    if (pv && pv.connected != null) {
        return {
            connected: !!pv.connected,
            connectionStatus: pv.connected ? 'connected' : 'not_connected',
            connectionDegree: pv.connectionDegree ?? (pv.connected ? 1 : null),
            from: 'profile-visit',
        };
    }

    // ---- 4. A run-level seed, if the engine had one ----
    if (ctxConnectionStatus && ctxConnectionStatus !== 'unknown') {
        return {
            connected: ctxConnectionStatus === 'connected',
            connectionStatus: ctxConnectionStatus,
            connectionDegree: leadConnectionDegree,
            from: 'lead-row',
        };
    }

    // ---- Nothing knew ----
    return { connected: null, connectionStatus: 'unknown', connectionDegree: leadConnectionDegree, from: 'none' };
}

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
        case 'is_false':     return fieldValue === false || fieldValue === 'not_connected' || fieldValue === '3rd+' || fieldValue === 3;
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

        const branchToExecute = result ? config.trueBranch : config.falseBranch;

        if (!branchToExecute || branchToExecute.length === 0) {
            console.log(`[IF-ELSE] No nodes to execute for branch: ${output.branch}`);
            output.executed = false;
            return { success: true, output };
        }

        console.log(`[IF-ELSE] Executing ${output.branch} branch with ${branchToExecute.length} nodes`);

        for (const nodeConfig of branchToExecute) {
            const nodeResult = await executeNode(ctx, nodeConfig);

            // Persist inner node output the same way the top-level engine loop
            // does — write to ctx.storedOutputs so the next inner node in
            // this branch can read it, AND call writeNodeOutput so downstream
            // top-level nodes (and audit log) see the result. Without this,
            // a chain like trueBranch=[EMAIL_FINDER, EMAIL] would have EMAIL
            // unable to read EMAIL_FINDER's output, and post-branch nodes
            // would have no visibility into what the branch did.
            const innerType = nodeConfig.node as NodeType;
            const execAt = new Date().toISOString();
            if (nodeResult.success && nodeResult.output) {
                ctx.storedOutputs[innerType] = nodeResult.output;
            }
            await writeNodeOutput(ctx.campaignId, ctx.lead.id, {
                node: innerType,
                status: nodeResult.success ? 'success' : 'failed',
                output: nodeResult.output,
                error: nodeResult.error,
                at: execAt,
            }).catch((err) => console.error(`[IF-ELSE] writeNodeOutput failed for ${innerType}:`, err?.message));

            if (!nodeResult.success) {
                console.log(`[IF-ELSE] Node ${nodeConfig.node} failed: ${nodeResult.error}`);
                return {
                    success: false,
                    error: `Node ${nodeConfig.node} failed: ${nodeResult.error}`,
                    output
                };
            }
        }

        output.executed = true;
        return { success: true, output };

    } catch (err: any) {
        return { success: false, error: err.message };
    }
};