import { NodeHandler, NodeResult, SendMessageOutput } from '../types';
import { resolveVariables } from '../variables';
import { generateAIMessage } from '../ai-service';
import { detectConnectionState } from '../connection-state';

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
    const { page, lead, storedOutputs, campaign, aiContext } = ctx;
    const rawText = config.message || config.text || 'Hello!';
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

                // Prefer freshly-scraped data from a prior profile-visit step in the
                // same workflow; fall back to whatever's on the Lead row (set at
                // import / from prior runs) so AI generation isn't blank-slate
                // when the workflow has no profile-visit step.
                const pv = storedOutputs['profile-visit'] || {};
                const profileData = {
                    name: profileName,
                    headline:   pv.headline   || pv.jobTitle   || lead.headline  || lead.jobTitle || null,
                    location:   pv.location   || lead.location || null,
                    company:    pv.company    || lead.company  || null,
                    jobTitle:   pv.jobTitle   || lead.jobTitle || null,
                    about:      pv.about      || lead.aboutInfo || null,
                    experience: pv.experience || [],
                    education: pv.education || [],
                };
                
                // Campaign context for personalized outreach
                const campaignContext = {
                    objective: campaign?.objective || 'Connect with prospects',
                    description: campaign?.campaignDescription || campaign?.objective || null,
                    tone: tone,
                    cta: cta,
                    persona: campaign?.persona,
                    valueProp: campaign?.valueProp,
                };
                
                const aiResult = await generateAIMessage({
                    profileName: profileData.name,
                    profileHeadline: profileData.headline || undefined,
                    company: profileData.company || undefined,
                    jobTitle: profileData.jobTitle || undefined,
                    location: profileData.location || undefined,
                    about: profileData.about || undefined,
                    experience: profileData.experience,
                    education: profileData.education,
                    connectionContext: campaignContext.objective || undefined,
                    campaignDescription: campaignContext.description || undefined,
                    tone: campaignContext.tone,
                    cta: campaignContext.cta,
                    persona: campaignContext.persona || aiContext?.userContext?.persona || undefined,
                    valueProposition: campaignContext.valueProp || aiContext?.userContext?.valueProp || undefined,
                    aiStrategy: aiContext?.aiStrategy,
                    userContext: aiContext?.userContext,
                    // Phase C
                    channel: 'linkedin',
                    aiPrompt: (config as any).aiPrompt,
                    campaignProgress: (ctx as any).campaignProgress,
                    messageHistory: (ctx as any).messageHistory,
                });
                const aiMessage = aiResult.message;
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

        console.log(`[SEND-MESSAGE] Navigating to profile...`);
        await safeGoto(page, lead.linkedinUrl);
        await wait(randomRange(12000, 18000));

        // Connection-degree gate.
        //
        // LinkedIn renders an `<a href="/messaging/compose/?profileUrn=...">`
        // on the profile iff the current session can DM this lead right now
        // (1st-degree OR Open Profile). The old heuristic looked for a
        // `<button>Message</button>` which no longer exists in LinkedIn's
        // new design system — that produced false negatives where we'd
        // skip messages that COULD have been sent (we caught this in the
        // Sandhya smoke).
        //
        // detectConnectionState() reads the compose link AND the invite
        // link bound to this lead's vanity slug, so:
        //   compose present  → DMable, proceed
        //   no compose + invite link → unconnected, skip cleanly
        //   neither           → DOM didn't render, skip with anomaly reason
        const state = await detectConnectionState(page, lead.linkedinUrl);
        if (!state.isDmable) {
            const reason = state.needsConnect ? 'not_connected'
                : state.invitePending ? 'not_connected'
                : 'no_message_ui';
            console.log(`[SEND-MESSAGE] Skipping — isDmable=false (needsConnect=${state.needsConnect}, invitePending=${state.invitePending}, unknown=${state.isUnknown}).`);
            output.sent = false;
            output.skipped = true;
            output.skipReason = reason;
            return { success: true, output };
        }
        console.log(`[SEND-MESSAGE] Compose link found — proceeding with send.`);

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

        // Reuse the compose URL the gate already extracted. detectConnectionState
        // waits for the link to be attached, so this is always populated when
        // we got past the isDmable check above.
        const composeUrl: string | null = state.composeUrl;

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
