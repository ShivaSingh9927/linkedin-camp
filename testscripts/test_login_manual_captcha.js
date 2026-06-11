/**
 * test_login_manual_captcha.js
 *
 * Opens Chrome (visible on your display), logs in, and if a CAPTCHA appears,
 * KEEPS THE BROWSER OPEN so you can solve it manually in the Chrome window.
 * Detects when you reach /feed and saves the session.
 */

const { chromium } = require('patchright');
const path = require('path');
const fs = require('fs');

const EMAIL = 'snehlatasingh9012@gmail.com';
const PASSWORD = 'Hehe#35op';
const SCREENSHOT_DIR = path.join(__dirname, 'screenshots');

// Test mode: set PROXY to enable proxy testing, null for direct
const USE_PROXY = process.env.USE_PROXY === '1';
const PROXY = USE_PROXY ? {
    server: 'http://82.41.252.111:46222',
    username: 'xBVyYdUpx84nWx7',
    password: 'dwwTxtvv5a10RXn',
} : null;

const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const rand = (min, max) => Math.floor(Math.random() * (max - min + 1) + min);

async function humanMouseMove(page) {
    const w = page.viewportSize()?.width || 1280;
    const h = page.viewportSize()?.height || 800;
    for (let i = 0; i < rand(5, 12); i++) {
        await page.mouse.move(rand(100, w - 100), rand(100, h - 100), { steps: 1 });
        await wait(rand(30, 80));
    }
}

async function humanScroll(page) {
    for (let i = 0; i < rand(2, 3); i++) {
        await page.mouse.wheel(0, rand(100, 400));
        await wait(rand(800, 1500));
    }
}

async function humanType(page, text) {
    for (let i = 0; i < text.length; i++) {
        if (Math.random() < 0.015 && i > 0) {
            const wrongKey = 'asdfghjkl'[Math.floor(Math.random() * 9)];
            await page.keyboard.press(wrongKey);
            await wait(rand(200, 400));
            await page.keyboard.press('Backspace');
            await wait(rand(150, 300));
        }
        await page.keyboard.type(text[i], { delay: rand(60, 200) });
        if ([' ', '.', ',', '!', '@'].includes(text[i])) await wait(rand(200, 500));
    }
}

