/**
 * connection-check.ts
 *
 * Backend-agnostic dispatcher for the connection-degree / acceptance check.
 *
 * The campaign engine has two interchangeable connection-check handlers:
 *   - check-connection-voyager (Voyager API, fast, no per-lead DOM navigation)
 *   - check-connection         (DOM profile visit, gives exact degree + pending)
 *
 * Voyager is the DEFAULT — it confirms "is this lead now in my 1st-degree
 * list?" (i.e. did they accept the invite) with a single cached API read and
 * zero profile navigation, which is exactly what the post-connect acceptance
 * gate needs. The DOM path stays available as a switch for callers that need
 * the exact degree badge (2 vs 3) or PENDING-invite detection that Voyager
 * fast mode can't see.
 *
 * Switch precedence (first non-empty wins):
 *   1. config.backend            — per-node / per-condition override
 *   2. CONNECTION_CHECK_BACKEND   — process-wide env default
 *   3. 'voyager'                  — hard default
 */
import { NodeHandler, NodeResult, CampaignFlowNode, NodeContext } from '../types';
import { checkConnection } from './check-connection';
import { checkConnectionVoyager } from './check-connection-voyager';

export type ConnectionCheckBackend = 'voyager' | 'dom';

export function resolveConnectionBackend(config?: CampaignFlowNode): ConnectionCheckBackend {
    const fromConfig = (config as any)?.backend;
    const fromEnv = process.env.CONNECTION_CHECK_BACKEND;
    const choice = (fromConfig || fromEnv || 'voyager').toString().toLowerCase();
    return choice === 'dom' ? 'dom' : 'voyager';
}

/**
 * Run the connection check via the resolved backend. The Voyager handler
 * already self-falls-back to the DOM node when config.mode === 'precise', so a
 * caller can stay on the Voyager default and still escalate to DOM per-node.
 */
export const runConnectionCheck: NodeHandler = async (
    ctx: NodeContext,
    config: CampaignFlowNode,
): Promise<NodeResult> => {
    const backend = resolveConnectionBackend(config);
    if (backend === 'dom') {
        return checkConnection(ctx, config);
    }
    return checkConnectionVoyager(ctx, config);
};
