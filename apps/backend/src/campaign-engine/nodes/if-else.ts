import { NodeHandler, NodeResult, CampaignFlowNode, IfElseCondition, IfElseOutput, NodeType } from '../types';
import { executeNode } from '../engine';
import { writeNodeOutput } from '../storage';
import { checkConnection } from './check-connection';
import { prisma } from '@repo/db';

function readFieldValue(
    condition: IfElseCondition,
    connectionStatus: 'not_connected' | 'pending' | 'connected' | undefined,
    connected: boolean,
    storedOutputs: Record<string, Record<string, any>>,
    leadConnectionDegree: number | null,
): any {
    const { field, source } = condition;
    if (source === 'storedOutputs') {
        return field.split('.').reduce<any>((obj, key) => obj?.[key], storedOutputs);
    }
    if (field === 'connectionStatus') return connectionStatus || 'not_connected';
    if (field === 'connected') return connected;
    if (field === 'connectionDegree') {
        // Prefer the Lead.connectionDegree column when populated. Falls back
        // to a binary inference from `connected` so legacy conditions like
        // is_true/equals='1st' still work.
        if (leadConnectionDegree != null) return leadConnectionDegree;
        return connected ? 1 : null;
    }
    return undefined;
}

function evaluateOperator(operator: string, fieldValue: any, value: any): boolean {
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

        const connected = storedOutputs['profile-visit']?.connected || false;

        // Fetch Lead.connectionDegree from DB so connectionState conditions
        // can branch on the column (canonical, populated by extension scrape
        // + profile-visit + check-connection). Cached for the rest of this
        // node's execution.
        let leadConnectionDegree: number | null = null;
        try {
            const row = await prisma.lead.findUnique({
                where: { id: ctx.lead.id },
                select: { connectionDegree: true },
            });
            leadConnectionDegree = row?.connectionDegree ?? null;
        } catch { /* tolerate transient DB errors — fall back to null */ }

        let fieldValue = readFieldValue(condition, connectionStatus, connected, storedOutputs, leadConnectionDegree);

        // probeOnNull: if condition asks for a fresh probe AND we have a
        // page available, run CHECK_CONNECTION to populate the column,
        // then re-read. Lets templates branch correctly when scrape-time
        // data was missing without forcing users to author an explicit
        // "if null" branch upstream.
        if (condition.probeOnNull && fieldValue == null && ctx.page) {
            console.log(`[IF-ELSE] field "${condition.field}" is null and probeOnNull is set — running CHECK_CONNECTION first.`);
            try {
                const probeResult = await checkConnection(ctx, { node: 'check-connection' } as CampaignFlowNode);
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
            fieldValue = readFieldValue(condition, connectionStatus, connected, storedOutputs, leadConnectionDegree);
        }

        const result = evaluateOperator(condition.operator, fieldValue, condition.value);

        output.branch = result ? 'true' : 'false';

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