async function testLogin() {
    fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });

    console.log('========================================');
    console.log('  LinkedIn Login — Manual CAPTCHA Mode');
    console.log('========================================');
    console.log('');
    console.log(`  Mode: ${USE_PROXY ? 'WITH PROXY (82.41.252.111:46222)' : 'DIRECT (no proxy)'}`);
    console.log('  Chrome will open on your display.');
    console.log('  If a CAPTCHA appears, SOLVE IT IN THE CHROME WINDOW.');
    console.log('  The script will auto-detect when you reach /feed.');
    console.log('');

    const launchOpts = {
        headless: false,
        channel: 'chrome',
        args: [
            '--disable-blink-features=AutomationControlled',
            '--no-first-run',
            '--no-default-browser-check',
            '--start-maximized',
            '--no-first-run',
        ],
    };
    if (PROXY) launchOpts.proxy = PROXY;

    const browser = await chromium.launch(launchOpts);

    const context = await browser.newContext({
        viewport: null, // Let Chrome use full screen
        locale: 'en-US',
        timezoneId: 'America/New_York',
    });

    const page = await context.newPage();

    try {
        // Navigate to login
        console.log('[STEP 1] Navigating to linkedin.com/login...');
        await page.goto('https://www.linkedin.com/login', { waitUntil: 'domcontentloaded', timeout: 30000 });
        await wait(rand(2000, 4000));
        console.log(`[STEP 1] URL: ${page.url()}`);

        // Warmup
        await humanMouseMove(page);
        await humanScroll(page);
        await wait(rand(1000, 2000));

        // Fill email
        console.log('[STEP 2] Typing email...');
        let emailInput = null;
        for (const c of await page.$$('input[type="email"]')) {
            if (await c.isVisible().catch(() => false)) { emailInput = c; break; }
        }
        if (emailInput) {
            await emailInput.click();
            await wait(rand(300, 600));
            await humanType(page, EMAIL);
            await wait(rand(800, 1200));
        }

        // Fill password
        console.log('[STEP 3] Typing password...');
        let passInput = null;
        for (const c of await page.$$('input[type="password"]')) {
            if (await c.isVisible().catch(() => false)) { passInput = c; break; }
        }
        if (passInput) {
            await passInput.click();
            await wait(rand(300, 600));
            await humanType(page, PASSWORD);
            await wait(rand(500, 1000));
        }

        // Click Sign in
        console.log('[STEP 4] Clicking Sign in...');
        await humanMouseMove(page);
        await page.getByRole('button', { name: 'Sign in', exact: true }).click();
        await wait(rand(6000, 10000));
        try { await page.waitForLoadState('networkidle', { timeout: 15000 }); } catch {}
        console.log(`[STEP 4] URL after submit: ${page.url()}`);
        await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'manual_01_after_submit.png') });

        // Check result
        if (page.url().includes('/feed')) {
            console.log('\n✅ SUCCESS — Already on /feed!');
        } else if (page.url().includes('/checkpoint')) {
        console.log('');
        console.log('========================================');
        console.log('  ⚠️  CAPTCHA DETECTED');
        console.log('  👉  LOOK AT YOUR SCREEN NOW!');
        console.log('  👉  Chrome is maximized — solve the CAPTCHA');
        console.log('  ⏳  Waiting up to 5 minutes...');
        console.log('========================================');
        console.log('');

        // Bring Chrome window to front
        try {
            const { execSync } = require('child_process');
            execSync('xdotool search --name "LinkedIn" windowactivate --sync 2>/dev/null || true');
        } catch {}

        // Give user 10 seconds to notice the window
        console.log('  📢 Chrome window is on your screen! You have 10 seconds before polling starts...');
        await wait(10000);

        await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'manual_02_checkpoint.png') });

            // Poll for /feed every 3 seconds for up to 5 minutes
            const startTime = Date.now();
            const TIMEOUT = 5 * 60 * 1000;
            let solved = false;

            while (Date.now() - startTime < TIMEOUT) {
                const url = page.url();
                if (url.includes('/feed') || url.includes('/in/')) {
                    solved = true;
                    break;
                }

                // Also check if navigated away from checkpoint
                if (!url.includes('/checkpoint') && !url.includes('/login')) {
                    solved = true;
                    break;
                }

                const elapsed = Math.round((Date.now() - startTime) / 1000);
                process.stdout.write(`\r  ⏳ Waiting... ${elapsed}s / 300s`);
                await wait(3000);
            }

            console.log('');

            if (solved) {
                console.log(`\n✅ CAPTCHA SOLVED! URL: ${page.url()}`);
                await wait(3000); // Let page settle
            } else {
                console.log('\n❌ Timed out waiting for CAPTCHA solution');
            }
        } else {
            console.log(`\n❓ Unknown state: ${page.url()}`);
        }

        // Save session if on /feed
        const finalUrl = page.url();
        if (finalUrl.includes('/feed') || finalUrl.includes('/in/')) {
            await wait(3000);
            const cookies = await context.cookies();
            const livedUa = await page.evaluate(() => navigator.userAgent);
            const lsObj = await page.evaluate(() => {
                const out = {};
                for (let i = 0; i < window.localStorage.length; i++) {
                    const k = window.localStorage.key(i);
                    if (k) out[k] = window.localStorage.getItem(k) || '';
                }
                return out;
            });

            const outDir = path.join(SCREENSHOT_DIR, 'session');
            fs.mkdirSync(outDir, { recursive: true });
            fs.writeFileSync(path.join(outDir, 'cookies.json'), JSON.stringify(cookies, null, 2));
            fs.writeFileSync(path.join(outDir, 'fingerprint.json'), JSON.stringify({ userAgent: livedUa }, null, 2));
            fs.writeFileSync(path.join(outDir, 'localStorage.json'), JSON.stringify(lsObj, null, 2));

            console.log(`\n✅ Session saved to ${outDir}`);
            console.log(`   ${cookies.length} cookies`);
            console.log(`   UA: ${livedUa}`);
        }

    } catch (error) {
        console.error(`\n[ERROR] ${error.message}`);
        await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'manual_error.png') }).catch(() => {});
    } finally {
        await wait(2000);
        await context.close();
        console.log('[DONE] Browser closed');
    }
}

testLogin();
