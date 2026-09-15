import { NodeHandler, NodeResult, PostOutput } from '../types';
import { resolveVariables } from '../variables';
import { generateAIComment } from '../ai-service';
import { persistDiscoveredPost } from '../storage';
import { getOrDiscoverNthPost } from './post-discovery';
import { actionShot } from './action-shot';

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

export const commentNthPost: NodeHandler = async (ctx, config): Promise<NodeResult> => {
    const { page, lead, storedOutputs, campaign, aiContext, userId } = ctx;
    const n = config.n || 1;
    const rawText = config.text || 'Great insights!';
    const aiEnabled = config.aiEnabled || false;
    const tone = config.tone || campaign?.toneOverride || 'professional';

    const output: PostOutput = { postUrl: null, postContent: null, commented: false, commentText: '' };

    try {
        let postContent = '';

        console.log(`[COMMENT-NTH-POST] Navigating to posts feed (target: post #${n})...`);

        const { post: discovered, emptyFeed } = await getOrDiscoverNthPost(storedOutputs, page, lead.linkedinUrl, n, 'COMMENT-NTH-POST');
        if (!discovered) {
            // No recent post to comment on — deterministic, retire the lead.
            if (emptyFeed) {
                return { success: false, terminal: true, terminalReason: 'no_recent_post', error: 'No recent post found' };
            }
            return { success: false, error: `Post #${n} not found` };
        }

        const postLink = discovered.url;
        output.postUrl = postLink;
        console.log(`[COMMENT-NTH-POST] Found post #${n}. Navigating...`);

        await safeGoto(page, postLink);
        await wait(randomRange(5000, 8000));

        // Expand post content if needed
        try {
            const moreBtn = page.locator('button[data-testid="expandable-text-button"]').first();
            if (await moreBtn.isVisible({ timeout: 3000 })) {
                await moreBtn.click({ force: true });
                await wait(1000);
            }
            postContent = await page.$eval('.update-components-text, [data-testid="expandable-text-box"]', (el: any) => el.innerText).catch(() => '');
            output.postContent = postContent;
        } catch {}

        // Cache the post on the Lead row. profile-visit deliberately skips its
        // own activity-feed scrape when this node is in the flow, so this is what
        // keeps the UI's "Recent post" panel populated. Fire-and-forget: a failed
        // display-field cache must never block the comment.
        persistDiscoveredPost(lead.id, output.postUrl, postContent || null).catch(() => {});

        // Scroll to ensure comment section is rendered
        await page.mouse.wheel(0, 400);
        await wait(2000);

        // Click the post's "Comment" action FIRST. On many posts LinkedIn does
        // not mount the comment editor into the DOM until this button is
        // clicked — so the old code, which jumped straight to hunting for the
        // editor, found nothing and failed with "Comment box not found" on
        // exactly those posts (then the lead re-tried the same dead post up to
        // 3x). Opening the composer explicitly is what makes the editor exist.
        // Best-effort: some layouts render it eagerly, so a miss here is fine.
        try {
            const commentTrigger = page
                .locator('button[aria-label*="Comment"], button:has(span:text-is("Comment"))')
                .first();
            if (await commentTrigger.isVisible({ timeout: 4000 }).catch(() => false)) {
                await commentTrigger.click({ force: true }).catch(() => {});
                await wait(randomRange(1500, 2500));
            }
        } catch { /* editor may already be present */ }

        let commentText: string;
        if (aiEnabled && postContent) {
            console.log('[COMMENT-NTH-POST] Generating AI comment...');
            try {
                const profileName = `${lead.firstName || ''} ${lead.lastName || ''}`.trim() || 'User';
                
                const profileVisitOutput = storedOutputs['profile-visit'];
                
                // Extract all available profile data
                const profileData = {
                    name: profileName,
                    headline: profileVisitOutput?.headline || profileVisitOutput?.jobTitle || null,
                    company: profileVisitOutput?.company || null,
                    jobTitle: profileVisitOutput?.jobTitle || null,
                    location: profileVisitOutput?.location || null,
                    about: profileVisitOutput?.about || null,
                };
                
                // Campaign context
                const campaignContext = {
                    objective: campaign?.objective || 'Engage with prospects',
                    description: campaign?.campaignDescription || campaign?.objective || null,
                    tone: tone,
                    persona: campaign?.persona,
                    valueProp: campaign?.valueProp,
                };
                
                commentText = await generateAIComment({
                    profileName: profileData.name,
                    profileHeadline: profileData.headline || undefined,
                    company: profileData.company || undefined,
                    jobTitle: profileData.jobTitle || undefined,
                    location: profileData.location || undefined,
                    about: profileData.about || undefined,
                    postContent: postContent,
                    campaignDescription: campaignContext.description || undefined,
                    tone: campaignContext.tone,
                    persona: campaignContext.persona || aiContext?.userContext?.persona || undefined,
                    valueProposition: campaignContext.valueProp || aiContext?.userContext?.valueProp || undefined,
                    aiStrategy: aiContext?.aiStrategy,
                    userContext: aiContext?.userContext,
                    // Per-step instructions from the builder's Step Settings.
                    aiPrompt: (config as any).aiPrompt,
                });
                console.log('[COMMENT-NTH-POST] AI comment generated:', commentText.substring(0, 50) + '...');
            } catch (aiError: any) {
                console.error('[COMMENT-NTH-POST] AI generation failed, using fallback:', aiError.message);
                commentText = resolveVariables(rawText, { storedOutputs, lead });
            }
        } else {
            commentText = resolveVariables(rawText, { storedOutputs, lead });
        }
        output.commentText = commentText;

        // Comment box selectors — updated for TipTap/ProseMirror editor
        const commentBoxSelectors = [
            'div[role="textbox"][aria-label*="Add a comment"]',
            'div[data-placeholder="Add a comment…"]',
            'div[data-placeholder="Add a comment"]',
            'div.tiptap.ProseMirror[contenteditable="true"]',
            '[aria-label="Text editor for creating comment"]',
            'div[role="textbox"][aria-label*="Text editor"]',
            'div.ql-editor[contenteditable="true"]',
            '.comments-comment-box__contenteditable',
        ];

        let commentBox: any = null;
        for (const sel of commentBoxSelectors) {
            try {
                const el = page.locator(sel).first();
                if (await el.isVisible({ timeout: 5000 }).catch(() => false)) {
                    commentBox = el;
                    console.log(`[COMMENT-NTH-POST] Comment box found using: ${sel}`);
                    break;
                }
            } catch {}
        }

        if (!commentBox) {
            console.log('[COMMENT-NTH-POST] Comment box not found with any selector');
            return { success: false, error: 'Comment box not found on post' };
        }

        if (await commentBox.isVisible({ timeout: 5000 }).catch(() => false)) {
            await commentBox.scrollIntoViewIfNeeded();
            await commentBox.click({ force: true });
            await wait(1000);

            // Type the comment
            await page.keyboard.type(commentText, { delay: randomRange(30, 60) });
            await wait(randomRange(1500, 2500));

            // Nudge the editor's React state WITHOUT leaving it. The old code
            // clicked the viewport corner (10,10) here "to trigger React" — that
            // lands on whatever sits top-left (nav, a menu, nothing), blurring
            // the composer and, on some layouts, discarding the draft. A
            // keystroke inside the editor produces the same state update while
            // keeping focus where it belongs.
            await page.keyboard.press('Space');
            await page.keyboard.press('Backspace');
            await wait(600);

            // Submit button. SCOPED to the comment form and required to carry a
            // real label — the old list had a bare `button.artdeco-button--primary`
            // second, which matches any primary button on a LinkedIn post page
            // (Follow, Connect, a modal's CTA...). Proven on 2026-09-14: it
            // matched a button whose text was EMPTY, we "clicked" it, and not one
            // of the four comments actually posted.
            // NOTE: an earlier attempt here clicked a "Messaging" control to move
            // the bottom-right overlay away from the composer. It matched the
            // overlay's OVERFLOW menu instead and opened it, covering MORE of the
            // submit area than the overlay did — visible in the 2026-09-15
            // comment_after capture. Removed: the structural submit lookup below
            // dispatches the click to the element itself, so nothing needs that
            // region to be clear.

            const commentForm = page
                .locator('form.comments-comment-box__form, div.comments-comment-box, div[class*="comments-comment-box"]')
                .first();
            const scope = (await commentForm.count().catch(() => 0)) ? commentForm : page;

            // Find submit by STRUCTURE, not class names.
            //
            // LinkedIn serves at least two frontend builds. One has the semantic
            // classes every selector here assumed (artdeco-button--primary,
            // comments-comment-box__submit-button); the other ships OBFUSCATED
            // hashed classes ("_5dfaadcf _11c561b9 …") where none of them exist.
            // Accounts appear pinned to a variant, which is why identical code
            // worked on shivasingh9927 and never on rajaji, and why that looked
            // for most of a day like LinkedIn was blocking one account's writes.
            //
            // Text is stable across both builds, but "Comment" alone also matches
            // the post's action-bar button. So anchor on the editor — the one
            // element we have already located — and walk up to the nearest
            // ancestor that contains a Comment/Post/Reply button. That button is
            // the composer's own submit in either build.
            //
            // The match is tagged with a data attribute so the actual click still
            // goes through Playwright: the working test script notes React's form
            // handler accepts a trusted click and ignores evaluate()-dispatched
            // ones.
            const MARK = 'data-qampi-submit';
            const located = await page.evaluate((mark: string) => {
                const editor = document.querySelector(
                    'div.tiptap.ProseMirror[contenteditable="true"], '
                    + 'div[role="textbox"][aria-label*="Add a comment"], '
                    + 'div[data-placeholder*="Add a comment"]',
                );
                if (!editor) return 'no-editor';
                document.querySelectorAll(`[${mark}]`).forEach((e) => e.removeAttribute(mark));

                let node: any = editor;
                for (let depth = 0; depth < 8 && node; depth++) {
                    node = node.parentElement;
                    if (!node) break;
                    const btn = Array.from(node.querySelectorAll('button')).find((b: any) => {
                        const t = (b.textContent || '').trim().toLowerCase();
                        const a = (b.getAttribute('aria-label') || '').trim().toLowerCase();
                        const isSubmitWord = ['comment', 'post', 'reply'].includes(t)
                            || a.includes('submit comment') || a.includes('post comment');
                        return isSubmitWord && !(b as any).disabled;
                    });
                    if (btn) { (btn as any).setAttribute(mark, '1'); return 'found'; }
                }
                return 'no-button';
            }, MARK).catch(() => 'error');

            let submitBtn: any = null;
            if (located === 'found') {
                submitBtn = page.locator(`[${MARK}="1"]`).first();
                const label = ((await submitBtn.textContent().catch(() => '')) || '').trim();
                console.log(`[COMMENT-NTH-POST] Submit resolved from the editor's container (label: "${label}").`);
            } else {
                console.log(`[COMMENT-NTH-POST] Structural submit lookup: ${located}`);
            }

            if (!submitBtn) {
                // Narrowing the selector list to composer-only identities removed
                // the action-bar false positive but matched nothing at all, so the
                // real control's identity is still unknown. Dump every button in
                // the composer rather than guess at a fourth selector list.
                const candidates = await scope.locator('button').evaluateAll((els: any[]) =>
                    els.slice(0, 12).map((e) => ({
                        cls: (e.className || '').toString().slice(0, 70),
                        aria: e.getAttribute('aria-label') || '',
                        text: (e.textContent || '').trim().slice(0, 24),
                        disabled: e.disabled === true,
                    })),
                ).catch(() => []);
                console.log(`[COMMENT-NTH-POST] No submit button matched. Buttons in composer: ${JSON.stringify(candidates)}`);
                return { success: false, error: 'Comment submit button not found' };
            }

            // Captured with the comment typed and the button about to be
            // clicked — this frame is what shows whether the draft actually
            // made it into the editor.
            await actionShot(page, userId, `comment_before_${lead.id}`);
            // Jiggle only when the control is actually disabled, then use a
            // TRUSTED Playwright click — the working script's own note is that
            // React's form handler accepts that and ignores evaluate()-dispatched
            // clicks.
            const disabledAttr = await submitBtn.getAttribute('disabled').catch(() => null);
            if (disabledAttr !== null) {
                console.log('[COMMENT-NTH-POST] Submit disabled — jiggling the editor to trigger React state.');
                await page.keyboard.press('Space');
                await page.keyboard.press('Backspace');
                await wait(1000);
            }

            await submitBtn.click({ force: true });
            await wait(5000);
            await actionShot(page, userId, `comment_after_${lead.id}`);

            // Verify the comment actually rendered. This is the ONLY evidence the
            // comment posted, so it decides the node's result: an unverified
            // submit is reported as a failure, not a success. Previously both
            // branches set commented=true and returned success, so ActionLog
            // showed four SUCCESS comments that did not exist on LinkedIn.
            // Poll. LinkedIn renders the new comment asynchronously, and a
            // single look right after the click reported "never appeared" for
            // comments that may simply not have painted yet — the same
            // impatience that made the DM check unreliable.
            let commentAppeared = false;
            for (let attempt = 0; attempt < 4 && !commentAppeared; attempt++) {
                // Search the rendered TEXT, not class-named containers. Every
                // selector in the old list was class-based, so on the obfuscated
                // build it could never see a posted comment — a success would be
                // reported as a failure no matter what. The comment body is
                // distinctive enough that its presence in the page text is sound
                // evidence.
                commentAppeared = await page.evaluate((text: string) => {
                    const needle = text.substring(0, 40);
                    const body = (document.body as any)?.innerText || '';
                    // Exclude the editor itself — the draft is still sitting in
                    // it, so a naive page-text match would always succeed.
                    const editor = document.querySelector(
                        'div.tiptap.ProseMirror[contenteditable="true"], div[role="textbox"][aria-label*="Add a comment"]',
                    );
                    const draft = (editor as any)?.innerText || '';
                    const outside = draft ? body.split(draft).join(' ') : body;
                    return outside.includes(needle);
                }, commentText).catch(() => false);
                if (!commentAppeared) await wait(2500);
            }

            if (!commentAppeared) {
                console.log('[COMMENT-NTH-POST] Submit clicked but the comment never appeared — reporting failure.');
                return { success: false, error: 'Comment did not appear after submit' };
            }

            output.commented = true;
            console.log('[COMMENT-NTH-POST] Comment verified in DOM.');
        } else {
            return { success: false, error: 'Comment box not found on post' };
        }

        return { success: true, output };

    } catch (err: any) {
        return { success: false, error: err.message };
    }
};
