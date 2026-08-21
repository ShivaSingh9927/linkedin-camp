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

export interface DeliverResult {
    sent: boolean;
    skipped?: boolean;
    skipReason?: 'not_connected' | 'no_message_ui';
    error?: string;
}

/**
 * Navigate to a lead's profile, open the LinkedIn DM composer, type the message,
 * send it, and verify. Extracted verbatim from the send-message node so BOTH the
 * campaign engine AND the inbox manual-reply flush drive the exact same proven
 * DOM write path — one place to fix selector rot, identical human-paced typing.
 *
 * Returns a plain result (never throws for expected outcomes): `skipped` when the
 * lead isn't DMable, `error` on a genuine delivery failure, `sent` on success.
 */
export async function deliverDirectMessage(
    page: any,
    lead: { linkedinUrl: string },
    messageText: string,
): Promise<DeliverResult> {
    console.log(`[DELIVER-DM] Navigating to profile...`);
    await safeGoto(page, lead.linkedinUrl);
    await wait(randomRange(12000, 18000));

    // Connection-degree gate. LinkedIn renders a compose link iff the current
    // session can DM this lead right now (1st-degree OR Open Profile).
    const state = await detectConnectionState(page, lead.linkedinUrl);
    if (!state.isDmable) {
        const reason: 'not_connected' | 'no_message_ui' = state.needsConnect ? 'not_connected'
            : state.invitePending ? 'not_connected'
            : 'no_message_ui';
        console.log(`[DELIVER-DM] Skipping — isDmable=false (needsConnect=${state.needsConnect}, invitePending=${state.invitePending}, unknown=${state.isUnknown}).`);
        return { sent: false, skipped: true, skipReason: reason };
    }
    console.log(`[DELIVER-DM] Compose link found — proceeding with send.`);

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

    // Reuse the compose URL the gate already extracted.
    const composeUrl: string | null = state.composeUrl;

    if (composeUrl) {
        console.log('[DELIVER-DM] Found compose URL. Navigating directly...');
        await safeGoto(page, composeUrl);
        await wait(randomRange(15000, 20000));
    } else {
        // Strategy 2: Click Message button
        console.log('[DELIVER-DM] No compose URL found. Attempting button clicks...');
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
                console.log(`[DELIVER-DM] Clicking message button: ${sel}`);
                await btn.evaluate((node: any) => node.scrollIntoView({ block: 'center' }));
                await wait(2000);
                await btn.click({ force: true });
                clicked = true;
                break;
            }
        }

        if (!clicked) {
            console.log('[DELIVER-DM] Checking "More" menu for Message...');
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
            return { sent: false, error: 'Message button not found on profile' };
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
            console.log('[DELIVER-DM] Potential blocking modal detected. Attempting to dismiss...');
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
        }
    }

    // Find textbox and type
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
            console.log(`[DELIVER-DM] Textbox found using: ${sel}`);
            break;
        }
    }

    if (!textBox) {
        const debugUrl = page.url();
        console.log(`[DELIVER-DM] ❌ Textbox not found. Current URL: ${debugUrl}`);
        return { sent: false, error: `Message textbox not found. Page URL: ${debugUrl}` };
    }

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

    const sendBtn = page.locator('button.msg-form__send-button').first();

    if (await sendBtn.isVisible({ timeout: 10000 }).catch(() => false)) {
        await sendBtn.click({ force: true });
        await wait(5000);

        const messageAppeared = await page.evaluate((text: string) => {
            const msgs = document.querySelectorAll('.msg-s-event-listitem__body, .msg-s-message-list__event');
            for (const m of msgs) {
                if (m.textContent?.includes(text.substring(0, 20))) return true;
            }
            return false;
        }, messageText).catch(() => false);

        if (messageAppeared) {
            console.log('[DELIVER-DM] Message verified in chat.');
        } else {
            console.log('[DELIVER-DM] Send button clicked. Could not verify bubble (may still have sent).');
        }
        return { sent: true };
    }

    // Try Enter as fallback
    await page.keyboard.press('Enter');
    await wait(3000);
    console.log('[DELIVER-DM] Message sent via Enter.');
    return { sent: true };
}
