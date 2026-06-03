import { NodeHandler, NodeResult, CampaignFlowNode, IfElseCondition, IfElseOutput } from '../types';
import { executeNode } from '../engine';

function evaluateCondition(
    condition: IfElseCondition,
    connectionStatus: 'not_connected' | 'pending' | 'connected' | undefined,
    connected: boolean,
    storedOutputs: Record<string, Record<string, any>>,
): boolean {
    const { field, operator, value, source } = condition;

    let fieldValue: any;

    if (source === 'storedOutputs') {
        const path = field.split('.');
        fieldValue = path.reduce((obj, key) => obj?.[key], storedOutputs);
    } else if (field === 'connectionStatus') {
        fieldValue = connectionStatus || 'not_connected';
    } else if (field === 'connected') {
        fieldValue = connected;
    } else if (field === 'connectionDegree') {
        fieldValue = connected ? '1st' : '3rd+';
    }

    switch (operator) {
        case 'equals':
            return fieldValue === value;
        case 'not_equals':
            return fieldValue !== value;
        case 'is_true':
            return fieldValue === true || fieldValue === 'connected' || fieldValue === '1st';
        case 'is_false':
            return fieldValue === false || fieldValue === 'not_connected' || fieldValue === '3rd+';
        case 'is_null':
            return fieldValue === null || fieldValue === undefined;
        case 'is_not_null':
            return fieldValue !== null && fieldValue !== undefined;
        case 'is_empty':
            return fieldValue === null || fieldValue === undefined || fieldValue === '';
        case 'is_not_empty':
            return fieldValue !== null && fieldValue !== undefined && fieldValue !== '';
        default:
            return false;
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
        const result = evaluateCondition(condition, connectionStatus, connected, storedOutputs);

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