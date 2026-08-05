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

/**
 * Nodes that navigate the lead's /recent-activity/shares/ feed and pull the
 * post URN out of the DOM themselves. They don't read profile-visit's
 * latestPost — only its headline/company/about, for AI context.
 */
export const POST_READING_NODES = new Set(['comment-nth-post', 'like-nth-post']);

/**
 * True when some node AFTER `index` will navigate the activity feed anyway.
 *
 * In that case profile-visit's own `enrichPosts` scrape is duplicated work: two
 * Chromium navigations to the same feed for the same lead. Worse, it's the ONLY
 * reason profile-visit needs a browser at all in the common flow, so dropping it
 * takes the node from ~24s with Chromium to ~4.5s of pure HTTP.
 *
 * The post data isn't lost — the comment/like node persists what it discovers to
 * Lead.latestPost/latestPostUrl, which is where the UI reads from.
 */
export function postsCoveredLater(flow: CampaignFlowNode[], index: number): boolean {
    if (!Array.isArray(flow)) return false;
    return flow.slice(index + 1).some(n => POST_READING_NODES.has(String((n as any)?.node)));
}

/** `enrichPosts` after the redundancy check above. */
export function effectiveEnrichPosts(config: CampaignFlowNode, coveredLater?: boolean): boolean {
    return !!(config as any)?.enrichPosts && !coveredLater;
}

/**
 * Whether a profile-visit node genuinely needs a live page.
 *
 * MUST be the single source of truth for this — the engine calls it to decide
 * whether to launch Chromium, and the Voyager node calls it (via
 * effectiveEnrichPosts) to decide whether to scrape. If those two ever disagree
 * we either boot a browser for nothing, or try to scrape with no page.
 *
 * Only three things actually require the DOM:
 *   - the DOM backend was explicitly selected
 *   - `enrichContact` — the 1st-degree contact card is always API-redacted
 *   - `enrichPosts` that isn't already covered by a later node
 */
export function profileVisitNeedsDom(
    config: CampaignFlowNode,
    coveredLater?: boolean,
    isExplicitVoyager = false,
): boolean {
    if (!isExplicitVoyager && resolveReadBackend(config) === 'dom') return true;
    return !!(config as any)?.enrichContact || effectiveEnrichPosts(config, coveredLater);
}

export const inboxSyncDispatch: NodeHandler = async (
    ctx: NodeContext,
    config: CampaignFlowNode,
): Promise<NodeResult> => {
    return resolveReadBackend(config) === 'dom'
        ? inboxSync(ctx, config)
        : inboxSyncVoyager(ctx, config);
};
