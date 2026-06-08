import { prisma } from '@repo/db';
import { launchAuthenticatedContext } from './session-launch';

let io: any = null;
const getSocketIO = async () => {
    if (!io) {
        try {
            const socketModule = await import('../socket');
            io = socketModule.io;
        } catch {}
    }
    return io;
};

import {
    CampaignConfig,
    CampaignFlowNode,
    NodeContext,
    NodeExecution,
    NodeHandler,
    NodeResult,
    LeadExecutionResult,
    CampaignSummary,
    NodeType,
    SessionContext,
} from './types';
import { warmup } from './nodes/warmup';
import { profileVisit } from './nodes/profile-visit';
import { connect } from './nodes/connect';
import { likeNthPost } from './nodes/like-nth-post';
import { commentNthPost } from './nodes/comment-nth-post';
import { sendMessage } from './nodes/send-message';
import { inboxSync } from './nodes/inbox-sync';
import { delay } from './nodes/delay';
import { ifElse } from './nodes/if-else';
import { checkConnection } from './nodes/check-connection';
import { emailNode } from './nodes/email';
import { emailFinder } from './nodes/email-finder';
import { follow } from './nodes/follow';
import { readNodeOutputs, writeNodeOutput, updateLeadEnrichment } from './storage';
import { checkQuota, nextDayRetryAt, DAILY_CAPS, GovernedAction, isWithinWorkingHours, nextWorkingHourAt } from './safety/quota';
import { transitionLead, recomputeCampaignStatus } from './safety/lifecycle';
import { classifyPage, handleCheckpoint, isCheckpoint } from './safety/checkpoint';
import { uploadScreenshotToS3 } from '../services/s3-upload.service';

const wait = (ms: number) => new Promise(res => setTimeout(res, ms));
const randomRange = (min: number, max: number) => Math.floor(Math.random() * (max - min + 1) + min);

// ---- Node registry ----

const NODE_HANDLERS: Record<NodeType, NodeHandler> = {
    'warmup': warmup,
    'profile-visit': profileVisit,
    'connect': connect,
    'like-nth-post': likeNthPost,
    'comment-nth-post': commentNthPost,
    'send-message': sendMessage,
    'delay': delay,
    'inbox-sync': inboxSync,
    'if-else': ifElse,
    'check-connection': checkConnection,
    'email': emailNode,
    'email-finder': emailFinder,
    'follow': follow,
};

// ---- Execute single node (exported for if-else node) ----
export async function executeNode(ctx: NodeContext, config: CampaignFlowNode): Promise<NodeResult> {
    const { page, context, lead, userId, campaignId, storedOutputs, campaign, connectionStatus } = ctx;
    
    const nodeType = config.node;
    const handler = NODE_HANDLERS[nodeType];
    
    if (!handler) {
        return { success: false, error: `Unknown node type: ${nodeType}` };
    }
    
    const nodeCtx: NodeContext = {
        page, context, lead, userId, campaignId, storedOutputs, campaign, connectionStatus
    };
    
    return await handler(nodeCtx, config);
}

// Nodes that are fatal if they fail (skip to next lead)
const FATAL_NODES: Set<string> = new Set(['profile-visit']);

// Reply-pause invariant: once a lead has replied to ANY message in this
// campaign, we stop running automation against them. The inbox-sync worker
// writes Message rows with direction='RECEIVED' when it sees a reply on
// LinkedIn; this check fires before each step so a reply that came in
// between scheduled runs halts the next step before it executes.
//
// Scoped to this campaign so a reply on Campaign A doesn't freeze Campaign B
// against the same lead (rare, but valid for agencies running parallel
// pitches). If we ever want global pause, change `campaignId` filter to
// userId-only.
async function hasLeadReplied(campaignId: string, leadId: string): Promise<boolean> {
    const reply = await prisma.message.findFirst({
        where: { campaignId, leadId, direction: 'RECEIVED' },
        select: { id: true },
    }).catch(() => null);
    return !!reply;
}

