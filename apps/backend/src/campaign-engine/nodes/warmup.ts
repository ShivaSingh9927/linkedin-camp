import { NodeHandler, NodeResult } from '../types';

const wait = (ms: number) => new Promise(res => setTimeout(res, ms));
const randomRange = (min: number, max: number) => Math.floor(Math.random() * (max - min + 1) + min);

export const warmup: NodeHandler = async (ctx): Promise<NodeResult> => {
    const { page } = ctx;

    try {
        console.log('[WARMUP] Visiting LinkedIn feed...');
        console.log('[WARMUP] Current URL before goto:', page.url());

        await page.goto('https://www.linkedin.com/feed/', {
            waitUntil: 'domcontentloaded',
            timeout: 60000
        });

        console.log('[WARMUP] URL after goto:', page.url());
        await wait(randomRange(5000, 8000));
        console.log('[WARMUP] URL after wait:', page.url());

        // Session validation
        const url = page.url();
        if (url.includes('authwall') || url.includes('login') || url.includes('checkpoint')) {
            return {
                success: false,
                error: `Session invalid. Redirected to: ${url}`
            };
        }

        // Light scroll to look human
        await page.mouse.wheel(0, randomRange(200, 500));
        await wait(randomRange(2000, 4000));

        console.log('[WARMUP] Session valid.');
        return { success: true, output: { warmed: true } };

    } catch (err: any) {
        return { success: false, error: err.message };
    }
};
