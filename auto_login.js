const { chromium } = require('playwright-extra');
const stealth = require('puppeteer-extra-plugin-stealth')();
const path = require('path');

chromium.use(stealth);

async function wait(ms) {
    return new Promise(res => setTimeout(res, ms));
}

const randomRange = (min, max) => Math.floor(Math.random() * (max - min + 1) + min);

async function humanType(page, selector, text) {
    const el = page.locator(selector).first();
    await el.waitFor({ state: 'visible' });
    await el.click();
    for (let char of text) {
        await page.keyboard.type(char, { delay: randomRange(60, 200) });
        await wait(randomRange(50, 150));
    }
}

async function autoLogin() {
    const userDataDir = path.join(__dirname, 'linkedin_session');
    const username = "rajaji98971@gmail.com";
    const password = "Hue#35op";

    console.log('[AUTO-LOGIN] Starting automated login for Rajaji...');
    
    const context = await chromium.launchPersistentContext(userDataDir, {
        headless: false, // User can see the screen if they want, or I take a screenshot
        executablePath: '/usr/bin/google-chrome', // Use real chrome if available (often better stealth)
        args: [
            '--disable-blink-features=AutomationControlled',
            '--no-sandbox',
            '--disable-setuid-sandbox'
        ],
        userAgent: 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
    });

    // In some environments google-chrome might not be at that path, let chromium handle it if it fails
    const page = context.pages().length > 0 ? context.pages()[0] : await context.newPage();

    try {
        console.log('[AUTO-LOGIN] Navigating to LinkedIn Login...');
        await page.goto('https://www.linkedin.com/login', { waitUntil: 'domcontentloaded' });
        
        // Wait for page to settle
        await wait(2000);

        // Fill credentials
        if (await page.isVisible('#username')) {
            console.log('[AUTO-LOGIN] Typing username...');
            await humanType(page, '#username', username);
            await wait(randomRange(800, 1500));
            
            console.log('[AUTO-LOGIN] Typing password...');
            await humanType(page, '#password', password);
            await wait(randomRange(1500, 2500));

            console.log('[AUTO-LOGIN] Clicking Sign In...');
            await page.click('button[type="submit"]');
        } else {
            console.log('[AUTO-LOGIN] Already on password screen or different layout. Waiting...');
            // Some layouts have different IDs
        }

        console.log('[AUTO-LOGIN] Waiting for feed (solve CAPTCHA/2FA manually if needed)...');
        try {
            await page.waitForURL('**/feed/**', { timeout: 60000 });
            console.log('✅ LOGIN SUCCESSFUL!');
        } catch (e) {
            console.log('⚠️ Login stuck or CAPTCHA/2FA detected. Saving screenshot to auto_login_error.png');
            await page.screenshot({ path: path.join(__dirname, 'auto_login_error.png'), fullPage: true });
        }

        console.log('[AUTO-LOGIN] Sinking session data for 10s...');
        await wait(10000);
    } catch (error) {
        console.error('❌ FATAL ERROR:', error.message);
    } finally {
        await context.close();
        console.log('[AUTO-LOGIN] Browser closed. Files in: ' + userDataDir);
    }
}

autoLogin().catch(e => console.error(e));
