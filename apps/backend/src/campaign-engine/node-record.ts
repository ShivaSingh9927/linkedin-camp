// Everything that must happen after a node runs — wherever it ran.
//
// This used to live inline in runLead's loop, which meant it only ever applied
// to top-level nodes. IF_ELSE executes its branch inline, and the DAG compiler
// gives a conditional BOTH downstream paths ("IF_ELSE consumes both downstream
// paths — the linear walk terminates here"), so for any template with a gate
// the majority of the sequence runs inside a branch. All of it was invisible:
//
//   - no ActionLog row, so the activity feed and audit log showed a bare
//     `if-else` where a profile visit, an invite and two messages had run
//   - no Message row, so DMs sent from a branch never reached the inbox and
//     the reply-pause check could not see them
//   - no CRM event, so nothing fanned out to connected integrations
//   - no lead enrichment from a branch profile-visit
//   - no coarse status projection from a branch connect
//
// Found 2026-09-30: two DMs ran inside a branch and left no trace in any table.
//
// Engine-local state (storedOutputs, nodesExecuted, the resume cursor) stays in
// the engine — this owns persistence only, so both callers record identically.

import { prisma } from '@repo/db';
import { NodeExecution, NodeResult, NodeType } from './types';
import { writeNodeOutput, updateLeadEnrichment } from './storage';
import { syncLeadStatus } from './safety/lifecycle';

let io: any = null;
const getSocketIO = async () => {
    if (!io) {
        try {
            io = (await import('../socket')).io;
        } catch { /* socket server not up (worker process) */ }
    }
    return io;
};

export interface RecordArgs {
    userId: string;
    campaignId: string;
    leadId: string;
    leadName: string;
    nodeType: NodeType;
    result: NodeResult;
    /** ISO timestamp of the execution, so branch and top-level rows agree. */
    at: string;
}

/**
 * Persist one node execution: audit row, node output, and the per-node side
 * effects that other parts of the product read back.
 *
 * Never throws — diagnostics must not break the action they describe. Each
 * write is caught independently so one failure cannot swallow the rest.
 */
export async function recordNodeExecution(args: RecordArgs): Promise<void> {
    const { userId, campaignId, leadId, leadName, nodeType, result, at } = args;

    const nodeExec: NodeExecution = {
        node: nodeType,
        status: result.success ? 'success' : 'failed',
        output: result.output,
        error: result.error,
        at,
    };

    // Audit every node execution — personalization.execLog captures it as JSON
    // but isn't queryable from the activity/inbox views.
    await prisma.actionLog.create({
        data: {
            userId,
            campaignId,
            leadId,
            actionType: nodeType,
            status: result.success ? 'SUCCESS' : 'FAILED',
            errorMessage: result.error || null,
        },
    }).catch(err => console.error(`[RECORD] ActionLog write failed: ${err.message}`));

    await writeNodeOutput(campaignId, leadId, nodeExec)
        .catch(err => console.error(`[RECORD] writeNodeOutput failed: ${err.message}`));

    if (!result.success) {
        await emitActivity({ userId, campaignId, leadId, leadName, nodeType, result, at });
        return;
    }

    // Outbound DM → inbox, alongside the replies the sync worker pulls back.
    if (nodeType === 'send-message' && result.output?.sent && result.output?.messageText) {
        await prisma.message.create({
            data: {
                userId,
                leadId,
                campaignId,
                direction: 'SENT',
                content: result.output.messageText,
                // Tag AI-written DMs so the Messages tab shows the "AI" badge
                // and the rationale; template / fallback sends stay 'CAMPAIGN'.
                source: result.output.aiGenerated ? 'AI' : 'CAMPAIGN',
                rationale: result.output.rationale || null,
            },
        }).catch(err => console.error(`[RECORD] Message write failed: ${err.message}`));

        import('../services/crm-events').then(({ emitCrmEvent }) =>
            emitCrmEvent({
                event: 'lead.messaged',
                userId,
                campaignId,
                leadId,
                meta: { messageContent: result.output?.messageText },
            }),
        ).catch(() => {});
    }

    if (nodeType === 'profile-visit' && result.output) {
        await updateLeadEnrichment(leadId, result.output)
            .catch(err => console.error(`[RECORD] enrichment failed: ${err.message}`));
    }

    // Connect sent → project the coarse status. The connect node already wrote
    // connectionStatus='pending'; syncLeadStatus derives PENDING from it.
    // Single writer, so no direct Lead.status poke here.
    if (nodeType === 'connect' && result.output?.status === 'sent') {
        await syncLeadStatus(campaignId, leadId).catch(() => {});
    }

    await emitActivity({ userId, campaignId, leadId, leadName, nodeType, result, at });
}

async function emitActivity(args: RecordArgs): Promise<void> {
    const { userId, campaignId, leadId, leadName, nodeType, result } = args;
    const socket = await getSocketIO();
    if (!socket) return;
    socket.to(`user_${userId}`).emit('campaign_activity', {
        campaignId,
        leadId,
        leadName,
        node: nodeType,
        action: result.success ? 'success' : 'failed',
        details: {
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
        timestamp: args.at,
    });
}
