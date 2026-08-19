import { NodeHandler, NodeResult, PostOutput } from '../types';
import { persistDiscoveredPost } from '../storage';
import { discoverNthPostUrl } from './post-discovery';

const wait = (ms: number) => new Promise(res => setTimeout(res, ms));

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
        console.log(`[LIKE-NTH-POST] Navigating to posts feed (target: post #${n})...`);

        const discovered = await discoverNthPostUrl(page, lead.linkedinUrl, n, 'LIKE-NTH-POST');
        if (!discovered) {
            return { success: false, error: `Post #${n} not found` };
        }

        const postLink = discovered.url;
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

        // Cache the post on the Lead row — profile-visit skips its own duplicate
        // activity-feed scrape when this node is present, so this keeps the UI's
        // "Recent post" panel populated. Fire-and-forget.
        persistDiscoveredPost(lead.id, output.postUrl, output.postContent).catch(() => {});

        // Like (use evaluate() to bypass sticky headers, matching testscripts)
        const likeBtn = page.locator('button:has(span:text-is("Like"))').first();
        if (await likeBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
            const isPressed = await likeBtn.getAttribute('aria-pressed');
            if (isPressed !== 'true') {
                await likeBtn.evaluate((el: any) => el.click());
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
