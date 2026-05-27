import { NodeHandler, NodeResult, PostOutput } from '../types';
import { resolveVariables } from '../variables';
import { generateAIComment } from '../ai-service';

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
    const { page, lead, storedOutputs, campaign, aiContext } = ctx;
    const n = config.n || 1;
    const rawText = config.text || 'Great insights!';
    const aiEnabled = config.aiEnabled || false;
    const tone = config.tone || campaign?.toneOverride || 'professional';

    const output: PostOutput = { postUrl: null, postContent: null, commented: false, commentText: '' };

    try {
        const cleanUrl = lead.linkedinUrl.split('?')[0].replace(/\/$/, '');
        const activityUrl = cleanUrl + '/recent-activity/shares/';

        console.log(`[COMMENT-NTH-POST] Navigating to posts feed (target: post #${n})...`);

        let postLink: string | null = null;
        let postContent = '';

        for (let attempt = 1; attempt <= 3; attempt++) {
            await safeGoto(page, activityUrl);
            await wait(4000);

            await page.waitForSelector(
                'div[data-urn*="urn:li:activity"], div[data-urn*="urn:li:ugcPost"], div[data-urn*="urn:li:share"], a[href*="/feed/update/urn:li:"]',
                { timeout: 15000 }
            ).catch(() => {});

            for (let i = 0; i < n + 2; i++) {
                await page.mouse.wheel(0, 800);
                await wait(1500);
            }

            // Extract post URN (like testscripts)
            postLink = await page.evaluate((targetNum: number) => {
                const targetIndex = targetNum - 1;
                const postWrappers = Array.from(document.querySelectorAll('div[data-urn*="urn:li:activity"], div[data-urn*="urn:li:ugcPost"], div[data-urn*="urn:li:share"]'));

                if (postWrappers.length > targetIndex) {
                    const urn = postWrappers[targetIndex].getAttribute('data-urn');
                    return `https://www.linkedin.com/feed/update/${urn}/`;
                }

                const links = Array.from(document.querySelectorAll('a[href*="/feed/update/urn:li:"]'));
                const uniqueLinks: string[] = [];
                for (const link of links) {
                    if (!(link as HTMLAnchorElement).href.includes('?commentUrn=')) {
                        const cleanLink = (link as HTMLAnchorElement).href.split('?')[0];
                        if (!uniqueLinks.includes(cleanLink)) uniqueLinks.push(cleanLink);
                    }
                }
                if (uniqueLinks.length > targetIndex) return uniqueLinks[targetIndex];
                return null;
            }, n);

            if (postLink) break;

            if (attempt < 3) {
                console.log(`[COMMENT-NTH-POST] Post not found, retrying (${attempt}/3)...`);
                await wait(randomRange(3000, 5000));
            }
        }

        if (!postLink) {
            return { success: false, error: `Post #${n} not found` };
        }

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

        // Scroll to ensure comment section is rendered
        await page.mouse.wheel(0, 400);
        await wait(2000);

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

            // Click somewhere else to trigger React state update
            await page.mouse.click(10, 10);
            await wait(500);

            // Submit button selectors
            const submitSelectors = [
                'button.comments-comment-box__submit-button',
                'button.artdeco-button--primary',
                'button[aria-label="Comment"]',
                'button:has-text("Comment")',
                'button:has-text("Post")'
            ];

            let submitBtn: any = null;
            for (const sel of submitSelectors) {
                try {
                    const btn = page.locator(sel).first();
                    if (await btn.isVisible({ timeout: 2000 }).catch(() => false)) {
                        submitBtn = btn;
                        console.log(`[COMMENT-NTH-POST] Submit button found: ${sel}`);
                        break;
                    }
                } catch {}
            }

            if (submitBtn) {
                // Check button text
                const btnText = await submitBtn.textContent().catch(() => 'unknown');
                console.log(`[COMMENT-NTH-POST] Button text: ${btnText}`);

                // Click directly
                await submitBtn.click({ force: true });
                await wait(5000);

                // await page.screenshot({ path: '/root/linkedin-camp/step_screenshots/comment_after_submit.png' }).catch(() => {});

                // Verify comment appeared
                const commentAppeared = await page.evaluate((text: string) => {
                    const comments = document.querySelectorAll('.comments-comment-item__main-content');
                    for (const c of comments) {
                        if (c.textContent?.includes(text.substring(0, 30))) return true;
                    }
                    return false;
                }, commentText).catch(() => false);

                if (commentAppeared) {
                    output.commented = true;
                    console.log('[COMMENT-NTH-POST] Comment verified in DOM.');
                } else {
                    output.commented = true;
                    console.log('[COMMENT-NTH-POST] Submit clicked. Could not verify in DOM.');
                }
            } else {
                console.log('[COMMENT-NTH-POST] Submit button not visible after typing.');
                return { success: false, error: 'Comment submit button not found' };
            }
        } else {
            return { success: false, error: 'Comment box not found on post' };
        }

        return { success: true, output };

    } catch (err: any) {
        return { success: false, error: err.message };
    }
};
