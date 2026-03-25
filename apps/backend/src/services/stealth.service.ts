import { Page, Locator } from 'playwright';

const wait = (ms: number) => new Promise(res => setTimeout(res, ms));
export const randomRange = (min: number, max: number) => Math.floor(Math.random() * (max - min + 1) + min);

/**
 * Moves the mouse in a human-like (non-linear) way to an element and clicks it.
 */
export const humanMoveAndClick = async (page: Page, target: string | Locator) => {
    try {
        const element = typeof target === 'string' ? page.locator(target).first() : target;
        const box = await element.boundingBox();
        if (!box) return false;

        // Target a random point within the button (avoiding edges)
        const targetX = box.x + box.width * (0.2 + Math.random() * 0.6);
        const targetY = box.y + box.height * (0.2 + Math.random() * 0.6);

        // Hover first (human behavior)
        await page.mouse.move(targetX, targetY, { steps: 15 });
        await wait(randomRange(300, 800));
        await page.mouse.click(targetX, targetY);
        return true;
    } catch (e) {
        console.error('[STEALTH] humanMoveAndClick failed:', e);
        return false;
    }
};

/**
 * Types text with human-like rhythm, including occasional typos and corrections.
 */
export const humanType = async (page: Page, target: string | Locator, text: string) => {
    try {
        const box = typeof target === 'string' ? page.locator(target).first() : target;
        await box.waitFor({ state: 'visible', timeout: 10000 });
        await box.click({ force: true });
        await wait(randomRange(800, 1500));

        for (let i = 0; i < text.length; i++) {
            // Simulate biological inconsistency/typo (1.5% chance)
            if (Math.random() < 0.015 && i > 0) {
                const homeRow = 'asdfghjkl';
                const wrongKey = homeRow[Math.floor(Math.random() * homeRow.length)];
                await page.keyboard.press(wrongKey);
                await wait(randomRange(250, 500));
                await page.keyboard.press('Backspace');
                await wait(randomRange(200, 400));
            }

            await page.keyboard.type(text[i], { delay: randomRange(60, 200) });

            // Brief "thinking" pause after punctuation or words
            if ([' ', '.', ',', '!'].includes(text[i])) {
                await wait(randomRange(300, 800));
            }
        }
        return true;
    } catch (e) {
        console.error('[STEALTH] humanType failed:', e);
        return false;
    }
};

/**
 * Performs a session "warmup" by scrolling the home feed.
 */
export async function warmupSession(page: Page) {
    console.log('[STEALTH] Warming up session with lightweight page...');
    try {
        // Use a lighter page than the feed to avoid heavy image timeouts
        await page.goto('https://www.linkedin.com/jobs/', {
            waitUntil: 'domcontentloaded',
            timeout: 120000
        });

        // Random scrolling
        await page.evaluate(() => {
            window.scrollBy(0, Math.floor(Math.random() * 500) + 200);
        });

        await page.waitForTimeout(Math.floor(Math.random() * 3000) + 2000);
    } catch (error) {
        console.warn('[STEALTH] Warmup encountered a minor delay, proceeding anyway...');
    }
}

/**
 * Premium: Likes the first visible post on the feed.
 */
export const likeRecentPost = async (page: Page) => {
    try {
        console.log('[STEALTH] Searching for a post to like...');
        const likeBtn = page.locator('button[aria-label^="Like"], .react-button__trigger').first();
        if (await likeBtn.isVisible({ timeout: 5000 })) {
            const isAlreadyLiked = await likeBtn.getAttribute('aria-pressed');
            if (isAlreadyLiked === 'true') {
                console.log('[STEALTH] Post already liked. Skipping.');
                return true;
            }
            return await humanMoveAndClick(page, likeBtn);
        }
        return false;
    } catch (e) {
        console.error('[STEALTH] likeRecentPost failed:', e);
        return false;
    }
};

/**
 * Premium: Comments on the first visible post on the feed.
 */
export const commentOnRecentPost = async (page: Page, text: string) => {
    try {
        console.log('[STEALTH] Attempting to comment on a post...');
        const commentTrigger = page.locator('button[aria-label^="Comment"], .comment-button').first();
        if (await commentTrigger.isVisible({ timeout: 5000 })) {
            await humanMoveAndClick(page, commentTrigger);
            await wait(randomRange(1000, 2000));

            const commentBox = page.locator('.ql-editor[contenteditable="true"], .comments-comment-box__textarea').first();
            await humanType(page, commentBox, text);
            await wait(randomRange(1000, 2000));

            await page.keyboard.press('Enter');
            console.log('[STEALTH] Comment posted successfully.');
            return true;
        }
        return false;
    } catch (e) {
        console.error('[STEALTH] commentOnRecentPost failed:', e);
        return false;
    }
};

/**
 * Premium: Attaches a document in the active message box.
 */
export const attachDocument = async (page: Page, filePath: string) => {
    try {
        console.log('[STEALTH] Attempting to attach document:', filePath);
        // LinkedIn uses a hidden file input for attachments
        const fileInput = page.locator('input[type="file"][name="file"]').first();
        await fileInput.setInputFiles(filePath);
        console.log('[STEALTH] File attached. Waiting for upload...');
        await wait(randomRange(3000, 5000));
        return true;
    } catch (e) {
        console.error('[STEALTH] attachDocument failed:', e);
        return false;
    }
};
