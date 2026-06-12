/**
 * read-backend.ts
 *
 * Backend dispatcher for the READ nodes that have both a DOM and a Voyager
 * API implementation: profile-visit and inbox-sync.
 *
 * Voyager is the DEFAULT for reads — the API path is ~300ms and does no page
 * navigation, so it's both faster and lower-risk than driving the DOM. The
 * DOM path stays available as a switch for cases where the API is gated or a
 * field is only reachable by scraping (e.g. contact-info modal, recent posts —
 * the Voyager variants already fall back to DOM for those internally).
 *
 * WRITES (connect, like, comment, send-message, follow) are intentionally NOT
 * here: LinkedIn's mailboxPreWriteValidate hard-gates every Voyager write, so
 * those nodes are DOM-only with no API alternative.
 *
 * Switch precedence (first non-empty wins):
 *   1. config.backend          — per-node override
 *   2. READ_NODE_BACKEND env    — process-wide default
 *   3. 'voyager'                — hard default
 */
import { NodeHandler, NodeResult, CampaignFlowNode, NodeContext } from '../types';
import { profileVisit } from './profile-visit';
import { profileVisitVoyager } from './profile-visit-voyager';
import { inboxSync } from './inbox-sync';
import { inboxSyncVoyager } from './inbox-sync-voyager';

export type ReadBackend = 'voyager' | 'dom';

export function resolveReadBackend(config?: CampaignFlowNode): ReadBackend {
    const fromConfig = (config as any)?.backend;
    const fromEnv = process.env.READ_NODE_BACKEND;
    const choice = (fromConfig || fromEnv || 'voyager').toString().toLowerCase();
    return choice === 'dom' ? 'dom' : 'voyager';
}

export const profileVisitDispatch: NodeHandler = async (
    ctx: NodeContext,
    config: CampaignFlowNode,
): Promise<NodeResult> => {
    return resolveReadBackend(config) === 'dom'
        ? profileVisit(ctx, config)
        : profileVisitVoyager(ctx, config);
};

export const inboxSyncDispatch: NodeHandler = async (
    ctx: NodeContext,
    config: CampaignFlowNode,
): Promise<NodeResult> => {
    return resolveReadBackend(config) === 'dom'
        ? inboxSync(ctx, config)
        : inboxSyncVoyager(ctx, config);
};
