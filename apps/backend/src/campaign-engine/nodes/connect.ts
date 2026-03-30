import { NodeHandler, NodeResult, ConnectOutput } from '../types';

const wait = (ms: number) => new Promise(res => setTimeout(res, ms));
const randomRange = (min: number, max: number) => Math.floor(Math.random() * (max - min + 1) + min);

export const connect: NodeHandler = async (ctx): Promise<NodeResult> => {
    const { page, lead } = ctx;

    const output: ConnectOutput = { status: 'failed' };

    try {
        console.log(`[CONNECT] Checking connection status for ${lead.firstName}...`);

        // Already pending?
        const isPending = await page.isVisible('button:has-text("Pending"), button:has-text("Withdraw"), button:has-text("Requested")');
        if (isPending) {
            console.log('[CONNECT] Connection already pending.');
            output.status = 'pending';
            return { success: true, output };
        }

        // Already connected?
        const isConnected = await page.isVisible('button:has-text("Message")');
        if (isConnected) {
            console.log('[CONNECT] Already a 1st degree connection.');
            output.status = 'already_connected';
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
                return { success: true, output };
            } else {
                // Try pressing Enter as fallback
                await page.keyboard.press('Enter');
                await wait(2000);
                const url = page.url();
                if (!url.includes('connect') && !url.includes('invitation')) {
                    console.log('[CONNECT] Connection sent (URL changed).');
                    output.status = 'sent';
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
