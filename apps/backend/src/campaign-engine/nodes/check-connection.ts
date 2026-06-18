import { NodeHandler, NodeResult, CheckConnectionOutput } from '../types';
import { prisma } from '@repo/db';
import { detectConnectionState } from '../connection-state';

const wait = (ms: number) => new Promise(res => setTimeout(res, ms));
const randomRange = (min: number, max: number) => Math.floor(Math.random() * (max - min + 1) + min);

async function safeGoto(page: any, url: string, retries = 3) {
    for (let i = 0; i < retries; i++) {
        try {
            await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
            return true;
        } catch (err: any) {
            if (i === retries - 1) throw err;
            await wait(3000);
        }
    }
}

export const checkConnection: NodeHandler = async (ctx): Promise<NodeResult> => {
    const { page, lead, campaignId } = ctx;

    const output: CheckConnectionOutput = {
        connectionStatus: 'not_connected',
        connected: false
    };

    try {
        console.log(`[CHECK-CONNECTION] Re-visiting profile: ${lead.linkedinUrl}`);
        
        await safeGoto(page, lead.linkedinUrl);
        await wait(randomRange(4000, 6000));

        await page.mouse.wheel(0, 600);
        await wait(2000);

        const url = page.url();
        if (url.includes('authwall') || url.includes('login') || url.includes('checkpoint')) {
            return { success: false, error: `Session invalid. Redirected to: ${url}` };
        }

        const state = await detectConnectionState(page, lead.linkedinUrl);
        // "Connected" here means "we can DM right now" — which covers
        // 1st-degree and Open Profile. The pending case is intentionally
        // NOT marked connected (we can't message yet).
        output.connected = state.isDmable;
        output.connectionStatus = state.isDmable ? 'connected'
            : (state.invitePending ? 'pending' : 'not_connected');
        if (state.connectionDegree != null) output.connectionDegree = state.connectionDegree;

        console.log(`[CHECK-CONNECTION] Connection status: ${output.connectionStatus}, degree: ${output.connectionDegree ?? 'unknown'}`);

        if (campaignId) {
            try {
                // Upsert (not update): quick-launch/template campaigns may not
                // have a CampaignLeadProgress row yet, so a bare update threw
                // "Record to update not found" (non-fatal but noisy). Matches
                // the check-connection-voyager behaviour.
                await prisma.campaignLeadProgress.upsert({
                    where: {
                        campaignId_leadId: {
                            campaignId,
                            leadId: lead.id
                        }
                    },
                    create: {
                        campaignId,
                        leadId: lead.id,
                        connectionStatus: output.connectionStatus,
                        lastConnectionCheck: new Date(),
                        needsRetry: !output.connected,
                        currentNodeIndex: 0,
                    },
                    update: {
                        connectionStatus: output.connectionStatus,
                        lastConnectionCheck: new Date(),
                        needsRetry: !output.connected,
                        updatedAt: new Date()
                    }
                });
                console.log(`[CHECK-CONNECTION] Updated progress: ${output.connectionStatus}`);
            } catch (err) {
                console.log(`[CHECK-CONNECTION] Could not update progress: ${err}`);
            }
        }

        // Mirror to Lead.status so IF_ELSE source='connectionState' reads
        // ground truth. Without this, a downstream IF_ELSE(connected) right
        // after CHECK_CONNECTION would still see the stale status set by
        // the upstream CONNECT (e.g. 'PENDING' even though the lead just
        // accepted). Only upgrade to CONNECTED — never downgrade past
        // CONNECTED (a previously-accepted lead who LinkedIn now hides
        // shouldn't lose their CONNECTED state silently).
        const leadUpdate: any = {};
        if (output.connected) leadUpdate.status = 'CONNECTED';
        // Same write-only-when-confident discipline for degree: don't wipe
        // a previously-known value with null if today's probe failed to
        // read the badge.
        if (output.connectionDegree != null) leadUpdate.connectionDegree = output.connectionDegree;
        if (Object.keys(leadUpdate).length > 0) {
            try {
                await prisma.lead.update({
                    where: { id: lead.id },
                    data: leadUpdate,
                });
            } catch (err) {
                console.log(`[CHECK-CONNECTION] Could not update Lead row: ${err}`);
            }
        }

        return { success: true, output };

    } catch (err: any) {
        return { success: false, error: err.message };
    }
};