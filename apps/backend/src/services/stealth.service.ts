import { Page, Locator } from 'playwright';

const wait = (ms: number) => new Promise(res => setTimeout(res, ms));
const randomRange = (min: number, max: number) => Math.floor(Math.random() * (max - min + 1) + min);

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
export const warmupSession = async (page: Page) => {
    try {
        console.log('[STEALTH] Warming up session by scrolling feed...');
        await page.goto('https://www.linkedin.com/feed/', { waitUntil: 'domcontentloaded' });
        await wait(randomRange(2000, 4000));

        for (let i = 0; i < randomRange(2, 4); i++) {
            await page.mouse.wheel(0, randomRange(400, 900));
            await wait(randomRange(2500, 6000)); // Simulate "reading" the post
        }
        return true;
    } catch (e) {
        console.error('[STEALTH] warmupSession failed:', e);
        return false;
    }
};
