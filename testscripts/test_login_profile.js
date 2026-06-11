/**
 * test_login_profile.js
 *
 * Launches Chrome with the user's REAL profile directory.
 * This inherits existing cookies/session from the real browser.
 * Two Chrome instances can't share the same profile, so we COPY it first.
 *
 * Usage: node testscripts/test_login_profile.js
 */

const { chromium } = require('patchright');
const path = require('path');
const fs = require('fs');
const { execSync } = require('child_process');

const EMAIL = 'snehlatasingh9012@gmail.com';
const PASSWORD = 'Hehe#35op';
const SCREENSHOT_DIR = path.join(__dirname, 'screenshots');

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

    // Step 1: Copy real Chrome profile to avoid lock conflicts
    const realProfile = path.join(process.env.HOME, '.config/google-chrome');
    const copyProfile = path.join(__dirname, '.chrome-profile-copy');

    console.log('[SETUP] Copying Chrome profile (this may take a moment)...');
    if (fs.existsSync(copyProfile)) {
        fs.rmSync(copyProfile, { recursive: true, force: true });
    }

    // Only copy the Default profile (not ALL profiles)
    const defaultProfile = path.join(realProfile, 'Default');
    if (!fs.existsSync(defaultProfile)) {
        console.error('[SETUP] Default Chrome profile not found at:', defaultProfile);
        process.exit(1);
    }

    // Use rsync for efficient copy (skip heavy缓存/cache dirs)
    try {
        execSync(`rsync -a --exclude='Cache' --exclude='Code Cache' --exclude='Service Worker' --exclude='GPUCache' "${defaultProfile}/" "${copyProfile}/"`, {
            timeout: 30000,
        });
        console.log('[SETUP] Profile copied successfully');
    } catch (e) {
        console.error('[SETUP] rsync failed, trying cp -r:', e.message);
        execSync(`cp -r "${defaultProfile}" "${copyProfile}"`, { timeout: 30000 });
    }

    console.log('[TEST] Starting LinkedIn login test with REAL Chrome profile');
    console.log(`[TEST] Profile: ${copyProfile}`);

    const context = await chromium.launchPersistentContext(copyProfile, {
        headless: false,
        channel: 'chrome',
        args: [
            '--disable-blink-features=AutomationControlled',
            '--no-first-run',
            '--no-default-browser-check',
        ],
        viewport: { width: 1280, height: 800 },
        locale: 'en-US',
        timezoneId: 'America/New_York',
    });

    const page = await context.newPage();

    try {
        // Navigate to LinkedIn
        console.log('[STEP 1] Navigating to linkedin.com...');
        await page.goto('https://www.linkedin.com/feed/', { waitUntil: 'domcontentloaded', timeout: 30000 });
        await wait(rand(2000, 4000));
        console.log(`[STEP 1] URL: ${page.url()}`);
        await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'profile_01_initial.png') });

        const currentUrl = page.url();

        if (currentUrl.includes('/feed') || currentUrl.includes('/in/')) {
            console.log('\n✅ SUCCESS: Already logged in via real profile cookies!');
            console.log(`URL: ${currentUrl}`);

            // Save session data
            const cookies = await context.cookies();
            const lsObj = await page.evaluate(() => {
                const out = {};
                for (let i = 0; i < window.localStorage.length; i++) {
                    const k = window.localStorage.key(i);
                    if (k) out[k] = window.localStorage.getItem(k) || '';
                }
                return out;
            });
            fs.writeFileSync(path.join(SCREENSHOT_DIR, 'profile_cookies.json'), JSON.stringify(cookies, null, 2));
            fs.writeFileSync(path.join(SCREENSHOT_DIR, 'profile_localStorage.json'), JSON.stringify(lsObj, null, 2));
            console.log(`✅ ${cookies.length} cookies saved`);
        } else if (currentUrl.includes('/login')) {
            console.log('[STEP 1] Not logged in — need to fill credentials');

            await humanMouseMove(page);
            await humanScroll(page);
            await wait(rand(1000, 2000));

            // Fill email
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
            await humanMouseMove(page);
            await page.getByRole('button', { name: 'Sign in', exact: true }).click();
            await wait(rand(8000, 12000));
            try { await page.waitForLoadState('networkidle', { timeout: 15000 }); } catch {}
            console.log(`[STEP 2] URL after submit: ${page.url()}`);
            await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'profile_02_after_submit.png') });

            if (page.url().includes('/feed')) {
                console.log('\n✅ SUCCESS: Logged in via credentials with real profile!');
            } else if (page.url().includes('/checkpoint')) {
                console.log('\n⚠️ CHECKPOINT still detected');
            } else {
                console.log(`\n❓ Unknown state: ${page.url()}`);
            }
        } else if (currentUrl.includes('/checkpoint')) {
            console.log('\n⚠️ CHECKPOINT on initial load — challenge still pending');
        } else {
            console.log(`\n❓ Unknown URL: ${currentUrl}`);
        }

    } catch (error) {
        console.error(`[ERROR] ${error.message}`);
        await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'profile_error.png') }).catch(() => {});
    } finally {
        await wait(2000);
        await context.close();
        // Cleanup copied profile
        try { fs.rmSync(copyProfile, { recursive: true, force: true }); } catch {}
        console.log('[DONE] Browser closed, profile cleaned up');
    }
}

testLogin();
