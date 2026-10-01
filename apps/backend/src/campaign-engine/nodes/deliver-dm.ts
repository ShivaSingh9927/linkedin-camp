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
    /**
     * Did we SEE the message land in the thread? This is now the ONLY evidence
     * that decides `sent`.
     *
     * It used to return `sent: true, verified: false` and call that an honest
     * "probably", on the reasoning that a false failure risks a duplicate DM.
     * That reasoning assumed unverified meant "sent but unconfirmed". On
     * 2026-09-30 two DMs reported sent+unverified and the account owner
     * confirmed neither had been sent at all — the verifier was right and the
     * `sent` flag was the lie. The old bubble check was also class-based, so on
     * LinkedIn's obfuscated build it could never see a real send, which made
     * "unverified" the permanent state for those accounts rather than a rarity.
     */
    verified?: boolean;
    /** What the composer looked like when a send could not be confirmed. */
    diagnostics?: string;
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

    // What the composer looked like when a send could not be confirmed.
    // "Send click refused (Timeout)" alone could not say whether the button was
    // disabled, covered by an overlay, or simply absent — and the worker log
    // holding it is gone after a container recreate. Carried back on the result
    // so it reaches ActionLog and survives.
    const describeComposer = async (): Promise<string> => page.evaluate(() => {
        const btn = document.querySelector('button.msg-form__send-button')
            || Array.from(document.querySelectorAll('button')).find(
                (b) => (b.textContent || '').trim().toLowerCase() === 'send');
        if (!btn) return 'send button: absent';
        const r = btn.getBoundingClientRect();
        const atPoint = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
        const describe = (el: Element | null) => el
            ? `${el.tagName.toLowerCase()}${el.getAttribute('aria-label') ? `[${el.getAttribute('aria-label')}]` : ''}`
            : 'nothing';
        const editor = document.querySelector(
            'div.msg-form__contenteditable[contenteditable="true"], '
            + 'div[role="textbox"][aria-label^="Write a message"]',
        );
        const held = ((editor as any)?.innerText || '').trim().length;
        return `send button: disabled=${(btn as any).disabled} aria-disabled=${btn.getAttribute('aria-disabled')} `
            + `visible=${r.width > 0 && r.height > 0} coveredBy=${describe(atPoint)} `
            + `composerChars=${held} focused=${editor ? editor.contains(document.activeElement) : 'no-editor'}`;
    }).catch(() => 'composer state unreadable');

    // Focus the composer, and CHECK that focus actually landed.
    //
    // This was `click({ force: true })`, which skips Playwright's actionability
    // checks — so when anything overlays the composer the click went to the
    // overlay, focus never reached the editor, and every keystroke after it was
    // typed into the page body. The editor stayed empty, LinkedIn kept Send
    // disabled, and the click on that disabled button timed out. That is the
    // whole failure, and it was invisible because nothing ever asked where the
    // text went. Observed 2026-10-01: "send button: disabled=true".
    const focusEditor = async (): Promise<boolean> => {
        // An ordinary click first: if something covers the composer we want to
        // know, not to punch through it.
        await textBox.click({ timeout: 5000 }).catch(async (e: any) => {
            console.log(`[DELIVER-DM] Composer click refused (${(e?.message || '').split('\n')[0]}) — focusing directly.`);
            await textBox.evaluate((el: any) => el.focus()).catch(() => {});
        });
        await wait(500);
        return textBox.evaluate((el: any) => document.activeElement === el
            || el.contains(document.activeElement)).catch(() => false);
    };

    let focused = await focusEditor();
    if (!focused) {
        console.log('[DELIVER-DM] Composer did not take focus on the first attempt — retrying.');
        await textBox.evaluate((el: any) => el.focus()).catch(() => {});
        await wait(500);
        focused = await textBox.evaluate((el: any) => document.activeElement === el
            || el.contains(document.activeElement)).catch(() => false);
    }
    if (!focused) {
        const diagnostics = await describeComposer();
        console.log(`[DELIVER-DM] Composer never took focus — not typing into the void. ${diagnostics}`);
        return { sent: false, verified: false, diagnostics, error: `Message composer could not be focused. ${diagnostics}` };
    }

    for (const char of messageText) {
        await page.keyboard.type(char, { delay: randomRange(40, 90) });
    }
    await wait(randomRange(2000, 3000));

    // Jiggle to trigger React state
    await page.keyboard.press('Space');
    await page.keyboard.press('Backspace');
    await wait(1000);

    // The text must be IN the editor before we try to send. If it isn't, the
    // keystrokes went somewhere else and Send will be disabled — clicking it
    // then produces an 8-second timeout and no message, which is exactly what
    // happened on 2026-09-30 and again on 2026-10-01.
    const typed = await textBox.evaluate((el: any) => (el.innerText || el.textContent || '').trim())
        .catch(() => '');
    if (!typed.includes(messageText.substring(0, 25))) {
        const diagnostics = await describeComposer();
        console.log(`[DELIVER-DM] Composer holds ${typed.length} chars but not our message — the keystrokes did not land. ${diagnostics}`);
        return {
            sent: false,
            verified: false,
            diagnostics,
            error: `Message text never reached the composer (held ${typed.length} chars). ${diagnostics}`,
        };
    }

    // Poll for the bubble instead of checking once. A single check 5s after the
    // click called plenty of real sends "unverifiable" purely because the thread
    // hadn't re-rendered yet, which is how a genuine signal got written off as
    // noise and the result reported as sent regardless.
    // Search the rendered TEXT, not class-named containers.
    //
    // Both selectors here were class-based, and LinkedIn ships an obfuscated
    // build where those classes do not exist — the same split that made the
    // comment node unverifiable on rajaji while working on another account. On
    // that build this check could never return true, so every genuine send was
    // "unverified" too, and the signal was written off as noise. Matching the
    // message text anywhere outside the composer works on either build.
    const bubbleAppeared = async (attempts = 6, gapMs = 2500): Promise<boolean> => {
        for (let i = 0; i < attempts; i++) {
            const seen = await page.evaluate((text: string) => {
                const needle = text.substring(0, 40);
                const body = (document.body as any)?.innerText || '';
                // The draft is still sitting in the composer, so a naive page
                // match would always succeed. Cut the composer's own text out.
                const composer = document.querySelector(
                    'div.msg-form__contenteditable[contenteditable="true"], '
                    + 'div[role="textbox"][aria-label^="Write a message"]',
                );
                const draft = (composer as any)?.innerText || '';
                const outside = draft ? body.split(draft).join(' ') : body;
                return outside.includes(needle);
            }, messageText).catch(() => false);
            if (seen) return true;
            if (i < attempts - 1) await wait(gapMs);
        }
        return false;
    };

    const sendBtn = page.locator('button.msg-form__send-button').first();

    // State BEFORE the click. Read afterwards it is ambiguous: a successful
    // send also clears the composer and disables Send, so "disabled=true" in a
    // post-mortem could mean either "never sendable" or "already sent".
    console.log(`[DELIVER-DM] About to send — ${await describeComposer()}`);

    if (await sendBtn.isVisible({ timeout: 10000 }).catch(() => false)) {
        // Same reasoning as connect/comment: force:true suppresses the
        // "covered by another element" error, which is how an intercepted click
        // passes for a real one. The overlays that cause it (messaging bubbles,
        // dropdowns) live exactly where LinkedIn docks this composer.
        try {
            await sendBtn.click({ timeout: 8000 });
        } catch (e: any) {
            const why = (e?.message || '').split('\n')[0];
            console.log(`[DELIVER-DM] Send click refused (${why}) — retrying forced.`);
            await sendBtn.click({ force: true });
        }
        await wait(2500);

        const verified = await bubbleAppeared();
        if (verified) {
            console.log('[DELIVER-DM] Message verified in chat.');
            return { sent: true, verified: true };
        }
        const diagnostics = await describeComposer();
        console.log(`[DELIVER-DM] Send clicked but the message never appeared in the thread. ${diagnostics}`);
        return { sent: false, verified: false, diagnostics, error: `Message did not appear after send. ${diagnostics}` };
    }

    // Enter fallback. This used to press Enter and return sent:true with no
    // check whatsoever — the same shape as the connect node's fallback, which
    // invented invitations that were never sent. Enter IS a legitimate way to
    // send in LinkedIn's composer, so keep it, but hold it to the same evidence
    // as the button path.
    await page.keyboard.press('Enter');
    await wait(2500);
    if (await bubbleAppeared()) {
        console.log('[DELIVER-DM] Message verified in chat (sent via Enter).');
        return { sent: true, verified: true };
    }
    const enterDiag = await describeComposer();
    console.log(`[DELIVER-DM] Enter pressed but the message never appeared in the thread. ${enterDiag}`);
    return { sent: false, verified: false, diagnostics: enterDiag, error: `Message did not appear after Enter. ${enterDiag}` };
}
