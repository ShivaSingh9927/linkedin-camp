const { chromium } = require('playwright-extra');
const stealth = require('puppeteer-extra-plugin-stealth')();
const path = require('path');
const fs = require('fs');

// Use Stealth Plugin
chromium.use(stealth);

async function phase1CookieCapture() {
    console.log('[PHASE 1] Launching browser for CLEAN Cookie Capture...');
    console.log('[SYSTEM] We are NOT using a persistent directory. This is a fresh session.');

    const browser = await chromium.launch({
        headless: false,
        args: [
            '--disable-blink-features=AutomationControlled',
            '--start-maximized'
        ]
    });

    const context = await browser.newContext({
        viewport: null, // Allow window to be maximized
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'
    });

    const page = await context.newPage();

    try {
        await page.goto('https://www.linkedin.com/login', { waitUntil: 'networkidle' });

        console.log('\n--- ACTION REQUIRED ---');
        console.log('1. Login to LinkedIn manually.');
        console.log('2. Solve any security checks (CAPTCHAs).');
        console.log('3. Once you reach the Feed, the script will auto-save and close.');
        console.log('------------------------\n');

        // Wait for the feed (up to 10 minutes)
        await page.waitForURL('**/feed/**', { timeout: 600000 });
        console.log('✅ Login detected on Feed!');

        // Optional: Wait extra time for all cookies to settle (CSRF, etc.)
        await page.waitForTimeout(5000);

        // 1. Capture All Cookies
        const cookies = await context.cookies();
        fs.writeFileSync(path.join(__dirname, 'cookies.json'), JSON.stringify(cookies, null, 2));
        console.log(`✅ ${cookies.length} COOKIES SAVED to cookies.json`);

        // 2. Capture Fingerprint (User Agent is the most critical part)
        const userAgent = await page.evaluate(() => navigator.userAgent);
        fs.writeFileSync(path.join(__dirname, 'fingerprint.json'), JSON.stringify({ userAgent }, null, 2));
        console.log(`✅ FINGERPRINT SAVED (UA: ${userAgent.slice(0, 50)}...)`);

        // 3. Optional: Capture Local Storage (Sometime useful for session persistence)
        const localStorageData = await page.evaluate(() => JSON.stringify(window.localStorage));
        fs.writeFileSync(path.join(__dirname, 'localStorage.json'), localStorageData);
        console.log('✅ LOCAL STORAGE SAVED to localStorage.json');

        console.log('\n[SUCCESS] Session captured. You can now run Phase 2.');
        await page.waitForTimeout(2000);

    } catch (error) {
        console.error('❌ Error during capture:', error.message);
    } finally {
        await browser.close();
    }
}

phase1CookieCapture();
