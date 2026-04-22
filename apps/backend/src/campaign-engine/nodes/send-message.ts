import { NodeHandler, NodeResult, SendMessageOutput } from '../types';
import { resolveVariables } from '../variables';
import { generateAIMessage } from '../ai-service';

const wait = (ms: number) => new Promise(res => setTimeout(res, ms));
const randomRange = (min: number, max: number) => Math.floor(Math.random() * (max - min + 1) + min);

/**
 * Converts single-brace {variable} to double-brace {{variable}} for resolveVariables.
 * The campaign builder UI uses {firstName} syntax but the resolver expects {{firstName}}.
 */
function normalizeBraces(text: string): string {
    // Convert {var} to {{var}} but don't double-convert {{var}}
    return text.replace(/\{([^{}]+)\}/g, '{{$1}}');
}

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
    const { page, lead, storedOutputs, campaign } = ctx;
    const rawText = config.message || config.text || 'Hello!';
    const requireConnection = config.requireConnection || false;
    const aiEnabled = config.aiEnabled || false;
    const tone = config.tone || campaign?.toneOverride || 'professional';
    const cta = config.cta || campaign?.cta || 'connect';

    const output: SendMessageOutput = { messageText: '', sent: false };

    try {
        let messageText: string;
        if (aiEnabled) {
            console.log('[SEND-MESSAGE] Generating AI message...');
            try {
                const profileName = `${lead.firstName || ''} ${lead.lastName || ''}`.trim() || 'User';
                let aiMessage = await generateAIMessage({
                    profileName,
                    connectionContext: campaign?.objective,
                    tone,
                    cta,
                    persona: campaign?.persona,
                    valueProposition: campaign?.valueProp,
                });
                if (aiMessage && aiMessage.length > 10) {
                    messageText = aiMessage;
                    console.log('[SEND-MESSAGE] AI message generated:', messageText.substring(0, 50) + '...');
                } else {
                    console.log('[SEND-MESSAGE] AI output invalid, using fallback');
                    messageText = resolveVariables(normalizeBraces(rawText), { storedOutputs, lead });
                }
            } catch (aiError: any) {
                console.error('[SEND-MESSAGE] AI generation failed, using fallback:', aiError.message);
                messageText = resolveVariables(normalizeBraces(rawText), { storedOutputs, lead });
            }
        } else {
            messageText = resolveVariables(normalizeBraces(rawText), { storedOutputs, lead });
        }
        output.messageText = messageText;

        if (requireConnection) {
            const isConnected = await page.isVisible('button:has-text("Message")');
            if (!isConnected) {
                return { success: false, error: 'Not connected. Cannot send message.' };
            }
        }

        console.log(`[SEND-MESSAGE] Navigating to profile...`);
        await safeGoto(page, lead.linkedinUrl);
        await wait(randomRange(12000, 18000));

        // Dismiss any premium overlays first
        const dismissSelectors = [
            'button[aria-label="Dismiss"]',
            'button.artdeco-modal__dismiss',
            '[data-testid="modal-layer"] button',
        ];
        for (const sel of dismissSelectors) {
            const dismissBtn = page.locator(sel).first();
            if (await dismissBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
                await dismissBtn.click({ force: true });
                await wait(1000);
                break;
            }
        }

        // Strategy 1: Extract compose URL from profile (like testscripts/phase2_cookie_message.js)
        console.log(`[SEND-MESSAGE] Looking for compose URL on: ${page.url()}`);
        
        // Try extracting compose URL, with a retry after extra wait
        let composeUrl: string | null = null;
        for (let attempt = 0; attempt < 2; attempt++) {
            composeUrl = await page.evaluate(() => {
                // Log all links that contain 'messaging' for debugging
                const allMsgLinks = Array.from(document.querySelectorAll('a[href*="messaging"]'));
                if (allMsgLinks.length > 0) {
                    console.log('[SEND-MESSAGE-EVAL] Found messaging links:', allMsgLinks.map((l: any) => l.href));
                }
                const link = document.querySelector('a[href*="/messaging/compose/?profileUrn"]');
                return link ? (link as HTMLAnchorElement).href : null;
            });

            if (composeUrl) break;
            
            if (attempt === 0) {
                console.log('[SEND-MESSAGE] Compose URL not found on first try. Waiting for async render...');
                await wait(randomRange(5000, 8000));
            }
        }

        if (composeUrl) {
            console.log('[SEND-MESSAGE] Found compose URL. Navigating directly...');
            await safeGoto(page, composeUrl);
            await wait(randomRange(15000, 20000));
        } else {
            // Strategy 2: Click Message button
            console.log('[SEND-MESSAGE] No compose URL found. Attempting button clicks...');
            const msgBtnSelectors = [
                'button:has-text("Message")',
                'a:has-text("Message")',
                '.pvs-profile-actions button:has-text("Message")',
                'button[aria-label^="Message"]',
            ];

            let clicked = false;
            for (const sel of msgBtnSelectors) {
                const btn = page.locator(sel).first();
                if (await btn.isVisible({ timeout: 5000 }).catch(() => false)) {
                    console.log(`[SEND-MESSAGE] Clicking message button: ${sel}`);
                    await btn.evaluate((node: any) => node.scrollIntoView({ block: 'center' }));
                    await wait(2000);
                    await btn.click({ force: true });
                    clicked = true;
                    break;
                }
            }

            if (!clicked) {
                console.log('[SEND-MESSAGE] Checking "More" menu for Message...');
                const moreBtn = page.locator('button:has(span:text-is("More")), button[aria-label^="More"]').first();
                if (await moreBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
                    await moreBtn.click({ force: true });
                    await wait(2000);
                    const moreMsgBtn = page.locator('[role="menuitem"]:has-text("Message"), .artdeco-dropdown__item:has-text("Message")').first();
                    if (await moreMsgBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
                        await moreMsgBtn.click({ force: true });
                        clicked = true;
                    }
                }
            }

            if (!clicked) {
                return { success: false, error: 'Message button not found on profile' };
            }

            await wait(randomRange(10000, 15000));
        }

        // Dismiss premium modal if present
        const premiumSelectors = [
            '.artdeco-modal',
            '[data-sdui-screen*="Premium"]',
            '.priva-upsell-modal',
            '.msg-overlay-bubble-header:has-text("Premium")'
        ];
        for (const sel of premiumSelectors) {
            const modal = page.locator(sel).first();
            if (await modal.isVisible({ timeout: 3000 }).catch(() => false)) {
                console.log('[SEND-MESSAGE] Potential blocking modal detected. Attempting to dismiss...');
                const closeBtnList = [
                    'button[aria-label="Dismiss"]',
                    'button.artdeco-modal__dismiss',
                    'button[aria-label="Close"]',
                    '.msg-overlay-bubble-header__control--close'
                ];
                let modalClosed = false;
                for (const closeSel of closeBtnList) {
                    const closeBtn = page.locator(closeSel).first();
                    if (await closeBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
                        await closeBtn.click({ force: true });
                        modalClosed = true;
                        break;
                    }
                }
                if (!modalClosed) {
                    await page.keyboard.press('Escape');
                }
                await wait(2000);
                // We DON'T return failure here anymore, we try to proceed
            }
        }

        // Find textbox and type (like testscripts)
        const textboxSelectors = [
            'div.msg-form__contenteditable[contenteditable="true"]',
            'div[role="textbox"][aria-label^="Write a message"]',
            '[role="textbox"]',
            '.msg-form__contenteditable',
            '.msg-form__textarea',
            'textarea[name="message"]'
        ];

        let textBox: any = null;
        for (const sel of textboxSelectors) {
            const el = page.locator(sel).first();
            if (await el.isVisible({ timeout: 10000 }).catch(() => false)) {
                textBox = el;
                console.log(`[SEND-MESSAGE] Textbox found using: ${sel}`);
                break;
            }
        }

        if (!textBox) {
            // Debug: capture screenshot and page state
            const debugUrl = page.url();
            console.log(`[SEND-MESSAGE] ❌ Textbox not found. Current URL: ${debugUrl}`);
            try {
                await page.screenshot({ path: '/app/step_screenshots/send_msg_textbox_not_found.png' }).catch(() => {});
                console.log('[SEND-MESSAGE] Debug screenshot saved to /app/step_screenshots/send_msg_textbox_not_found.png');
            } catch {}
            return { success: false, error: `Message textbox not found. Page URL: ${debugUrl}` };
        }

        // Click and type (like testscripts)
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

        // Screenshot before sending (uncomment for debugging)
        // await page.screenshot({ path: '/root/linkedin-camp/step_screenshots/send_before_click.png' }).catch(() => {});

        // Send button (like testscripts)
        const sendBtn = page.locator('button.msg-form__send-button').first();
        
        if (await sendBtn.isVisible({ timeout: 10000 }).catch(() => false)) {
            await sendBtn.click({ force: true }); // Native Playwright click like testscripts
            await wait(5000);

            // Screenshot after sending (uncomment for debugging)
            // await page.screenshot({ path: '/root/linkedin-camp/step_screenshots/send_after_click.png' }).catch(() => {});

            // Verify message appears in chat (check for sent message bubble)
            const urlAfterSend = page.url();
            console.log('[SEND-MESSAGE] URL after send:', urlAfterSend);

            const messageAppeared = await page.evaluate((text: string) => {
                const msgs = document.querySelectorAll('.msg-s-event-listitem__body, .msg-s-message-list__event');
                for (const m of msgs) {
                    if (m.textContent?.includes(text.substring(0, 20))) return true;
                }
                return false;
            }, messageText).catch(() => false);

            if (messageAppeared) {
                output.sent = true;
                console.log('[SEND-MESSAGE] Message verified in chat.');
            } else {
                output.sent = true; // Still mark as sent since button was clicked
                console.log('[SEND-MESSAGE] Send button clicked. Could not verify bubble (may still have sent).');
            }
        } else {
            // Try Enter as fallback
            await page.keyboard.press('Enter');
            await wait(3000);
            // await page.screenshot({ path: '/root/linkedin-camp/step_screenshots/send_after_enter.png' }).catch(() => {});
            output.sent = true;
            console.log('[SEND-MESSAGE] Message sent via Enter.');
        }

        return { success: true, output };

    } catch (err: any) {
        return { success: false, error: err.message };
    }
};
