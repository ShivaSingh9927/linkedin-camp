/**
 * us-signup-browser.ts
 *
 * Opens a VISIBLE (headed) browser routed through the Proxy-Cheap US residential
 * ISP proxy, for MANUAL LinkedIn signup. This script does not touch LinkedIn's
 * forms, does not fill credentials, and does not submit anything — it only
 * launches the browser and navigates to the signup page. You drive the rest.
 *
 * Uses `patchright` (the stealth-patched Chromium already used elsewhere in
 * this repo, e.g. session-launch.ts) instead of vanilla playwright, since it
 * strips the usual automation tells (navigator.webdriver, etc.) that make a
 * plain Playwright/Puppeteer browser look more suspicious than a real one —
 * not less.
 *
 * Run LOCALLY (needs a real display — this will not work over a headless SSH
 * session unless you have a VNC/X forwarding setup). Credentials come from the
 * environment so they stay out of git:
 *
 *   cd apps/backend
 *   SIGNUP_PROXY_SERVER=http://48.45.238.122:41510 \
 *   SIGNUP_PROXY_USER=... SIGNUP_PROXY_PASS=... \
 *   npx ts-node --transpile-only src/scripts/us-signup-browser.ts
 *
 * The browser window stays open until you press Ctrl+C in the terminal.
 */

import { chromium } from 'patchright';

const PROXY = {
    server: process.env.SIGNUP_PROXY_SERVER || '',
    username: process.env.SIGNUP_PROXY_USER || undefined,
    password: process.env.SIGNUP_PROXY_PASS || undefined,
};

if (!PROXY.server) {
    console.error('❌ Set SIGNUP_PROXY_SERVER (and SIGNUP_PROXY_USER / SIGNUP_PROXY_PASS).');
    console.error('   Refusing to launch unproxied — an unproxied signup defeats the point.');
    process.exit(1);
}

async function main() {
    console.log('[US-SIGNUP] Launching headed Chromium via US residential proxy...');
    console.log(`[US-SIGNUP] Proxy: ${PROXY.server}`);

    const browser = await chromium.launch({
        headless: false,
        args: [
            '--disable-blink-features=AutomationControlled',
            '--start-maximized',
        ],
    });

    const context = await browser.newContext({
        viewport: null, // let the window fill the maximized frame instead of a fixed viewport
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36',
        locale: 'en-US',
        timezoneId: 'America/New_York',
        proxy: PROXY,
    });

    const page = await context.newPage();

    // Surface what the page itself logs (client-side JS errors, LinkedIn's own console warnings).
    page.on('console', (msg) => {
        if (msg.type() === 'error' || msg.type() === 'warning') {
            console.log(`[PAGE-${msg.type().toUpperCase()}] ${msg.text()}`);
        }
    });
    page.on('pageerror', (err) => {
        console.log('[PAGE-EXCEPTION]', err.message);
    });

    // Surface every request/response to LinkedIn's own API so we can see the real
    // status code and body behind a generic "Sorry, something went wrong" toast.
    page.on('requestfailed', (req) => {
        if (req.url().includes('linkedin.com')) {
            console.log(`[NET-FAILED] ${req.method()} ${req.url()} — ${req.failure()?.errorText}`);
        }
    });
    page.on('response', async (res) => {
        const url = res.url();
        const isLinkedInApi = url.includes('linkedin.com') && (url.includes('/signup') || url.includes('/voyager') || url.includes('/checkpoint') || url.includes('/uas/'));
        if (!isLinkedInApi) return;
        const status = res.status();
        if (status >= 400 || url.includes('/signup')) {
            let bodyPreview = '';
            try {
                const text = await res.text();
                bodyPreview = text.slice(0, 500);
            } catch {
                bodyPreview = '<unreadable body>';
            }
            console.log(`[NET] ${status} ${res.request().method()} ${url}\n  -> ${bodyPreview}`);
        }
    });

    console.log('[US-SIGNUP] Verifying proxy egress IP via ipinfo.io...');
    try {
        await page.goto('https://ipinfo.io/json', { waitUntil: 'load', timeout: 30000 });
        const body = await page.evaluate(() => document.body.innerText);
        console.log('[US-SIGNUP] Egress IP info:', body);
    } catch (e: any) {
        console.warn('[US-SIGNUP] Could not verify egress IP:', e.message);
    }

    console.log('[US-SIGNUP] Navigating to LinkedIn signup...');
    await page.goto('https://www.linkedin.com/signup', { waitUntil: 'load', timeout: 60000 }).catch((e) => {
        console.warn('[US-SIGNUP] Navigation warning:', e.message);
    });

    console.log('[US-SIGNUP] Browser is ready. Complete signup manually in the window.');
    console.log('[US-SIGNUP] Press Ctrl+C here when you are done to close the browser.');

    // Keep the process (and browser) alive until the user kills it.
    await new Promise(() => {});
}

main().catch((e) => {
    console.error('[US-SIGNUP] Fatal:', e.message);
    process.exit(1);
});
