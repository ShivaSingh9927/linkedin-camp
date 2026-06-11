/**
 * test_login_local.js
 *
 * Tests LinkedIn login with patchright + real Chrome + human-like behavior.
 * No proxy — tests if human interaction alone bypasses li.protechts.net detection.
 *
 * Usage: node testscripts/test_login_local.js
 */

const { chromium } = require('patchright');
const path = require('path');
const fs = require('fs');

const EMAIL = 'snehlatasingh9012@gmail.com';
const PASSWORD = 'Hehe#35op';
const SCREENSHOT_DIR = path.join(__dirname, 'screenshots');

// ─── Human behavior helpers ──────────────────────────────────────────

const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const rand = (min, max) => Math.floor(Math.random() * (max - min + 1) + min);

async function humanScroll(page) {
    const scrolls = rand(2, 4);
    for (let i = 0; i < scrolls; i++) {
        const y = rand(100, 400);
        await page.mouse.wheel(0, y);
        await wait(rand(800, 2000));
    }
}

async function humanMouseMove(page) {
    const w = page.viewportSize()?.width || 1280;
    const h = page.viewportSize()?.height || 800;
    const steps = rand(8, 20);
    for (let i = 0; i < steps; i++) {
        const x = rand(100, w - 100);
        const y = rand(100, h - 100);
        await page.mouse.move(x, y, { steps: 1 });
        await wait(rand(30, 80));
    }
}

async function humanType(page, text) {
    for (let i = 0; i < text.length; i++) {
        // 1.5% typo chance on home row keys
        if (Math.random() < 0.015 && i > 0) {
            const homeRow = 'asdfghjkl';
            const wrongKey = homeRow[Math.floor(Math.random() * homeRow.length)];
            await page.keyboard.press(wrongKey);
            await wait(rand(200, 450));
            await page.keyboard.press('Backspace');
            await wait(rand(150, 350));
        }

        await page.keyboard.type(text[i], { delay: rand(60, 200) });

        // Thinking pause after spaces and punctuation
        if ([' ', '.', ',', '!', '@'].includes(text[i])) {
            await wait(rand(200, 600));
        }
    }
}

async function humanClick(page, locator) {
    const box = await locator.boundingBox();
    if (!box) {
        await locator.click();
        return;
    }
    // Move to random point within element
    const x = box.x + box.width * (0.2 + Math.random() * 0.6);
    const y = box.y + box.height * (0.2 + Math.random() * 0.6);
    await page.mouse.move(x, y, { steps: rand(10, 20) });
    await wait(rand(200, 600));
    await page.mouse.click(x, y);
}

// ─── Main test ───────────────────────────────────────────────────────

