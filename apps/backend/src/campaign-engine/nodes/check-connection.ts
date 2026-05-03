import { NodeHandler, NodeResult, CheckConnectionOutput } from '../types';
import { prisma } from '@repo/db';

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

        const isMessageBtnVisible = await page.isVisible('button:has-text("Message")');
        const isMessageLinkVisible = await page.isVisible('a:has-text("Message")');
        
        output.connected = isMessageBtnVisible || isMessageLinkVisible;
        output.connectionStatus = output.connected ? 'connected' : 'not_connected';

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

        return { success: true, output };

    } catch (err: any) {
        return { success: false, error: err.message };
    }
};