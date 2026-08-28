import { NodeHandler, NodeResult, CheckConnectionOutput } from '../types';
import { prisma } from '@repo/db';
import { detectConnectionState } from '../connection-state';
import { syncLeadStatus } from '../safety/lifecycle';

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
        //
        // state.isUnknown means none of the signals rendered — LinkedIn served
        // us a shell page or blocked the read. That is NOT a negative, and
        // reporting it as one is how the gate learned to skip real
        // connections. Say 'unknown' and let the caller decide.
        if (state.isUnknown) {
            output.connected = null;
            output.connectionStatus = 'unknown';
        } else {
            output.connected = state.isDmable;
            output.connectionStatus = state.isDmable ? 'connected'
                : (state.invitePending ? 'pending' : 'not_connected');
        }
        if (state.connectionDegree != null) output.connectionDegree = state.connectionDegree;

        console.log(`[CHECK-CONNECTION] Connection status: ${output.connectionStatus}, degree: ${output.connectionDegree ?? 'unknown'}`);

        // Keep the in-flight context in step so a downstream IF_ELSE reading
        // `connectionStatus` sees this probe's answer, not the run's seed.
        ctx.connectionStatus = output.connectionStatus;

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

        // Persist the degree only (write-only-when-confident: don't wipe a known
        // value with null if today's probe couldn't read the badge). The coarse
        // status (Lead.status / CampaignLead.status) is NO LONGER written here —
        // the connectionStatus upsert above is the truth, and syncLeadStatus below
        // projects it, so IF_ELSE(connectionState) and the dashboards stay in step
        // without a second, drift-prone write.
        if (output.connectionDegree != null) {
            try {
                await prisma.lead.update({ where: { id: lead.id }, data: { connectionDegree: output.connectionDegree } });
            } catch (err) {
                console.log(`[CHECK-CONNECTION] Could not update Lead degree: ${err}`);
            }
        }

        // Single-writer projection of the coarse status from the connectionStatus
        // we just wrote (covers both Lead.status and CampaignLead.status).
        if (campaignId && lead.id) await syncLeadStatus(campaignId, lead.id);

        return { success: true, output };

    } catch (err: any) {
        return { success: false, error: err.message };
    }
};