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

        // Find Connect button
        let connectBtn = page.locator('button:has(span:text-is("Connect"))').first();

        if (!(await connectBtn.isVisible({ timeout: 5000 }).catch(() => false))) {
            // Check "More" menu
            const moreBtn = page.locator('button:has(span:text-is("More"))').first();
            if (await moreBtn.isVisible()) {
                await moreBtn.evaluate((el: any) => el.click());
                await wait(randomRange(1500, 2500));
                connectBtn = page.locator('[role="menuitem"]:has-text("Connect"), [role="menuitem"] span:text-is("Connect")').first();
            }
        }

        if (await connectBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
            await connectBtn.evaluate((el: any) => el.click());
            await wait(randomRange(2500, 4000));

            // Handle the modal — click Send
            const sendBtn = page.locator('button[aria-label="Send now"], button:has(span:text-is("Send without a note")), button:has(span:text-is("Send"))').first();

            if (await sendBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
                await sendBtn.evaluate((el: any) => el.click());
                console.log('[CONNECT] Connection request sent.');
                output.status = 'sent';
                return { success: true, output };
            } else {
                return { success: false, error: 'Connect modal opened but Send button not found' };
            }
        } else {
            return { success: false, error: 'Connect button not found on profile' };
        }

    } catch (err: any) {
        return { success: false, error: err.message };
    }
};
