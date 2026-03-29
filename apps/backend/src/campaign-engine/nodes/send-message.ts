import { NodeHandler, NodeResult, SendMessageOutput } from '../types';
import { resolveVariables } from '../variables';

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

export const sendMessage: NodeHandler = async (ctx, config): Promise<NodeResult> => {
    const { page, lead, storedOutputs } = ctx;
    const rawText = config.text || 'Hello!';
    const requireConnection = config.requireConnection || false;

    const output: SendMessageOutput = { messageText: '', sent: false };

    try {
        // Resolve {{variables}} in message text
        const messageText = resolveVariables(rawText, { storedOutputs, lead });
        output.messageText = messageText;

        // Optional: check if connected
        if (requireConnection) {
            const isConnected = await page.isVisible('button:has-text("Message")');
            if (!isConnected) {
                return { success: false, error: 'Not connected. Cannot send message.' };
            }
        }

        // Navigate to profile first (compose URL is on the profile page)
        console.log(`[SEND-MESSAGE] Navigating to profile...`);
        await safeGoto(page, lead.linkedinUrl);
        await wait(randomRange(12000, 18000));

        console.log(`[SEND-MESSAGE] Looking for compose URL...`);

        // Strategy 1: Direct compose URL
        await page.waitForSelector('a[href*="/messaging/compose"]', { timeout: 10000 }).catch(() => {});

        let composeUrl = await page.evaluate(() => {
            const link = document.querySelector('a[href*="/messaging/compose/?profileUrn"]');
            return link ? (link as HTMLAnchorElement).href : null;
        });

        if (!composeUrl) {
            composeUrl = await page.evaluate(() => {
                const links = Array.from(document.querySelectorAll('a[href*="/messaging/compose"]'));
                const bestMatch = links.find(l => (l as HTMLAnchorElement).href.includes('profileUrn'));
                return bestMatch ? (bestMatch as HTMLAnchorElement).href : null;
            });
        }

        if (composeUrl) {
            console.log('[SEND-MESSAGE] Found compose URL. Navigating directly...');
            await safeGoto(page, composeUrl);
            await wait(randomRange(15000, 20000));
        } else {
            // Strategy 2: Click Message button
            console.log('[SEND-MESSAGE] No compose URL. Clicking Message button...');
            const msgBtnSelectors = [
                '.pvs-profile-actions button:has-text("Message")',
                'button.artdeco-button:has-text("Message")',
                'div.pvs-profile-actions__action button:visible',
            ];

            let clicked = false;
            for (const sel of msgBtnSelectors) {
                const btn = page.locator(sel).first();
                if (await btn.isVisible({ timeout: 3000 }).catch(() => false)) {
                    await btn.evaluate((node: any) => node.scrollIntoView({ block: 'center' }));
                    await wait(1000);
                    await btn.click({ force: true });
                    clicked = true;
                    break;
                }
            }

            if (!clicked) {
                // Check "More" menu
                const moreBtn = page.locator('button:has(span:text-is("More"))').first();
                if (await moreBtn.isVisible()) {
                    await moreBtn.click();
                    await wait(2000);
                    const moreMsgBtn = page.locator('[role="menuitem"]:has-text("Message")').first();
                    if (await moreMsgBtn.isVisible()) {
                        await moreMsgBtn.click();
                        clicked = true;
                    }
                }
            }

            if (!clicked) {
                return { success: false, error: 'Message button not found on profile' };
            }

            await wait(randomRange(5000, 8000));

            // Check for premium modal trap
            const premiumModal = page.locator('[data-sdui-screen*="PremiumUpsellModal"], .artdeco-modal').first();
            if (await premiumModal.isVisible({ timeout: 3000 }).catch(() => false)) {
                console.log('[SEND-MESSAGE] Premium modal detected. Closing...');
                const closeBtn = page.locator('button[aria-label="Dismiss"], button.artdeco-modal__dismiss').first();
                if (await closeBtn.isVisible()) await closeBtn.click();
                else await page.keyboard.press('Escape');
                return { success: false, error: 'Premium upsell modal blocked messaging' };
            }
        }

        // Find textbox and type
        const textboxSelectors = [
            'div.msg-form__contenteditable[contenteditable="true"]',
            '[role="textbox"]',
            '.msg-form__contenteditable',
            '.msg-form__textarea',
        ];

        let textBox = null;
        for (const sel of textboxSelectors) {
            const el = page.locator(sel).first();
            if (await el.isVisible({ timeout: 5000 }).catch(() => false)) {
                textBox = el;
                break;
            }
        }

        if (!textBox) {
            return { success: false, error: 'Message textbox not found' };
        }

        // Type message
        await textBox.click({ force: true });
        await wait(1000);

        for (const char of messageText) {
            await page.keyboard.type(char, { delay: randomRange(40, 90) });
        }
        await wait(randomRange(2000, 3000));

        // Jiggle to trigger React state
        await page.keyboard.press('Space');
        await page.keyboard.press('Backspace');
        await wait(1000);

        // Send — use waitFor + regular click (matches testscript)
        const sendBtn = page.locator('button.msg-form__send-button').first();
        await sendBtn.waitFor({ state: 'visible', timeout: 15000 });
        await sendBtn.click();
        await wait(3000);
        output.sent = true;
        console.log('[SEND-MESSAGE] Message sent.');

        return { success: true, output };

    } catch (err: any) {
        return { success: false, error: err.message };
    }
};
