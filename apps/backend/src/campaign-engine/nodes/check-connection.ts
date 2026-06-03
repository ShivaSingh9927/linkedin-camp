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

        console.log(`[CHECK-CONNECTION] Connection status: ${output.connectionStatus}`);

        if (campaignId) {
            try {
                await prisma.campaignLeadProgress.update({
                    where: {
                        campaignId_leadId: {
                            campaignId,
                            leadId: lead.id
                        }
                    },
                    data: {
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
        if (output.connected) {
            try {
                await prisma.lead.update({
                    where: { id: lead.id },
                    data: { status: 'CONNECTED' },
                });
            } catch (err) {
                console.log(`[CHECK-CONNECTION] Could not update Lead.status: ${err}`);
            }
        }

        return { success: true, output };

    } catch (err: any) {
        return { success: false, error: err.message };
    }
};