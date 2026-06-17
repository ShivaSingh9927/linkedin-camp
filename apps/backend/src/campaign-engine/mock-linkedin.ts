/**
 * mock-linkedin.ts — load-testing stub for the campaign engine.
 *
 * When MOCK_LINKEDIN=true, the engine skips the real Playwright browser launch
 * and routes every LinkedIn *action* node through `mockNode`, which returns the
 * same `NodeResult.output` shape the real node would. The engine then performs
 * ALL of its canonical DB writes (ActionLog, Message, Lead status, transitions,
 * enrichment, CRM events) exactly as in production — so queue/scheduler/DB/WS
 * load is faithful while nothing ever touches linkedin.com.
 *
 * This exists purely to measure capacity ("what breaks first") on the real
 * worker box with synthetic users, with zero risk to real LinkedIn accounts.
 * It has no effect unless MOCK_LINKEDIN is explicitly set to the string 'true'.
 *
 * See docs/load-testing-step0-design.md.
 */
import type { NodeContext, NodeResult, CampaignFlowNode, NodeType } from './types';

export const isMockLinkedIn = (): boolean => process.env.MOCK_LINKEDIN === 'true';

// Per-node simulated wall-clock. Default ~300ms with ±100% jitter mimics a fast
// browser action; raise MOCK_STEP_MS to model heavier nodes, lower it to push
// the queue harder. Deterministic randomness isn't needed here (load test).
const STEP_MS = parseInt(process.env.MOCK_STEP_MS || '300', 10);
const wait = (ms: number) => new Promise(res => setTimeout(res, ms));

// Nodes that do NO LinkedIn I/O — they must run their real handler so branching
// (if-else reads the DB) and stage-parking (delay) behave exactly as in prod.
// Everything else is a LinkedIn action and gets a synthetic result.
export const MOCK_PASSTHROUGH: Set<NodeType> = new Set(['delay', 'if-else']);

/**
 * Synthetic NodeResult for a LinkedIn action node. Shapes mirror the real
 * handlers closely enough that the engine's post-node logic (which keys off
 * `output.status` / `output.sent` / `output.connected` / enrichment fields)
 * takes the same DB-write branches it would in production.
 */
export async function mockNode(ctx: NodeContext, config: CampaignFlowNode): Promise<NodeResult> {
    await wait(STEP_MS + Math.floor(Math.random() * STEP_MS));

    const nodeType = config.node;
    const lead = ctx.lead;

    switch (nodeType) {
        case 'connect':
            // Engine sets Lead.status=PENDING on output.status==='sent'.
            return { success: true, output: { status: 'sent' } };

        case 'send-message':
            // Engine writes a SENT Message row + lead.messaged CRM event when
            // output.sent && output.messageText are present.
            return {
                success: true,
                output: {
                    sent: true,
                    messageText: `[MOCK] Hi ${lead.firstName || 'there'}, this is a load-test message.`,
                    aiGenerated: false,
                },
            };

        case 'like-nth-post':
            return { success: true, output: { liked: true, postContent: '[MOCK] post' } };

        case 'comment-nth-post':
            return { success: true, output: { commented: true, postContent: '[MOCK] post' } };

        case 'profile-visit':
        case 'profile-visit-voyager':
            // Engine calls updateLeadEnrichment(output) on success.
            return {
                success: true,
                output: {
                    name: [lead.firstName, lead.lastName].filter(Boolean).join(' ') || null,
                    firstName: lead.firstName ?? null,
                    lastName: lead.lastName ?? null,
                    headline: lead.headline ?? '[MOCK] Headline',
                    location: lead.location ?? null,
                    company: lead.company ?? '[MOCK] Co',
                    jobTitle: lead.jobTitle ?? null,
                    about: lead.aboutInfo ?? null,
                    email: lead.email ?? null,
                    connectionDegree: 2,
                    connected: false,
                },
            };

        case 'check-connection':
        case 'check-connection-voyager':
            // Report connected so downstream message steps proceed (the common
            // happy path we want to load-test end-to-end).
            return { success: true, output: { connected: true, status: 'connected', connectionDegree: 1 } };

        case 'follow':
            return { success: true, output: { status: 'followed' } };

        case 'inbox-sync':
        case 'inbox-sync-voyager':
            return { success: true, output: { synced: 0 } };

        case 'email':
            // Mocked so a load test never sends real SMTP.
            return { success: true, output: { sent: true } };

        case 'email-finder':
            return { success: true, output: { email: null } };

        case 'warmup':
            return { success: true, output: { warmed: true } };

        default:
            return { success: true, output: {} };
    }
}
