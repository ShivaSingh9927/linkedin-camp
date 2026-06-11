/**
 * Tiny diagnostic — load LinkedIn /login through the dedicated ISP and dump
 * every input element + iframe found, so we can pick the right selectors.
 */
import { chromium } from 'playwright-extra';
const stealth = require('puppeteer-extra-plugin-stealth')();
chromium.use(stealth);

const PROXY = { server: 'http://82.41.252.111:46222', username: 'xBVyYdUpx84nWx7', password: 'dwwTxtvv5a10RXn' };

(async () => {
    const browser = await chromium.launch({ headless: true, proxy: PROXY, args: ['--no-sandbox'] });
    const ctx = await browser.newContext({ proxy: PROXY, locale: 'en-IN', timezoneId: 'Asia/Kolkata', viewport: { width: 1920, height: 1080 } });
    const page = await ctx.newPage();
    try {
        await page.goto('https://www.linkedin.com/login', { waitUntil: 'domcontentloaded', timeout: 60000 });
        await page.waitForTimeout(8000);
        const url = page.url();
        const title = await page.title();
        console.log(`URL: ${url}`);
        console.log(`TITLE: ${title}`);
        const inputs = await page.$$eval('input', els =>
            els.map(e => ({
                id: e.id, name: (e as any).name, type: (e as any).type,
                placeholder: (e as any).placeholder, autocomplete: (e as any).autocomplete,
                ariaLabel: e.getAttribute('aria-label'),
                visible: (e as any).offsetParent !== null,
            }))
        );
        console.log('INPUTS:');
        for (const i of inputs) console.log('  ', JSON.stringify(i));
        const iframes = await page.$$eval('iframe', els => els.map(e => ({ src: (e as any).src, id: e.id })));
        console.log('IFRAMES:');
        for (const f of iframes) console.log('  ', JSON.stringify(f));
        await page.screenshot({ path: '/tmp/test-sessions/probe.png' });
        console.log('Screenshot: /tmp/test-sessions/probe.png');
    } catch (e: any) {
        console.error('ERR:', e.message);
    } finally {
        await browser.close();
    }
})();