// Phase C helpers — sequence awareness for AI nodes.
//
// buildCampaignProgress: snapshots where the lead is in the flow so the
// AI knows step N of M and can shift register. Reads execResult.nodesExecuted
// which the engine has been building up to this point in the loop. The
// completedSteps list reflects only successful executions; failures and
// skips don't count as 'done' from the lead's perspective.
function buildCampaignProgress(
    flow: CampaignFlowNode[],
    currentIndex: number,
    execResult: LeadExecutionResult,
) {
    // Filter out warmup/delay/profile-visit/inbox-sync — they're scaffolding,
    // not steps the lead would perceive. Same lens used for the "total" count
    // so step numbers feel natural to the AI ("step 2 of 3", not "step 5 of 9"
    // where 4 of those were warmups).
    const visibleTypes = new Set(['connect', 'send-message', 'like-nth-post', 'comment-nth-post', 'email', 'follow']);
    const totalVisible = flow.filter(n => visibleTypes.has(String(n.node || '').toLowerCase())).length;
    const completedSteps = execResult.nodesExecuted
        .filter(n => n.status === 'success' && visibleTypes.has(String(n.node).toLowerCase()))
        .map(n => ({ type: String(n.node), at: n.at, status: n.output?.status as string | undefined }));
    const pendingSteps = flow.slice(currentIndex + 1)
        .filter(n => visibleTypes.has(String(n.node || '').toLowerCase()))
        .map(n => String(n.node));
    // Step number = completed visible + 1 (this step itself). If the current
    // node isn't visible, fall back to completed count.
    const thisNodeVisible = visibleTypes.has(String(flow[currentIndex]?.node || '').toLowerCase());
    const stepNumber = completedSteps.length + (thisNodeVisible ? 1 : 0);
    let daysSinceFirstTouch: number | undefined;
    if (completedSteps.length > 0 && completedSteps[0].at) {
        const ms = Date.now() - new Date(completedSteps[0].at).getTime();
        daysSinceFirstTouch = Math.max(0, Math.round(ms / 86_400_000));
    }
    return {
        stepNumber,
        totalSteps: Math.max(totalVisible, 1),
        thisStepLabel: String(flow[currentIndex]?.label || flow[currentIndex]?.node || ''),
        completedSteps,
        pendingSteps,
        daysSinceFirstTouch,
    };
}

// loadMessageHistory: prior SENT messages to this lead in this campaign
// (both LinkedIn DMs and emails). Returned in chronological order so the
// AI sees the conversation as it unfolded. Full body — Groq is cheap and
// the anti-repetition rule works better with exact phrasing visible.
async function loadMessageHistory(campaignId: string, leadId: string) {
    const rows = await prisma.message.findMany({
        where: { campaignId, leadId, direction: 'SENT' },
        select: { channel: true, subject: true, content: true, sentAt: true },
        orderBy: { sentAt: 'asc' },
        take: 20, // hard cap — campaigns >20 sent messages without a reply are unusual
    }).catch(() => []);
    return rows.map(r => ({
        channel: (r.channel === 'email' ? 'email' : 'linkedin') as 'email' | 'linkedin',
        sentAt: r.sentAt.toISOString(),
        subject: r.subject || undefined,
        body: r.content || '',
    }));
}

// ---- Block resources for speed ----

async function blockResources(page: any) {
    await page.route('**/*', (route: any) => {
        const type = route.request().resourceType();
        const url = route.request().url();
        if (
            ['image', 'media', 'font'].includes(type) ||
            url.includes('analytics') ||
            url.includes('ads') ||
            url.includes('tracking') ||
            url.includes('doubleclick')
        ) {
            return route.abort();
        }
        return route.continue();
    });
}

// ---- Run campaign for a single lead ----

