import { NodeHandler, NodeResult, ConnectOutput } from '../types';
import { prisma } from '@repo/db';
import { detectConnectionState } from '../connection-state';

const wait = (ms: number) => new Promise(res => setTimeout(res, ms));
const randomRange = (min: number, max: number) => Math.floor(Math.random() * (max - min + 1) + min);

export const connect: NodeHandler = async (ctx): Promise<NodeResult> => {
    const { page, lead, campaignId } = ctx;

    const output: ConnectOutput = { status: 'failed' };

    try {
        console.log(`[CONNECT] Checking connection status for ${lead.firstName}...`);

        const state = await detectConnectionState(page, lead.linkedinUrl);

        if (state.invitePending) {
            console.log(`[CONNECT] Connection already pending (${state.pendingAriaLabel}).`);
            output.status = 'pending';
            if (campaignId) await updateConnectionStatus(campaignId, lead.id, 'pending');
            return { success: true, output };
        }

        if (state.isDmable) {
            // composeUrl present — either 1st-degree or Open Profile. Either
            // way no invite is needed; treat as already_connected so the
            // downstream send-message step proceeds.
            console.log('[CONNECT] Already DMable (1st-degree or Open Profile).');
            output.status = 'already_connected';
            if (campaignId) await updateConnectionStatus(campaignId, lead.id, 'connected');
            return { success: true, output };
        }

        // Find Connect button (using testscript proven selector)
        let connectBtn = page.locator('[aria-label*="to connect"]').first();

        if (!(await connectBtn.isVisible({ timeout: 5000 }).catch(() => false))) {
            // Check "More" menu (like testscripts)
            const moreBtn = page.locator('button:has(span:text-is("More"))').first();
            if (await moreBtn.isVisible()) {
                await moreBtn.evaluate((el: any) => el.click());
                await wait(randomRange(1500, 2000));
                connectBtn = page.locator('[aria-label*="to connect"], a[role="menuitem"]:has-text("Connect")').first();
            }
        }

        if (await connectBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
            // Use evaluate to bypass sticky headers (like testscripts)
            await connectBtn.evaluate((el: any) => el.click());
            console.log('[CONNECT] Connect button clicked, waiting for modal...');
            await wait(randomRange(3000, 4000));

            // Handle the modal — click Send (like testscripts pattern)
            const sendBtn = page.locator(
                'button[aria-label="Send now"], ' +
                'button:has(span:text-is("Send without a note")), ' +
                'button:has(span:text-is("Send")), ' +
                'button[aria-label="Send invitation"], ' +
                'button:has-text("Send now")'
            ).first();

            if (await sendBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
                await sendBtn.evaluate((el: any) => el.click());
                console.log('[CONNECT] Connection request sent.');
                output.status = 'sent';
                
                if (campaignId) {
                    await updateConnectionStatus(campaignId, lead.id, 'pending');
                }
                return { success: true, output };
            } else {
                // Try pressing Enter as fallback
                await page.keyboard.press('Enter');
                await wait(2000);
                const url = page.url();
                if (!url.includes('connect') && !url.includes('invitation')) {
                    console.log('[CONNECT] Connection sent (URL changed).');
                    output.status = 'sent';
                    
                    if (campaignId) {
                        await updateConnectionStatus(campaignId, lead.id, 'pending');
                    }
                    return { success: true, output };
                }
                return { success: false, error: 'Connect modal opened but Send button not found' };
            }
        } else {
            return { success: false, error: 'Connect button not found on profile' };
        }

    } catch (err: any) {
        return { success: false, error: err.message };
    }
};

async function updateConnectionStatus(campaignId: string, leadId: string, status: 'connected' | 'pending' | 'not_connected') {
    try {
        await prisma.campaignLeadProgress.upsert({
            where: {
                campaignId_leadId: {
                    campaignId,
                    leadId
                }
            },
            create: {
                campaignId,
                leadId,
                connectionStatus: status,
                currentNodeIndex: 0,
                needsRetry: status === 'not_connected'
            },
            update: {
                connectionStatus: status,
                lastConnectionCheck: new Date(),
                needsRetry: status === 'not_connected',
                updatedAt: new Date()
            }
        });
        console.log(`[CONNECT] Updated connection status to: ${status}`);
    } catch (err) {
        console.log(`[CONNECT] Could not update progress: ${err}`);
    }
}
