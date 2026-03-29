/**
 * server-login.ts
 *
 * Opens a browser INSIDE the container for manual LinkedIn login.
 * After login, saves cookies + fingerprint to the DB so the engine can use them.
 *
 * Usage:
 *   docker exec -e TEST_USER_ID=b5b984e6-c42c-4669-8578-b281dd028f28 \
 *     linkedin-camp-backend-1 npx ts-node --transpile-only apps/backend/src/scripts/server-login.ts
 *
 * IMPORTANT: This needs a display. Use VNC or a headful browser tunnel.
 * For now it runs headless — you'll need to pass cookies manually or use the extension.
 */

import { chromium } from 'playwright-extra';
import { prisma } from '@repo/db';

const stealth = require('puppeteer-extra-plugin-stealth')();
chromium.use(stealth);

const wait = (ms: number) => new Promise(res => setTimeout(res, ms));

async function main() {
    const userId = process.env.TEST_USER_ID;
    if (!userId) {
        console.error('❌ Set TEST_USER_ID env var');
        process.exit(1);
    }

    console.log(`[LOGIN] Starting server-side login for user: ${userId}`);
    console.log(`[LOGIN] This will open a headless browser with Oxylabs proxy.`);

    const browser = await chromium.launch({
        headless: true,
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-blink-features=AutomationControlled',
            '--start-maximized',
        ],
    });

    const context = await browser.newContext({
        userAgent: 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36',
        viewport: { width: 2560, height: 1440 },
        locale: 'en-IN',
        timezoneId: 'Asia/Kolkata',
        proxy: {
            server: 'http://disp.oxylabs.io:8001',
            username: 'user-shivasingh_clgdY',
            password: 'Iamironman_3',
        },
    });

    const page = await context.newPage();

    try {
        console.log('[LOGIN] Navigating to LinkedIn login...');
        await page.goto('https://www.linkedin.com/login', {
            waitUntil: 'networkidle',
            timeout: 60000,
        });

        console.log('[LOGIN] Page loaded. URL:', page.url());

        // Fill in credentials if provided via env
        const email = process.env.LINKEDIN_EMAIL;
        const password = process.env.LINKEDIN_PASSWORD;

        if (email && password) {
            console.log('[LOGIN] Filling credentials from env...');
            await page.fill('#username', email);
            await wait(500);
            await page.fill('#password', password);
            await wait(500);
            await page.click('button[type="submit"]');
            console.log('[LOGIN] Submitted. Waiting for feed or security check...');
        } else {
            console.log('[LOGIN] No LINKEDIN_EMAIL/LINKEDIN_PASSWORD set.');
            console.log('[LOGIN] Browser is open but headless — cannot manually login.');
            console.log('[LOGIN] Set credentials as env vars to auto-login.');
        }

        // Wait for feed (up to 10 minutes for manual security checks)
        try {
            await page.waitForURL('**/feed/**', { timeout: 600000 });
            console.log('[LOGIN] Feed detected! Capturing session...');

            await wait(5000);

            // Capture cookies
            const cookies = await context.cookies();
            const sanitizedCookies = cookies.map(c => ({
                name: c.name,
                value: c.value,
                domain: c.domain,
                path: c.path,
                secure: c.secure,
                httpOnly: c.httpOnly,
                sameSite: c.sameSite === 'none' ? 'None' : (c.sameSite === 'lax' ? 'Lax' : c.sameSite),
                expires: c.expires || Math.round(Date.now() / 1000) + 86400 * 30,
            }));

            // Capture fingerprint
            const fingerprint = await page.evaluate(() => ({
                userAgent: navigator.userAgent,
                platform: navigator.platform,
                language: navigator.language,
                screen: {
                    width: window.screen.width,
                    height: window.screen.height,
                    availWidth: window.screen.availWidth,
                    availHeight: window.screen.availHeight,
                },
            }));

            // Capture localStorage
            const localStorageData = await page.evaluate(() => {
                const data: Record<string, string> = {};
                for (let i = 0; i < window.localStorage.length; i++) {
                    const key = window.localStorage.key(i);
                    if (key) data[key] = window.localStorage.getItem(key) || '';
                }
                return data;
            });

            // Save to DB
            await prisma.user.update({
                where: { id: userId },
                data: {
                    linkedinCookie: JSON.stringify(sanitizedCookies),
                    linkedinLocalStorage: JSON.stringify(localStorageData),
                    linkedinFingerprint: fingerprint as any,
                },
            });

            console.log(`[LOGIN] Session saved to DB!`);
            console.log(`  Cookies: ${sanitizedCookies.length}`);
            console.log(`  localStorage keys: ${Object.keys(localStorageData).length}`);
            console.log(`  UA: ${fingerprint.userAgent.substring(0, 60)}...`);
            console.log('\n[LOGIN] ✅ Ready to run test-campaign.ts');

        } catch (e: any) {
            console.log('[LOGIN] Timeout waiting for feed:', e.message);
            console.log('[LOGIN] Current URL:', page.url());
        }

    } catch (err: any) {
        console.error('[LOGIN] Error:', err.message);
    }

    await browser.close();
    process.exit(0);
}

main().catch(e => {
    console.error('[LOGIN] Fatal:', e.message);
    process.exit(1);
});