async function runLead(
    userId: string,
    campaignId: string,
    lead: NodeContext['lead'],
    flow: CampaignFlowNode[],
    campaignData?: {
        objective?: string;
        campaignDescription?: string;
        cta?: string;
        toneOverride?: string;
        persona?: string;
        valueProp?: string;
    },
    sessionContext?: SessionContext,
    aiContext?: NodeContext['aiContext']
): Promise<LeadExecutionResult> {
    const execResult: LeadExecutionResult = {
        leadId: lead.id,
        leadName: lead.firstName || lead.linkedinUrl,
        status: 'failed',
        nodesExecuted: [],
    };

    let browser: any;
    let context: any;
    let page: any;
    // Tracks the node currently being executed so the outer catch can attribute
    // unexpected errors accurately instead of mis-labelling every failure as a
    // profile-visit failure (the old behavior). null = pre-flow or between
    // nodes — outer catch then attributes to 'engine'.
    let currentNodeName: NodeType | null = null;

    try {
        // ---- Load user session data ----
        const user = await prisma.user.findUnique({
            where: { id: userId },
        });

        if (!user) {
            execResult.failedAt = 'init';
            execResult.error = 'User not found';
            return execResult;
        }

        // Account-health gate. If the account is in any non-HEALTHY state
        // (OTP_REQUIRED / SESSION_EXPIRED / RESTRICTED / NEEDS_LOGIN), refuse
        // to launch a browser at all — running through a bad session burns
        // proxy budget and risks escalating the LinkedIn flag from "OTP
        // please" to "account restricted". Defer the lead instead; cron will
        // skip it as long as health stays non-HEALTHY.
        if ((user as any).accountHealth && (user as any).accountHealth !== 'HEALTHY') {
            console.warn(`[ENGINE] user=${userId} accountHealth=${(user as any).accountHealth} — refusing to launch`);
            await transitionLead(campaignId, lead.id, 'DEFERRED', {
                reason: `account_${String((user as any).accountHealth).toLowerCase()}`,
                nextRetryAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
            }).catch(() => {});
            execResult.status = 'paused';
            execResult.pausedReason = 'stalled';
            return execResult;
        }

        // Launch the authenticated browser via the shared launcher — the single
        // source of truth for the sticky-proxy invariant (also used by the
        // self-profile enrichment job). Aborts if no pinned proxy snapshot.
        const launch = await launchAuthenticatedContext(userId, sessionContext);
        if (!launch.ok) {
            execResult.status = 'failed';
            execResult.failedAt = launch.failedAt;
            execResult.error = launch.error;
            return execResult;
        }
        browser = launch.browser;
        context = launch.context;
        page = launch.page;

        // ---- Load previously stored outputs ----
        const storedOutputs = await readNodeOutputs(campaignId, lead.id);

        // ---- Execute flow ----
        console.log(`[ENGINE] Flow received: ${JSON.stringify(flow)}`);
        console.log(`[ENGINE] Flow length: ${flow?.length}`);
        
        let needsWarmup = true; // First node always needs warmup
        let profileVisitRan = false;

        for (let i = 0; i < flow.length; i++) {
            const nodeConfig = flow[i];
            const nodeType = nodeConfig.node;

            // Checkpoint detection. After any navigation done inside the
            // previous node, LinkedIn may have served a /checkpoint/ page
            // (challenge spawned mid-flow). Catch it before we waste the next
            // node trying to interact with a non-existent UI. Cheap — URL
            // check + a single $('input[name="pin"]') probe.
            const checkpointInfo = await classifyPage(page);
            if (isCheckpoint(checkpointInfo)) {
                console.warn(`[ENGINE] Checkpoint mid-flow for lead ${lead.firstName}: kind=${checkpointInfo.kind} url=${checkpointInfo.url}`);
                const shotPath = `/app/sessions/engine_checkpoint_${userId}_${Date.now()}.png`;
                await page.screenshot({ path: shotPath, fullPage: false }).catch(() => {});
                uploadScreenshotToS3(page, userId, `engine_checkpoint_${lead.firstName || 'unknown'}`).catch(() => {});
                await handleCheckpoint({
                    userId,
                    campaignId,
                    leadId: lead.id,
                    info: checkpointInfo,
                    screenshotPath: shotPath,
                });
                execResult.status = 'paused';
                execResult.pausedReason = 'stalled';
                return execResult;
            }

            // Reply-pause check. Fires before every node (including warmup)
            // so a reply that landed between the previous step and this one
            // halts the campaign for this lead. Cheap indexed lookup; runs at
            // most once per node.
            if (await hasLeadReplied(campaignId, lead.id)) {
                console.log(`[ENGINE] Lead ${lead.firstName}: reply detected — pausing campaign for this lead.`);
                await prisma.campaignLead.updateMany({
                    where: { campaignId, leadId: lead.id },
                    data: { status: 'REPLIED', isCompleted: true },
                }).catch(err => console.error(`[ENGINE] CampaignLead REPLIED update failed: ${err.message}`));
                await prisma.lead.update({
                    where: { id: lead.id },
                    data: { status: 'REPLIED' },
                }).catch(() => {});
                await transitionLead(campaignId, lead.id, 'REPLIED', {
                    reason: 'lead_replied',
                    currentNodeIndex: i,
                }).catch(err => console.error(`[ENGINE] transitionLead REPLIED failed: ${err.message}`));
                execResult.status = 'paused';
                execResult.pausedReason = 'lead_replied';
                return execResult;
            }

            // Auto warmup rules
            if (needsWarmup && nodeType !== 'delay') {
                const warmupExec: NodeExecution = {
                    node: 'warmup' as NodeType,
                    status: 'success',
                    at: new Date().toISOString(),
                };

                const warmupCtx: NodeContext = {
                    page, context, lead, userId, campaignId, storedOutputs,
                };

                const warmupResult = await warmup(warmupCtx, { node: 'warmup' });

                // Emit socket event for warmup
                const socketIO = await getSocketIO();
                if (socketIO) {
                    socketIO.to(`user_${userId}`).emit('campaign_activity', {
                        campaignId,
                        leadId: lead.id,
                        leadName: lead.firstName || lead.linkedinUrl,
                        node: 'warmup',
                        action: warmupResult.success ? 'success' : 'failed',
                        details: { warmed: warmupResult.output?.warmed },
                        error: warmupResult.error,
                        timestamp: new Date().toISOString(),
                    });
                }

                if (!warmupResult.success) {
                    warmupExec.status = 'failed';
                    warmupExec.error = warmupResult.error;
                    execResult.nodesExecuted.push(warmupExec);

                    // Check for LinkedIn checkpoint/authwall — if present,
                    // mark account health, notify user, and pause campaign
                    // so the cron doesn't keep re-queueing failing jobs.
                    const checkpointInfo = await classifyPage(page).catch(() => null);
                    if (checkpointInfo && isCheckpoint(checkpointInfo)) {
                        console.warn(`[ENGINE] Checkpoint detected during warmup: kind=${checkpointInfo.kind} url=${checkpointInfo.url}`);
                        const shotPath = `/app/sessions/engine_warmup_${userId}_${Date.now()}.png`;
                        await page.screenshot({ path: shotPath, fullPage: false }).catch(() => {});
                        uploadScreenshotToS3(page, userId, `engine_warmup_${lead.firstName || 'unknown'}`).catch(() => {});
                        await handleCheckpoint({ userId, campaignId, leadId: lead.id, info: checkpointInfo, screenshotPath: shotPath });
                        await prisma.campaign.update({
                            where: { id: campaignId },
                            data: { status: 'PAUSED' },
                        }).catch(err => console.error(`[ENGINE] Failed to pause campaign: ${err.message}`));
                        execResult.status = 'paused';
                        execResult.pausedReason = 'stalled';
                        return execResult;
                    }

                    execResult.status = 'failed';
                    execResult.failedAt = 'warmup';
                    console.log(`[ENGINE] Lead ${lead.firstName}: warmup FAILED. Error: ${warmupResult.error}. Skipping to next lead.`);
                    return execResult;
                }

                warmupExec.output = warmupResult.output;
                execResult.nodesExecuted.push(warmupExec);
                needsWarmup = false;
            }

            // Daily-cap gate. LinkedIn rate-limits per account, not per
            // campaign, so caps are scoped to userId across all of their work
            // and counted from ActionLog (status=SUCCESS) for today. If we're
            // at cap, push this lead's next retry to tomorrow's working window
            // and return — the worker moves to the next lead instead of
            // burning the action.
            if (nodeType in DAILY_CAPS) {
                const quota = await checkQuota(userId, nodeType as GovernedAction);
                if (!quota.allowed) {
                    const retryAt = nextDayRetryAt();
                    console.log(`[ENGINE] Lead ${lead.firstName}: daily cap reached for ${nodeType} (${quota.used}/${quota.cap}). Rescheduling to ${retryAt.toISOString()}.`);
                    const t = await transitionLead(campaignId, lead.id, 'DEFERRED', {
                        reason: 'daily_cap',
                        nextRetryAt: retryAt,
                        currentNodeIndex: i,
                    }).catch(err => {
                        console.error(`[ENGINE] transitionLead DEFERRED failed: ${err.message}`);
                        return null;
                    });
                    execResult.status = 'paused';
                    execResult.pausedReason = t?.to === 'STALLED' ? 'stalled' : 'daily_cap';
                    return execResult;
                }
            }

            // Execute the node
            const nodeExec: NodeExecution = {
                node: nodeType,
                status: 'success',
                at: new Date().toISOString(),
            };

            const nodeCtx: NodeContext = {
                page, context, lead, userId, campaignId, storedOutputs,
                campaign: campaignData,
                aiContext,
            };

            // Phase C — sequence awareness for AI-capable nodes. Only assembled
            // when the node will actually call the AI service (saves a DB
            // round-trip on warmup / delay / profile-visit etc.). MESSAGE,
            // EMAIL, and COMMENT all gate AI on config.aiEnabled.
            const aiCapableNodes = new Set(['send-message', 'email', 'comment-nth-post']);
            if (aiCapableNodes.has(nodeType) && (nodeConfig as any).aiEnabled) {
                (nodeCtx as any).campaignProgress = buildCampaignProgress(flow, i, execResult);
                (nodeCtx as any).messageHistory = await loadMessageHistory(campaignId, lead.id);
            }

            console.log(`[ENGINE] Lead ${lead.firstName}: executing node ${i + 1}/${flow.length} → ${nodeType}`);

            // Get socket once for this node execution
            const socket = await getSocketIO();

            // Emit socket event: node started
            if (socket) {
                socket.to(`user_${userId}`).emit('campaign_activity', {
                    campaignId,
                    leadId: lead.id,
                    leadName: lead.firstName || lead.linkedinUrl,
                    node: nodeType,
                    action: 'executing',
                    details: {},
                    timestamp: new Date().toISOString(),
                });
            }

            // Legacy CRM_SYNC nodes (older templates / saved campaigns) are
            // no-op'd here. CRM sync is now event-driven via CampaignCrmPolicy;
            // running the node would either double-sync or fail unknown-type.
            const ntStr = String(nodeType).toUpperCase();
            if (ntStr === 'CRM_SYNC' || ntStr === 'CRM-SYNC') {
                console.log(`[ENGINE] Lead ${lead.firstName}: skipping legacy CRM_SYNC node (event-driven sync handles this).`);
                nodeExec.status = 'success';
                nodeExec.output = { skipped: true, reason: 'crm_sync_event_driven' };
                execResult.nodesExecuted.push(nodeExec);
                continue;
            }

            const handler = NODE_HANDLERS[nodeType];
            if (!handler) {
                nodeExec.status = 'failed';
                nodeExec.error = `Unknown node type: ${nodeType}`;
                execResult.nodesExecuted.push(nodeExec);
                continue;
            }

            currentNodeName = nodeType;
            const result: NodeResult = await handler(nodeCtx, nodeConfig);
            currentNodeName = null;

            // Emit socket event for real-time activity
            if (socket) {
                socket.to(`user_${userId}`).emit('campaign_activity', {
                    campaignId,
                    leadId: lead.id,
                    leadName: lead.firstName || lead.linkedinUrl,
                    node: nodeType,
                    action: result.success ? 'success' : 'failed',
                    details: {
                        // Extract key info for display
                        name: result.output?.name,
                        company: result.output?.company,
                        connected: result.output?.connected,
                        status: result.output?.status,
                        message: result.output?.messageText || result.output?.postContent,
                        sent: result.output?.sent,
                        liked: result.output?.liked,
                        commented: result.output?.commented,
                    },
                    error: result.error,
                    timestamp: new Date().toISOString(),
                });
            }

            // Audit every node execution — without this the UI has no record of
            // what the campaign actually did. CampaignLead.personalization.execLog
            // captures it as JSON but isn't queryable from the activity/inbox views.
            await prisma.actionLog.create({
                data: {
                    userId,
                    campaignId,
                    leadId: lead.id,
                    actionType: nodeType,
                    status: result.success ? 'SUCCESS' : 'FAILED',
                    errorMessage: result.error || null,
                },
            }).catch(err => console.error(`[ENGINE] ActionLog write failed: ${err.message}`));

            // For send-message, also persist the outbound DM so it shows up in the
            // inbox alongside the replies the sync worker pulls back.
            if (result.success && nodeType === 'send-message' && result.output?.sent && result.output?.messageText) {
                await prisma.message.create({
                    data: {
                        userId,
                        leadId: lead.id,
                        campaignId,
                        direction: 'SENT',
                        content: result.output.messageText,
                        source: 'CAMPAIGN',
                    },
                }).catch(err => console.error(`[ENGINE] Message write failed: ${err.message}`));

                // CRM event — policy decides whether this fans out anywhere.
                import('../services/crm-events').then(({ emitCrmEvent }) =>
                    emitCrmEvent({
                        event: 'lead.messaged',
                        userId,
                        campaignId,
                        leadId: lead.id,
                        meta: { messageContent: result.output?.messageText },
                    }),
                ).catch(() => {});
            }

            if (result.success) {
                nodeExec.output = result.output;
                execResult.nodesExecuted.push(nodeExec);

                // Store output for downstream nodes
                if (result.output) {
                    storedOutputs[nodeType] = result.output;
                    await writeNodeOutput(campaignId, lead.id, nodeExec);
                }

                // If profile-visit, update lead enrichment
                if (nodeType === 'profile-visit' && result.output) {
                    profileVisitRan = true;
                    await updateLeadEnrichment(lead.id, result.output);
                }

                // If connect sent, update lead status
                if (nodeType === 'connect' && result.output?.status === 'sent') {
                    await prisma.lead.update({
                        where: { id: lead.id },
                        data: { status: 'PENDING' },
                    }).catch(() => {});
                }

            } else {
                nodeExec.status = 'failed';
                nodeExec.error = result.error;
                execResult.nodesExecuted.push(nodeExec);

                // Write the failed execution too
                await writeNodeOutput(campaignId, lead.id, nodeExec).catch(() => {});

                // Check if fatal
                if (FATAL_NODES.has(nodeType)) {
                    execResult.status = 'failed';
                    execResult.failedAt = nodeType;
                    console.log(`[ENGINE] Lead ${lead.firstName}: ${nodeType} FAILED (fatal). Skipping to next lead.`);
                    return execResult;
                }

                console.log(`[ENGINE] Lead ${lead.firstName}: ${nodeType} FAILED (non-fatal). Continuing to next node.`);
            }

            // If delay node, set warmup needed for next node and mark lead for retry
            if (nodeType === 'delay') {
                needsWarmup = true;

                const hours = nodeConfig.hours || 24;
                const nextRetryAt = new Date(Date.now() + hours * 60 * 60 * 1000);

                // Delay is a scheduled-resume, not a forced retry — reset
                // deferralCount so a long-but-healthy sequence doesn't trip
                // the STALLED ceiling.
                await transitionLead(campaignId, lead.id, 'DEFERRED', {
                    reason: 'delay_node',
                    nextRetryAt,
                    currentNodeIndex: i + 1,
                }).then(() => {
                    // Delays shouldn't count toward the STALLED ceiling — zero it.
                    return prisma.campaignLeadProgress.update({
                        where: { campaignId_leadId: { campaignId, leadId: lead.id } },
                        data: { deferralCount: 0 },
                    });
                }).then(() => {
                    console.log(`[ENGINE] Lead marked for retry at ${nextRetryAt.toISOString()}`);
                }).catch(err => {
                    console.log(`[ENGINE] Could not update progress for delay: ${err}`);
                });
            }

            // Safety gap between nodes
            if (i < flow.length - 1 && flow[i + 1]?.node !== 'delay') {
                await wait(randomRange(3000, 8000));
            }
        }

        execResult.status = 'completed';
        return execResult;

    } catch (err: any) {
        execResult.status = 'failed';
        execResult.error = err?.message || String(err);
        if (currentNodeName) {
            // A node handler threw uncaught — attribute the failure to that
            // actual node, not a fake profile-visit row.
            execResult.failedAt = currentNodeName;
            execResult.nodesExecuted.push({
                node: currentNodeName,
                status: 'failed',
                error: execResult.error,
                at: new Date().toISOString(),
            });
        } else {
            // Pre-flow or between-nodes failure (browser launch, session
            // injection, etc.) — record on execResult.error/failedAt, do NOT
            // push a fabricated node row.
            execResult.failedAt = 'engine';
        }
        console.error(`[ENGINE] runLead caught at ${execResult.failedAt}: ${execResult.error}`);
        return execResult;

    } finally {
        if (context) await context.close().catch(() => {});
        if (browser) await browser.close().catch(() => {});
    }
}

