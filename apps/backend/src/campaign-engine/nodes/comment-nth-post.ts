import { NodeHandler, NodeResult, PostOutput } from '../types';
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

export const commentNthPost: NodeHandler = async (ctx, config): Promise<NodeResult> => {
    const { page, lead, storedOutputs } = ctx;
    const n = config.n || 1;
    const rawText = config.text || 'Great insights!';

    const output: PostOutput = { postUrl: null, postContent: null, commented: false, commentText: '' };

    try {
        // Resolve {{variables}} in comment text
        const commentText = resolveVariables(rawText, { storedOutputs, lead });
        output.commentText = commentText;

        // Navigate to profile's recent activity
        const cleanUrl = lead.linkedinUrl.split('?')[0].replace(/\/$/, '');
        const activityUrl = cleanUrl + '/recent-activity/shares/';

        console.log(`[COMMENT-NTH-POST] Navigating to posts feed (target: post #${n})...`);

        // Find the Nth post link with retries
        let postLink: string | null = null;

        for (let attempt = 1; attempt <= 3; attempt++) {
            await safeGoto(page, activityUrl);
            await wait(4000);

            // Wait for post elements to appear
            await page.waitForSelector(
                'div[data-urn*="urn:li:activity"], div[data-urn*="urn:li:ugcPost"], div[data-urn*="urn:li:share"], a[href*="/feed/update/urn:li:"]',
                { timeout: 15000 }
            ).catch(() => {});

            // Scroll enough to load the Nth post
            for (let i = 0; i < n + 2; i++) {
                await page.mouse.wheel(0, 800);
                await wait(1500);
            }

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
        await wait(5000);

        // Extract post content
        try {
            const moreBtn = page.locator('button[data-testid="expandable-text-button"]').first();
            if (await moreBtn.isVisible({ timeout: 3000 })) {
                await moreBtn.evaluate((el: any) => el.click());
                await wait(1000);
            }
            output.postContent = await page.$eval('.update-components-text, [data-testid="expandable-text-box"]', (el: any) => el.innerText).catch(() => null);
        } catch {}

        // Comment
        const commentBox = page.locator('div[role="textbox"][aria-label*="Add a comment"], div[data-placeholder="Add a comment\u2026"]').first();

        if (await commentBox.isVisible({ timeout: 5000 }).catch(() => false)) {
            await commentBox.scrollIntoViewIfNeeded();
            await commentBox.click();
            await wait(1000);

            // Human-like typing
            for (const char of commentText) {
                await page.keyboard.type(char, { delay: randomRange(30, 80) });
            }
            await wait(randomRange(1500, 2500));

            // Find submit button
            const submitBtn = page.locator('button.comments-comment-box__submit-button, button.artdeco-button--primary:has-text("Comment"), button.artdeco-button--primary:has-text("Post")').first();

            if (await submitBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
                // Jiggle if disabled (React state trigger)
                const disabled = await submitBtn.getAttribute('disabled');
                if (disabled !== null) {
                    await page.keyboard.press('Space');
                    await page.keyboard.press('Backspace');
                    await wait(1000);
                }

                await submitBtn.click({ force: true });
                output.commented = true;
                console.log('[COMMENT-NTH-POST] Comment submitted.');
                await wait(4000);
            } else {
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