async function testLogin() {
    fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });

    console.log('[TEST] Starting LinkedIn login test (human behavior, no proxy)');
    console.log(`[TEST] Email: ${EMAIL}`);

    const browser = await chromium.launch({
        headless: false,
        channel: 'chrome',
        pipe: true, // Use OS pipes instead of TCP debug port — avoids localhost port scanning
        args: [
            '--disable-blink-features=AutomationControlled',
            '--no-first-run',
            '--no-default-browser-check',
        ],
    });

    const context = await browser.newContext({
        userAgent: 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36',
        locale: 'en-US',
        timezoneId: 'America/New_York',
        viewport: { width: 1280, height: 800 },
    });

    const page = await context.newPage();

    try {
        // ── Step 1: Navigate to login page ──
        console.log('[STEP 1] Navigating to linkedin.com/login...');
        await page.goto('https://www.linkedin.com/login', { waitUntil: 'domcontentloaded', timeout: 30000 });
        await wait(rand(1500, 3000));
        console.log(`[STEP 1] URL: ${page.url()}`);

        // Warmup: scroll around and move mouse like a real user
        console.log('[STEP 1] Warming up — scrolling and moving mouse...');
        await humanMouseMove(page);
        await humanScroll(page);
        await wait(rand(1000, 2000));
        await page.screenshot({ path: path.join(SCREENSHOT_DIR, '01_login_page.png') });
        console.log('[STEP 1] Screenshot saved');

        // ── Step 2: Fill email with human-like typing ──
        console.log('[STEP 2] Finding email field...');
        // LinkedIn renders 1 or 2 email inputs; find the visible one
        let emailInput = null;
        const emailCandidates = await page.$$('input[type="email"]');
        for (const c of emailCandidates) {
            if (await c.isVisible().catch(() => false)) { emailInput = c; break; }
        }
        if (!emailInput) throw new Error('No visible email input found');
        await wait(rand(300, 600));

        // Move mouse to email field
        console.log('[STEP 2] Moving mouse to email field...');
        await humanMouseMove(page);
        await wait(rand(500, 1000));

        // Click and type email with human rhythm
        console.log('[STEP 2] Typing email with human-like rhythm...');
        await emailInput.click();
        await wait(rand(300, 700));
        await humanType(page, EMAIL);
        await wait(rand(800, 1500));
        await page.screenshot({ path: path.join(SCREENSHOT_DIR, '02_email_filled.png') });
        console.log('[STEP 2] Email filled');

        // ── Step 3: Fill password with human-like typing ──
        console.log('[STEP 3] Finding password field...');
        let passInput = null;
        const passCandidates = await page.$$('input[type="password"]');
        for (const c of passCandidates) {
            if (await c.isVisible().catch(() => false)) { passInput = c; break; }
        }
        if (!passInput) throw new Error('No visible password input found');

        // Move mouse to password field (with some randomness)
        console.log('[STEP 3] Moving mouse to password field...');
        await humanMouseMove(page);
        await wait(rand(400, 900));

        // Click and type password
        console.log('[STEP 3] Typing password with human-like rhythm...');
        await passInput.click();
        await wait(rand(300, 700));
        await humanType(page, PASSWORD);
        await wait(rand(500, 1200));
        await page.screenshot({ path: path.join(SCREENSHOT_DIR, '03_password_filled.png') });
        console.log('[STEP 3] Password filled');

        // ── Step 4: Click Sign In with human-like behavior ──
        console.log('[STEP 4] Moving mouse to Sign In button...');
        await humanMouseMove(page);
        await wait(rand(500, 1000));

        const signInBtn = page.getByRole('button', { name: 'Sign in', exact: true });
        console.log('[STEP 4] Clicking Sign In...');
        await humanClick(page, signInBtn);

        // Wait for navigation
        console.log('[STEP 4] Waiting for page to respond...');
        await wait(rand(6000, 10000));
        try { await page.waitForLoadState('networkidle', { timeout: 15000 }); } catch {}
        console.log(`[STEP 4] URL after submit: ${page.url()}`);
        await page.screenshot({ path: path.join(SCREENSHOT_DIR, '04_after_submit.png') });

        // ── Step 5: Analyze result ──
        const currentUrl = page.url();

        if (currentUrl.includes('/feed')) {
            console.log('\n✅ RESULT: SUCCESS — Logged in to LinkedIn feed!');
        } else if (currentUrl.includes('/checkpoint')) {
            console.log('\n⚠️ RESULT: CHECKPOINT DETECTED');
            console.log(`URL: ${currentUrl}`);

            // Wait for CAPTCHA iframes to load
            console.log('[STEP 5] Waiting 10s for CAPTCHA to fully load...');
            await wait(10000);
            await page.screenshot({ path: path.join(SCREENSHOT_DIR, '05_checkpoint.png') });

            // Analyze what kind of checkpoint
            const iframes = await page.$$eval('iframe', els =>
                els.map(e => ({
                    src: e.src,
                    id: e.id,
                    visible: e.offsetWidth > 0 && e.offsetHeight > 0,
                }))
            );
            console.log(`[STEP 5] Found ${iframes.length} iframes:`);
            for (const f of iframes) {
                console.log(`  - id=${f.id} src=${f.src.substring(0, 100)}... visible=${f.visible}`);
            }

            // Check for specific detection signals
            const hasOtp = await page.$('input[name="pin"], #input__email_verification_pin');
            const hasCaptchaIframe = iframes.some(f => f.src.includes('captcha'));
            const hasProtechts = iframes.some(f => f.src.includes('protechts'));
            const hasRecaptcha = iframes.some(f => f.src.includes('recaptcha'));

            console.log(`[STEP 5] OTP input: ${hasOtp ? 'YES' : 'no'}`);
            console.log(`[STEP 5] LinkedIn CAPTCHA iframe: ${hasCaptchaIframe ? 'YES' : 'no'}`);
            console.log(`[STEP 5] li.protechts.net iframe: ${hasProtechts ? 'YES' : 'no'}`);
            console.log(`[STEP 5] Google reCAPTCHA: ${hasRecaptcha ? 'YES' : 'no'}`);

            // Extract protechts iframe URL params for analysis
            const protechtsFrame = iframes.find(f => f.src.includes('protechts'));
            if (protechtsFrame) {
                const url = new URL(protechtsFrame.src);
                console.log(`[STEP 5] protechts uc param: ${url.searchParams.get('uc')}`);
                console.log(`[STEP 5] protechts app_id: ${url.searchParams.get('app_id')}`);
            }

            // Dump page text
            const bodyText = await page.evaluate(() => document.body?.innerText?.substring(0, 500) || '');
            console.log(`[STEP 5] Page text: ${bodyText.replace(/\n/g, ' ').substring(0, 300)}`);

        } else {
            console.log(`\n❓ RESULT: UNKNOWN STATE — URL: ${currentUrl}`);
            await page.screenshot({ path: path.join(SCREENSHOT_DIR, '05_unknown.png') });
        }

    } catch (error) {
        console.error(`[ERROR] ${error.message}`);
        await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'error.png') }).catch(() => {});
    } finally {
        await wait(2000);
        await browser.close();
        console.log('[DONE] Browser closed');
    }
}

testLogin();
