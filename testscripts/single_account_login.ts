/**
 * single_account_login.ts
 *
 * Fresh cold-login test for ONE account through the dedicated ISP.
 * Used to disambiguate Phase A's mixed signal: was the snehlata challenge
 * the result of multi-account-on-shared-IP, or just same-account rapid retry?
 *
 * Targets snehlata (email identifier). Logs the outcome + saves screenshot
 * and storage state to /tmp/test-sessions/single_<label>_*.
 *
 *   npx ts-node --transpile-only --compiler-options '{"module":"CommonJS","moduleResolution":"Node","target":"ES2020","esModuleInterop":true}' \
 *     testscripts/single_account_login.ts
 */

import { chromium } from 'playwright-extra';
import * as fs from 'fs';
import * as path from 'path';

const stealth = require('puppeteer-extra-plugin-stealth')();
chromium.use(stealth);

const wait = (ms: number) => new Promise(res => setTimeout(res, ms));

const PROXY = {
    server: 'http://82.41.252.111:46222',
    username: 'xBVyYdUpx84nWx7',
    password: 'dwwTxtvv5a10RXn',
};

const ACCT = {
    label: 'single_sneh_email',
    username: 'snehlatasingh9012@gmail.com',
    password: 'Hehe#35op',
};

const OUT_DIR = '/tmp/test-sessions';
fs.mkdirSync(OUT_DIR, { recursive: true });

async function main() {
    console.log(`\n══════ Single-account fresh login ══════`);
    console.log(`Proxy:   ${PROXY.server}`);
    console.log(`Account: ${ACCT.username}`);
    console.log(`Out:     ${OUT_DIR}`);
    console.log('');

    const browser = await chromium.launch({
        headless: true,
        proxy: PROXY,
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-blink-features=AutomationControlled',
        ],
    });

    const context = await browser.newContext({
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36',
        viewport: { width: 1920, height: 1080 },
        locale: 'en-IN',
        timezoneId: 'Asia/Kolkata',
        proxy: PROXY,
    });

    const page = await context.newPage();

    try {
        console.log('[1] Navigating to /login');
        await page.goto('https://www.linkedin.com/login', { waitUntil: 'domcontentloaded', timeout: 60000 });
        await wait(3000);

        console.log('[2] Filling credentials');
        await page.locator('input[autocomplete="username webauthn"]').fill(ACCT.username);
        await wait(600 + Math.random() * 800);
        await page.locator('input[autocomplete="current-password"]').last().fill(ACCT.password);
        await wait(600 + Math.random() * 800);

        console.log('[3] Submitting');
        await page.getByRole('button', { name: /^Sign in$/i }).click();

        console.log('[4] Waiting for landing (12s)...');
        await wait(12000);

        try { await page.waitForLoadState('networkidle', { timeout: 15000 }); } catch {}

        const finalUrl = page.url();
        console.log(`[5] Final URL: ${finalUrl}`);

        const shot = path.join(OUT_DIR, `${ACCT.label}_landing.png`);
        await page.screenshot({ path: shot, fullPage: false });
        console.log(`[6] Screenshot: ${shot}`);

        const statePath = path.join(OUT_DIR, `${ACCT.label}_state.json`);
        await context.storageState({ path: statePath });
        console.log(`[7] State saved: ${statePath}`);

        // Classification
        let verdict: string;
        if (finalUrl.includes('/feed')) verdict = '✅ FEED — clean login';
        else if (finalUrl.includes('/checkpoint/challenge')) verdict = '❌ CHALLENGE — email-OTP / captcha gate';
        else if (finalUrl.includes('/checkpoint/')) verdict = '⚠  CHECKPOINT — other security checkpoint';
        else if (finalUrl.includes('/login')) verdict = '⚠  STILL ON LOGIN — credential rejected or generic error';
        else verdict = `? UNKNOWN — ${finalUrl}`;

        console.log(`\n══════ VERDICT ══════`);
        console.log(`  ${verdict}`);
        console.log(`  ${finalUrl}`);
        console.log('');
    } catch (err: any) {
        console.error('FATAL:', err.message);
        await page.screenshot({ path: path.join(OUT_DIR, `${ACCT.label}_error.png`) }).catch(() => {});
    } finally {
        await context.close().catch(() => {});
        await browser.close().catch(() => {});
    }
}

main().catch(err => { console.error('FATAL:', err); process.exit(1); });