// ---- Run full campaign ----

export async function runCampaign(
    userId: string,
    campaignId: string,
    config: CampaignConfig
): Promise<CampaignSummary> {
    const startedAt = new Date().toISOString();

    console.log(`\n${'='.repeat(50)}`);
    console.log(`[CAMPAIGN] Starting campaign ${campaignId}`);
    console.log(`${'='.repeat(50)}\n`);

    // Fetch the user's strategy + business context ONCE per campaign run.
    // Threaded into every NodeContext so per-action /ai/message and
    // /ai/comment calls receive the same ai_strategy + user_context payload.
    // Without this, the multi-agent strategy is generated but never reaches
    // the message-writing step — the link Phase 1 → Phase 2.
    let aiContext: NodeContext['aiContext'] | undefined;
    try {
        const bp = await prisma.businessProfile.findUnique({ where: { userId } });
        if (bp) {
            aiContext = {
                aiStrategy: bp.aiStrategy || null,
                userContext: {
                    persona: bp.persona,
                    company: bp.company,
                    companyDescription: bp.companyDescription,
                    products: bp.products,
                    differentiators: bp.differentiators,
                    caseStudies: bp.caseStudies,
                    targetAudience: bp.targetAudience,
                    industry: bp.industry,
                    mainPainPoint: bp.mainPainPoint,
                    usp: bp.usp,
                    valueProp: bp.valueProp,
                    communicationStyle: bp.communicationStyle,
                    writingSamples: bp.writingSamples,
                    tonePreferences: bp.tonePreferences,
                },
            };
            console.log(`[CAMPAIGN] Loaded ai context (strategy=${bp.aiStrategy ? 'yes' : 'no'})`);
        } else {
            console.log('[CAMPAIGN] No BusinessProfile — ai context disabled');
        }
    } catch (err: any) {
        console.warn('[CAMPAIGN] Failed to load BusinessProfile for ai context:', err.message);
    }

    // Get all leads for this campaign
    const campaignLeads = await prisma.campaignLead.findMany({
        where: { campaignId, isCompleted: false },
    });

    const summary: CampaignSummary = {
        campaignId,
        totalLeads: campaignLeads.length,
        succeeded: 0,
        failed: 0,
        leadResults: [],
        startedAt,
        completedAt: '',
    };

    for (const cl of campaignLeads) {
        // Working-hours gate. LinkedIn's behavioural model penalises off-hours
        // activity — running at 03:00 IST is a clean bot signal even if daily
        // totals are tiny. Reschedule the lead to the next window open + jitter
        // and move on; the cron scheduler re-picks it up when nextRetryAt
        // matures.
        if (!isWithinWorkingHours()) {
            const retryAt = nextWorkingHourAt();
            console.log(`[CAMPAIGN] Outside working hours — rescheduling lead ${cl.leadId} to ${retryAt.toISOString()}.`);
            await transitionLead(campaignId, cl.leadId, 'DEFERRED', {
                reason: 'off_hours',
                nextRetryAt: retryAt,
            }).catch(err => console.error(`[CAMPAIGN] Off-hours reschedule failed: ${err.message}`));
            continue;
        }

        // Fetch lead separately since relation is not available
        const leadRecord = await prisma.lead.findUnique({
            where: { id: cl.leadId }
        });
        
        const leadData: NodeContext['lead'] = {
            id: cl.leadId,
            linkedinUrl: leadRecord?.linkedinUrl || '',
            firstName: leadRecord?.firstName || '',
            lastName: leadRecord?.lastName || '',
            headline: leadRecord?.headline || null,
            jobTitle: leadRecord?.jobTitle || null,
            company: leadRecord?.company || null,
            location: leadRecord?.location || null,
            aboutInfo: leadRecord?.aboutInfo || null,
            email: leadRecord?.email || null,
            phone: leadRecord?.phone || null,
        };

        console.log(`\n[CAMPAIGN] Processing lead: ${leadData.firstName || leadData.linkedinUrl}`);

        const result = await runLead(userId, campaignId, leadData, config.flow, {
            objective: config.objective,
            campaignDescription: config.campaignDescription,
            cta: config.cta,
            toneOverride: config.toneOverride,
            persona: config.persona,
            valueProp: config.valueProp,
        }, config.sessionContext, aiContext);
        summary.leadResults.push(result);

        if (result.status === 'completed') {
            summary.succeeded++;
            await prisma.campaignLead.update({
                where: { id: cl.id },
                data: { isCompleted: true, lastActionAt: new Date() },
            }).catch(() => {});
            await transitionLead(campaignId, cl.leadId, 'COMPLETED', {
                reason: 'sequence_finished',
            }).catch(err => console.error(`[CAMPAIGN] transitionLead COMPLETED failed: ${err.message}`));
        } else if (result.status === 'failed') {
            summary.failed++;
            // Engine-level failure (warmup-fatal, browser-crashed, etc.).
            // Lead-level paused statuses (replied / deferred) are already
            // transitioned by the runLead body and shouldn't be overwritten.
            await transitionLead(campaignId, cl.leadId, 'FAILED', {
                reason: result.failedAt || 'unknown',
            }).catch(err => console.error(`[CAMPAIGN] transitionLead FAILED failed: ${err.message}`));
        } else {
            // 'paused' — runLead already transitioned (REPLIED / DEFERRED / STALLED).
            summary.failed++;
        }

        // Gap between leads — 30–120s. Tight enough that a campaign of
        // ~20 leads still finishes inside the working window, wide enough
        // that the inter-action timing distribution doesn't look mechanical.
        await wait(randomRange(30000, 120000));
    }

    summary.completedAt = new Date().toISOString();

    // ---- Print summary ----
    console.log(`\n${'='.repeat(50)}`);
    console.log(`[CAMPAIGN] SUMMARY`);
    console.log(`${'='.repeat(50)}`);
    console.log(`Total Leads:  ${summary.totalLeads}`);
    console.log(`Succeeded:    ${summary.succeeded}`);
    console.log(`Failed:       ${summary.failed}`);
    console.log('');

    for (const lr of summary.leadResults) {
        const icon = lr.status === 'completed' ? '✅' : '❌';
        const nodes = lr.nodesExecuted
            .map(n => {
                const nIcon = n.status === 'success' ? '✅' : '❌';
                return `${n.node}${nIcon}`;
            })
            .join(' → ');
        console.log(`${icon} ${lr.leadName}: ${nodes}`);

        // Print errors
        for (const n of lr.nodesExecuted) {
            if (n.status === 'failed') {
                console.log(`   [${n.node}] ${n.error}`);
            }
        }
        // Engine-level errors (browser launch, session, proxy missing, etc.)
        // no longer ride as a fake profile-visit node row — they live on
        // execResult.error/failedAt directly. Surface them here.
        if (lr.error && lr.failedAt && !lr.nodesExecuted.some(n => n.status === 'failed' && n.error === lr.error)) {
            console.log(`   [${lr.failedAt}] ${lr.error}`);
        }
    }

    console.log(`${'='.repeat(50)}\n`);

    // Status is computed from lead aggregates by `recomputeCampaignStatus`,
    // which runs on every terminal lead transition. Leads that are deferred
    // (cap / off-hours / delay) remain non-terminal — the campaign stays
    // ACTIVE and the cron picks them up later. We trigger one final recompute
    // here as a safety net for the all-terminal case where the last
    // transition slipped past the inline call (e.g. fire-and-forget races).
    await recomputeCampaignStatus(campaignId).catch(() => {});

    return summary;
}
