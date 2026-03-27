const { chromium } = require('playwright-extra');
const stealth = require('puppeteer-extra-plugin-stealth')();
const path = require('path');

chromium.use(stealth);

async function phase1LocalLogin() {
    // We use the same session folder that Phase 2 will use
    const userDataDir = path.join(__dirname, 'local_raja_session');
    
    console.log('[PHASE 1] Launching LOCAL browser (NO PROXY)...');
    console.log('[SYSTEM] Use this to login to LinkedIn manually on your own internet.');

    const context = await chromium.launchPersistentContext(userDataDir, {
        headless: false,
        args: [
            '--disable-blink-features=AutomationControlled',
            '--start-maximized'
        ],
        viewport: null
    });

    const page = context.pages()[0] || await context.newPage();

    try {
        await page.goto('https://www.linkedin.com/login');

        console.log('\n--- ACTION REQUIRED ---');
        console.log('1. Login to LinkedIn manually.');
        console.log('2. Solve any security checks.');
        console.log('3. Once you see your Home Feed, WAIT 15 seconds.');
        console.log('4. Then close the browser window or the terminal.');
        console.log('------------------------\n');

        // Wait for the feed to confirm login
        await page.waitForURL('**/feed/**', { timeout: 600000 });
        
        // --- NEW: FINGERPRINT CAPTURE ---
        const userAgent = await page.evaluate(() => navigator.userAgent);
        const fs = require('fs');
        fs.writeFileSync(path.join(__dirname, 'fingerprint.json'), JSON.stringify({ userAgent }, null, 2));

        console.log('✅ LOGIN DETECTED & IDENTITY CLONED!');
        console.log(`[ID] ${userAgent.slice(0, 50)}...`);
        
        console.log('[SYSTEM] Keeping browser open for 15s to save session...');
        await page.waitForTimeout(15000);
        console.log('✅ SESSION SAVED. You can now close this and run Phase 2.');

    } catch (error) {
        console.error('❌ Error:', error.message);
    } finally {
        await context.close();
    }
}

phase1LocalLogin();
