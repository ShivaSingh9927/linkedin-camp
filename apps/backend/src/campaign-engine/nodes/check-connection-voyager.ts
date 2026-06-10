/**
 * check-connection-voyager.ts
 *
 * HYBRID check-connection that uses Voyager API for the cheap
 * "is this lead in my 1st-degree list?" check. Falls back to DOM when the
 * caller needs the exact degree number (2 vs 3) or needs to detect
 * PENDING invitation state.
 *
 * Voyager gives us: 1st-degree yes/no (binary, derived from the connections
 * list cache).
 * DOM gives us: exact degree (1/2/3), invite pending state, message UI
 * availability.
 *
 * The mode is selected by the node config `mode`:
 *   - 'fast' (default for this node): Voyager only — fast and cheap. Sets
 *     `connected = (isFirstDegree)`. Leaves `connectionDegree` and pending
 *     state unset.
 *   - 'precise': falls back to the DOM node (check-connection.ts) for full
 *     degree + pending state.
 */
import { NodeHandler, NodeResult, CheckConnectionOutput } from '../types';
import { prisma } from '@repo/db';
import { isFirstDegree, getAllConnections } from '../../services/voyager-api.service';
import { checkConnection } from './check-connection';

export const checkConnectionVoyager: NodeHandler = async (ctx, config): Promise<NodeResult> => {
    const { page, lead, userId, campaignId } = ctx;
    const mode = (config as any)?.mode || 'fast';
    const output: CheckConnectionOutput = {
        connectionStatus: 'not_connected',
        connected: false,
    };

    try {
        if (!lead.linkedinUrl) {
            return { success: false, error: 'Lead has no linkedinUrl' };
        }
        if (!page) {
            return { success: false, error: 'check-connection-voyager requires a live Page' };
        }

        // Extract vanity from linkedinUrl
        const vanity = lead.linkedinUrl.split('/in/').pop()?.replace(/\/$/, '').split('?')[0] || '';
        if (!vanity) {
            return { success: false, error: 'Could not extract vanity from linkedinUrl' };
        }

        if (mode === 'precise') {
            // Delegate to the DOM node for full degree + pending state
            return await checkConnection(ctx, config);
        }

        // mode === 'fast': Voyager-only
        const is1st = await isFirstDegree(userId, vanity, page);
        output.connected = is1st;
        output.connectionStatus = is1st ? 'connected' : 'not_connected';

        // Persist Lead.connectionDegree as 1 when we know it; null otherwise
        // (write-only-when-confident so a previous known value isn't wiped).
        if (is1st && lead.id) {
            await prisma.lead.update({
                where: { id: lead.id },
                data: {
                    connectionDegree: 1,
                    status: 'CONNECTED',
                },
            }).catch(() => {});
        } else if (lead.id) {
            // Confirmed NOT 1st-degree — wipe the binary guess from the row
            // (if it was 1) so downstream IF_ELSE checks see accurate state.
            // Don't touch other degrees since we don't know them.
            const current = await prisma.lead.findUnique({
                where: { id: lead.id },
                select: { connectionDegree: true },
            }).catch(() => null);
            if (current?.connectionDegree === 1) {
                await prisma.lead.update({
                    where: { id: lead.id },
                    data: { connectionDegree: null },
                }).catch(() => {});
            }
        }

        // Mirror to CampaignLeadProgress if a campaign context
        if (campaignId && lead.id) {
            await prisma.campaignLeadProgress.upsert({
                where: { campaignId_leadId: { campaignId, leadId: lead.id } },
                create: {
                    campaignId,
                    leadId: lead.id,
                    connectionStatus: output.connectionStatus,
                    lastConnectionCheck: new Date(),
                    needsRetry: !is1st,
                },
                update: {
                    connectionStatus: output.connectionStatus,
                    lastConnectionCheck: new Date(),
                    needsRetry: !is1st,
                    updatedAt: new Date(),
                },
            }).catch(() => {});
        }

        console.log(`[CHECK-CONNECTION-VOYAGER] ${lead.firstName}: ${output.connectionStatus} (mode=${mode})`);
        return { success: true, output };
    } catch (err: any) {
        return { success: false, error: err?.message || String(err) };
    }
};
