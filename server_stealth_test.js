const { chromium } = require('playwright-extra');
const stealth = require('puppeteer-extra-plugin-stealth')();
const path = require('path');

chromium.use(stealth);

// --- HUMANIZATION HELPERS ---
const wait = (ms) => new Promise(res => setTimeout(res, ms));
const randomRange = (min, max) => Math.floor(Math.random() * (max - min + 1) + min);

async function humanMoveAndClick(page, target) {
    const element = typeof target === 'string' ? page.locator(target).first() : target;
    const box = await element.boundingBox();
    if (!box) return false;

    // Target a random point within the button
    const targetX = box.x + box.width * (0.2 + Math.random() * 0.6);
    const targetY = box.y + box.height * (0.2 + Math.random() * 0.6);

    // Hover first (human behavior)
    await page.mouse.move(targetX, targetY, { steps: 15 });
    await wait(randomRange(250, 700));
    await page.mouse.click(targetX, targetY);
    return true;
}

async function humanType(page, text) {
    const box = page.locator('div.msg-form__contenteditable[contenteditable="true"], .msg-form__textarea, [role="textbox"]').first();
    await box.waitFor({ state: 'visible', timeout: 10000 });
    await box.click({ force: true });
    await wait(randomRange(800, 1500));

    for (let i = 0; i < text.length; i++) {
        // Reduced typo chance to 1.5% for better reliability
        if (Math.random() < 0.015 && i > 0) {
            const wrongKey = 'asdfghjkl'[Math.floor(Math.random() * 9)];
            await page.keyboard.press(wrongKey);
            await wait(randomRange(250, 500));
            await page.keyboard.press('Backspace');
            await wait(randomRange(200, 400));
        }

        await page.keyboard.type(text[i], { delay: randomRange(60, 200) });

        if ([' ', '.', ',', '!'].includes(text[i])) {
            await wait(randomRange(300, 700));
        }
    }
}

