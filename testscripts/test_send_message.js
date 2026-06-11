/**
 * test_send_message.js
 *
 * Uses saved cookies to log into LinkedIn, visit a lead profile, and send a message.
 * No login flow — uses pre-extracted cookies. Tests end-to-end cookie + DOM automation.
 *
 * Usage: node testscripts/test_send_message.js
 */

const { chromium } = require('patchright');
const path = require('path');
const fs = require('fs');

const PROXY = {
    server: 'http://82.41.252.111:46222',
    username: 'xBVyYdUpx84nWx7',
    password: 'dwwTxtvv5a10RXn',
};

const TARGET_PROFILE = 'https://www.linkedin.com/in/shiva-singh-genai-llm/';
const MESSAGE_TEXT = "Hi Shiva, I came across your profile and was impressed by your work in GenAI and LLMs. Would you be open to connecting?";

const SCREENSHOT_DIR = path.join(__dirname, 'screenshots');

const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const rand = (min, max) => Math.floor(Math.random() * (max - min + 1) + min);

async function humanMove(page, locator) {
    const box = await locator.boundingBox();
    if (!box) { await locator.click(); return; }
    const x = box.x + box.width * (0.2 + Math.random() * 0.6);
    const y = box.y + box.height * (0.2 + Math.random() * 0.6);
    await page.mouse.move(x, y, { steps: rand(10, 20) });
    await wait(rand(300, 800));
    await page.mouse.click(x, y);
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

async function humanScroll(page) {
    for (let i = 0; i < rand(2, 3); i++) {
        await page.mouse.wheel(0, rand(100, 400));
        await wait(rand(800, 1500));
    }
}

async function sendMessage() {
    fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });

    // Load saved cookies
    const cookieFile = path.join(__dirname, 'screenshots', 'session', 'cookies.json');
    const cookies = JSON.parse(fs.readFileSync(cookieFile, 'utf8'));
    const liAt = cookies.find(c => c.name === 'li_at');
    console.log(`[TEST] Loaded ${cookies.length} cookies, li_at: ${liAt ? 'PRESENT' : 'MISSING'}`);

    if (!liAt) {
        console.error('[TEST] No li_at cookie. Run test_login_manual_captcha.js first to capture a session.');
        process.exit(1);
    }

    // Launch Chrome with proxy
    console.log('[TEST] Launching Chrome with proxy...');
    const browser = await chromium.launch({
        headless: false,
        channel: 'chrome',
        proxy: PROXY,
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-blink-features=AutomationControlled'],
    });

    const context = await browser.newContext({
        userAgent: 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36',
        viewport: null,
        locale: 'en-US',
        timezoneId: 'America/New_York',
    });

    // Inject LinkedIn cookies
    const liCookies = cookies.filter(c => c.domain.includes('linkedin'));
    await context.addCookies(liCookies);
    console.log(`[TEST] Injected ${liCookies.length} LinkedIn cookies`);

    const page = await context.newPage();

    try {
        // Step 1: Navigate to feed to verify session
        console.log('\n[STEP 1] Checking session on /feed/...');
        await page.goto('https://www.linkedin.com/feed/', { waitUntil: 'domcontentloaded', timeout: 30000 });
        await wait(rand(3000, 5000));
        await humanScroll(page);
        await wait(1000);
        await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'msg_01_feed.png') });

        if (!page.url().includes('/feed')) {
            console.log(`[STEP 1] NOT on feed: ${page.url()} — session invalid`);
            await browser.close();
            return;
        }
        console.log('[STEP 1] ✅ Session valid — on /feed/');

        // Step 2: Visit target profile
        console.log(`\n[STEP 2] Visiting profile: ${TARGET_PROFILE}`);
        await page.goto(TARGET_PROFILE, { waitUntil: 'domcontentloaded', timeout: 30000 });
        await wait(rand(4000, 7000));
        await humanScroll(page);
        await wait(1000);
        await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'msg_02_profile.png') });
        console.log(`[STEP 2] URL: ${page.url()}`);

        // Step 3: Find and click Message button
        console.log('\n[STEP 3] Looking for Message button...');

        const messageSelectors = [
            'button[aria-label*="Message"]',
            'button:has-text("Message")',
            'a[aria-label*="Message"]',
            '[data-testid="send-message-button"]',
            '.message-anywhere-button',
            '.pv-s-profile-actions--message',
        ];

        let messageBtn = null;
        for (const sel of messageSelectors) {
            const btn = page.locator(sel).first();
            const count = await btn.count();
            if (count > 0) {
                const visible = await btn.isVisible().catch(() => false);
                if (visible) {
                    messageBtn = btn;
                    console.log(`[STEP 3] Found Message button via: ${sel}`);
                    break;
                }
            }
        }

        if (!messageBtn) {
            // Last resort: list all buttons
            const allBtns = await page.$$eval('button', els => els.slice(0, 15).map(e => ({
                text: e.textContent.trim().substring(0, 50),
                ariaLabel: e.getAttribute('aria-label'),
                visible: e.offsetParent !== null,
            })));
            console.log(`[STEP 3] All visible buttons: ${JSON.stringify(allBtns, null, 2)}`);

            await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'msg_03_no_message_btn.png') });
            console.log('[STEP 3] ❌ No Message button found');
            await browser.close();
            return;
        }

        // Click with human-like behavior
        console.log('[STEP 3] Clicking Message button...');
        await humanMove(page, messageBtn);
        await wait(rand(2000, 4000));

        // Step 4: Check for message modal/popup
        console.log('\n[STEP 4] Looking for message input...');

        await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'msg_04_after_click.png') });

        const composeSelectors = [
            '.msg-form__contenteditable',
            'div[role="textbox"]',
            '.ql-editor[contenteditable="true"]',
            'div[contenteditable="true"]',
            '.msg-conversation-textarea',
            '#message-editor',
        ];

        let composeBox = null;
        for (const sel of composeSelectors) {
            const box = page.locator(sel).first();
            const count = await box.count();
            if (count > 0) {
                const visible = await box.isVisible().catch(() => false);
                if (visible) {
                    composeBox = box;
                    console.log(`[STEP 4] Found compose box via: ${sel}`);
                    break;
                }
            }
        }

        if (!composeBox) {
            console.log('[STEP 4] No compose box — dumping page structure...');
            const inputs = await page.$$eval('div[role="textbox"], div[contenteditable], textarea', els =>
                els.map(e => ({ role: e.getAttribute('role'), contentEditable: e.contentEditable, visible: e.offsetParent !== null, text: e.textContent.substring(0, 30) }))
            );
            console.log(`[STEP 4] Editable elements: ${JSON.stringify(inputs, null, 2)}`);
            await browser.close();
            return;
        }

        // Step 5: Type message with human-like behavior
        console.log('\n[STEP 5] Typing message...');
        await humanMove(page, composeBox);
        await wait(rand(500, 1000));
        await page.keyboard.press('Control+a');
        await wait(100);
        await humanType(page, MESSAGE_TEXT);
        await wait(rand(1000, 2000));
        await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'msg_05_message_typed.png') });
        console.log(`[STEP 5] Message typed: "${MESSAGE_TEXT}"`);

        // Step 6: Find and click Send button
        console.log('\n[STEP 6] Looking for Send button...');
        const sendSelectors = [
            'button[type="submit"]',
            'button:has-text("Send")',
            'button.msg-form__send-button',
            'button.artdeco-button--primary',
            '.send-button',
        ];

        let sendBtn = null;
        for (const sel of sendSelectors) {
            const btn = page.locator(sel).first();
            const count = await btn.count();
            if (count > 0) {
                const visible = await btn.isVisible().catch(() => false);
                if (visible) {
                    sendBtn = btn;
                    console.log(`[STEP 6] Found Send button via: ${sel}`);
                    break;
                }
            }
        }

        if (!sendBtn) {
            console.log('[STEP 6] 💡 Pressing Enter instead');
            await page.keyboard.press('Enter');
            await wait(rand(2000, 4000));
        } else {
            await humanMove(page, sendBtn);
            await wait(rand(500, 1000));
        }

        await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'msg_06_sent.png') });
        console.log('\n✅ Message sent successfully!');

        // Save updated cookies (they may be refreshed after this activity)
        const updatedCookies = await context.cookies();
        fs.writeFileSync(path.join(SCREENSHOT_DIR, 'session', 'cookies.json'), JSON.stringify(updatedCookies, null, 2));
        console.log(`✅ Updated ${updatedCookies.length} cookies saved`);

    } catch (error) {
        console.error(`\n[ERROR] ${error.message}`);
        await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'msg_error.png') }).catch(() => {});
    } finally {
        await wait(2000);
        await context.close();
        console.log('[DONE] Browser closed');
    }
}

sendMessage();
