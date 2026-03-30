import { NodeHandler, NodeResult, PostOutput } from '../types';

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

export const likeNthPost: NodeHandler = async (ctx, config): Promise<NodeResult> => {
    const { page, lead } = ctx;
    const n = config.n || 1;

    const output: PostOutput = { postUrl: null, postContent: null, liked: false };

    try {
        // Navigate to profile's recent activity
        const cleanUrl = lead.linkedinUrl.split('?')[0].replace(/\/$/, '');
        const activityUrl = cleanUrl + '/recent-activity/shares/';

        console.log(`[LIKE-NTH-POST] Navigating to posts feed (target: post #${n})...`);
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
                console.log(`[LIKE-NTH-POST] Post not found, retrying (${attempt}/3)...`);
                await wait(randomRange(3000, 5000));
            }
        }

        if (!postLink) {
            return { success: false, error: `Post #${n} not found` };
        }

        output.postUrl = postLink;
        console.log(`[LIKE-NTH-POST] Found post #${n}. Navigating...`);

        await safeGoto(page, postLink);
        await wait(5000);

        // Extract post content
        try {
            const moreBtn = page.locator('button[data-testid="expandable-text-button"]').first();
            if (await moreBtn.isVisible({ timeout: 3000 })) {
                await moreBtn.click({ force: true });
                await wait(1000);
            }
            output.postContent = await page.$eval('.update-components-text, [data-testid="expandable-text-box"]', (el: any) => el.innerText).catch(() => null);
        } catch {}

        // Like
        const likeBtn = page.locator('button:has(span:text-is("Like"))').first();
        if (await likeBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
            const isPressed = await likeBtn.getAttribute('aria-pressed');
            if (isPressed !== 'true') {
                await likeBtn.click({ force: true });
                await wait(2000);
                // Verify like took effect
                const nowPressed = await likeBtn.getAttribute('aria-pressed').catch(() => null);
                if (nowPressed === 'true') {
                    output.liked = true;
                    console.log('[LIKE-NTH-POST] Liked (verified).');
                } else {
                    output.liked = true;
                    console.log('[LIKE-NTH-POST] Like clicked (unverified).');
                }
            } else {
                output.liked = true;
                console.log('[LIKE-NTH-POST] Already liked.');
            }
        }

        return { success: true, output };

    } catch (err: any) {
        return { success: false, error: err.message };
    }
};