async function startBioStealthProtocol() {
    const userDataDir = '/app/sessions/09cae3b3-585e-4b0d-bdb1-f7be855725e1';
    const targetProfile = 'https://www.linkedin.com/in/shiva-singh-genai-llm/';
    const message = "Hi Shiva! This is a test from the Headless Bio-Stealth script. Hope you're having a great day!";

    const context = await chromium.launchPersistentContext(userDataDir, {
        headless: true,
        viewport: { width: 1440, height: 900 },
        args: ['--disable-blink-features=AutomationControlled', '--no-sandbox', '--disable-setuid-sandbox'],
        userAgent: 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
        proxy: {
            server: 'http://disp.oxylabs.io:8001',
            username: 'user-shivasingh_clgdY',
            password: 'Iamironman_3'
        }
    });

    const page = context.pages()[0] || await context.newPage();

    try {
        console.log('[HEADLESS-STEALTH] Check for Session validity...');
        await page.goto('https://www.linkedin.com/feed/', { waitUntil: 'domcontentloaded' });
        await wait(3000);
        console.log('[HEADLESS-STEALTH] Capturing Step 1 screenshot...');
        await page.screenshot({ path: '/app/step_1_feed_landing.png', timeout: 10000 }).catch(() => console.warn('Screenshot 1 failed'));

        // Check if we hit the Auth wall / Welcome Back page
        const isWelcomeBack = await page.isVisible('text="Welcome Back"');
        const hasSignInAnother = await page.isVisible('text="Sign in using another account"');
        const isLogin = page.url().includes('login') || page.url().includes('authwall');

        if (isWelcomeBack || hasSignInAnother || isLogin) {
            console.log('[HEADLESS-STEALTH] Session requires re-authentication. Triggering Auto-Login...');
            
            // Log the structure for one last check if it's the right screen
            const bodyText = await page.evaluate(() => document.body.innerText);
            if (bodyText.includes('Welcome Back')) {
                console.log('[HEADLESS-STEALTH] Confirmed: Welcome Back screen detected.');
            }

            // Click Priority: Raja Singh Card First
            const rajaCardSelector = 'button:has-text("Raja Singh"), .authwall-profile-card__profile-card-action, [aria-label*="Raja Singh"]';
            const otherAccountSelector = 'button:has-text("Sign in using another account"), div[role="button"]:has-text("Sign in using another account"), .authwall-profile-card__add-account';

            if (await page.isVisible(rajaCardSelector)) {
                console.log('[HEADLESS-STEALTH] Clicking "Raja Singh" identity card...');
                await page.click(rajaCardSelector);
                await wait(3000);
            } else if (await page.isVisible(otherAccountSelector)) {
                console.log('[HEADLESS-STEALTH] Clicking "Sign in using another account" card...');
                await page.click(otherAccountSelector);
                await wait(3000);
            } else {
                console.log('[HEADLESS-STEALTH] Direct navigation to login fallback...');
                await page.goto('https://www.linkedin.com/login', { waitUntil: 'domcontentloaded' });
                await wait(2000);
            }

            console.log('[HEADLESS-STEALTH] Filling credentials...');
            const p = page;
            if (await p.isVisible('#username')) {
                await p.fill('#username', 'rajaji98971@gmail.com');
                await wait(1000);
            }
            if (await p.isVisible('#password')) {
                await p.fill('#password', 'Hue#35op');
                await wait(1000);
                await p.click('button[type="submit"]');
            }

            console.log('[HEADLESS-STEALTH] Waiting for Feed or Security Check...');
            try {
                // Wait for either the Feed OR the Security PIN field
                await Promise.race([
                    p.waitForURL('**/feed/**', { timeout: 30000 }),
                    p.waitForSelector('input[name="pin"], #input__email_verification_pin', { timeout: 15000 })
                ]);
                
                // If it's a security check, fill the PIN
                if (await p.isVisible('input[name="pin"], #input__email_verification_pin')) {
                     console.log('[HEADLESS-STEALTH] 🛡️ 2FA Gate Detected. Inserting code: 623685...');
                     await p.fill('input[name="pin"], #input__email_verification_pin', '623685');
                     await wait(1000);
                     await p.click('button[type="submit"], #email-pin-submit-button');
                     console.log('[HEADLESS-STEALTH] PIN submitted. Waiting for Feed...');
                     await p.waitForURL('**/feed/**', { timeout: 30000 });
                }

                console.log('[HEADLESS-STEALTH] Re-authentication successful! Session landed on Feed.');
            } catch (err) {
                console.warn('[HEADLESS-STEALTH] ⚠️ Final redirect failed. Capturing failure state...');
                const pageText = await page.evaluate(() => document.body.innerText);
                console.log('--- ERROR PAGE TEXT ---');
                console.log(pageText);
                throw err;
            }
        }

        console.log('[HEADLESS-STEALTH] Step 1: Human Warmup (Feeding scrolling)...');
        await page.goto('https://www.linkedin.com/feed/', { waitUntil: 'domcontentloaded' });

        // Natural scrolling
        for (let i = 0; i < 3; i++) {
            await page.mouse.wheel(0, randomRange(400, 800));
            await wait(randomRange(2000, 5000)); // "Reading" time
        }
        console.log('[HEADLESS-STEALTH] Capturing Step 2 screenshot...');
        await page.screenshot({ path: '/app/step_2_feed_scrolled.png', timeout: 10000 }).catch(() => console.warn('Screenshot 2 failed'));

        console.log('[HEADLESS-STEALTH] Step 2: Navigating to Profile...');
        await page.goto(targetProfile, { waitUntil: 'domcontentloaded', timeout: 60000 });
        await wait(randomRange(5000, 10000)); // Extra time for profile
        console.log('[HEADLESS-STEALTH] Capturing Step 3 screenshot...');
        await page.screenshot({ path: '/app/step_3_profile_landed.png', timeout: 10000 }).catch(() => console.warn('Screenshot 3 failed'));

        console.log('[HEADLESS-STEALTH] Step 3: Triggering Message Box...');
        const messageButtonSelectors = [
            'button:has-text("Message")',
            'a:has-text("Message")',
            '[data-control-name="message"]',
            '.pvs-profile-actions button:has-text("Message")',
            'button.artdeco-button:has-text("Message")',
        ];

        let clicked = false;
        for (const sel of messageButtonSelectors) {
            try {
                const btn = page.locator(sel).filter({ visible: true }).first();
                if (await btn.isVisible({ timeout: 2000 })) {
                    clicked = await humanMoveAndClick(page, btn);
                    if (clicked) {
                        console.log(`[HEADLESS-STEALTH] Clicked Message button using: ${sel}`);
                        break;
                    }
                }
            } catch (e) { }
        }

        if (!clicked) {
            console.log('[HEADLESS-STEALTH] Error: Message button not found. Falling back to direct messaging link...');
            await page.screenshot({ path: '/app/step_4_message_button_not_found.png', timeout: 10000 }).catch(() => {});
            await page.goto('https://www.linkedin.com/messaging/', { waitUntil: 'domcontentloaded' });
            await wait(randomRange(3000, 5000));
        } else {
            console.log('[HEADLESS-STEALTH] Message button clicked successfully!');
            await wait(3000);
            await page.screenshot({ path: '/app/step_5_message_modal_open.png', timeout: 10000 }).catch(() => {});
        }

        await wait(randomRange(1500, 3000));

        console.log('[HEADLESS-STEALTH] Step 4: Typing with human errors and rhythm...');
        await humanType(page, message);
        await page.screenshot({ path: '/app/step_6_after_typing.png', timeout: 10000 }).catch(() => {});

        console.log('[HEADLESS-STEALTH] Step 5: Thinking time before sending...');
        await wait(randomRange(2500, 5000));

        // Send Button
        const sendBtnSel = 'button.msg-form__send-button, button[type="submit"]:has-text("Send")';
        const sent = await humanMoveAndClick(page, page.locator(sendBtnSel).filter({ visible: true }).first());

        if (!sent) {
            console.log('[HEADLESS-STEALTH] Send button click failed, pressing Enter...');
            await page.keyboard.press('Enter');
        }

        await wait(2000);
        await page.screenshot({ path: '/app/step_7_after_send.png', timeout: 10000 }).catch(() => {});

        console.log('✅ HEADLESS-STEALTH PROTOCOL COMPLETE: Message Sent.');

    } catch (err) {
        console.error('[CRITICAL ERROR]', err);
        await page.screenshot({ path: '/app/step_error_HEADLESS.png', fullPage: true, timeout: 15000 }).catch(() => {});
    } finally {
        await wait(5000);
        await context.close();
    }
}

startBioStealthProtocol();
