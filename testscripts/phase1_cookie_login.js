/**
 * phase1_cookie_login.js
 *
 * Manual LinkedIn login (you log in by hand — handles any OTP/captcha naturally),
 * then auto-captures cookies + UA + localStorage into testscripts/sessions/<label>/
 * for replay by phase2_cookie_reuse.js.
 *
 * Launches through the dedicated ISP at LAUNCH level (sticky-proxy invariant).
 *
 *   ACCOUNT_LABEL=raja      node testscripts/phase1_cookie_login.js
 *   ACCOUNT_LABEL=snehlata  node testscripts/phase1_cookie_login.js
 */

const { chromium } = require('playwright-extra');
const stealth = require('puppeteer-extra-plugin-stealth')();
const path = require('path');
const fs = require('fs');

chromium.use(stealth);

const PROXY = {
    server: 'http://82.41.252.111:46222',
    username: 'xBVyYdUpx84nWx7',
    password: 'dwwTxtvv5a10RXn',
};

async function phase1CookieCapture() {
    const label = process.env.ACCOUNT_LABEL;
    if (!label) {
        console.error('❌ Set ACCOUNT_LABEL env var (e.g. raja, snehlata)');
        process.exit(1);
    }

    const outDir = path.join(__dirname, 'sessions', label);
    fs.mkdirSync(outDir, { recursive: true });

    console.log(`[PHASE 1] Capturing session for: ${label}`);
    console.log(`[PHASE 1] Output dir: ${outDir}`);
    console.log(`[PHASE 1] Proxy (launch + context): ${PROXY.server}`);

    const browser = await chromium.launch({
        headless: false,
        proxy: PROXY,
        args: [
            '--disable-blink-features=AutomationControlled',
            '--start-maximized'
        ]
    });

    const context = await browser.newContext({
        viewport: null,
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36',
        locale: 'en-IN',
        timezoneId: 'Asia/Kolkata',
        proxy: PROXY,
    });

    const page = await context.newPage();

    try {
        await page.goto('https://www.linkedin.com/login', { waitUntil: 'domcontentloaded' });

        console.log('\n--- ACTION REQUIRED ---');
        console.log(`Account: ${label}`);
        console.log('1. Login to LinkedIn manually.');
        console.log('2. Solve any security checks (OTP, CAPTCHA).');
        console.log('3. Once you reach /feed/, the script auto-saves and closes.');
        console.log('------------------------\n');

        await page.waitForURL('**/feed/**', { timeout: 600000 });
        console.log('✅ Login detected on Feed!');

        await page.waitForTimeout(5000);

        const cookies = await context.cookies();
        fs.writeFileSync(path.join(outDir, 'cookies.json'), JSON.stringify(cookies, null, 2));
        console.log(`✅ ${cookies.length} cookies → ${path.join(outDir, 'cookies.json')}`);

        const userAgent = await page.evaluate(() => navigator.userAgent);
        fs.writeFileSync(path.join(outDir, 'fingerprint.json'), JSON.stringify({ userAgent }, null, 2));
        console.log(`✅ Fingerprint → ${path.join(outDir, 'fingerprint.json')}`);

        const localStorageData = await page.evaluate(() => JSON.stringify(window.localStorage));
        fs.writeFileSync(path.join(outDir, 'localStorage.json'), localStorageData);
        console.log(`✅ localStorage → ${path.join(outDir, 'localStorage.json')}`);

        console.log(`\n[SUCCESS] Session captured for ${label}. Run phase2_cookie_reuse.js to verify.`);
        await page.waitForTimeout(2000);

    } catch (error) {
        console.error('❌ Error during capture:', error.message);
    } finally {
        await browser.close();
    }
}

phase1CookieCapture();
