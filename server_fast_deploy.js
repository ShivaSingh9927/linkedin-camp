const { chromium } = require('playwright-extra');
const stealth = require('puppeteer-extra-plugin-stealth')();
const path = require('path');

chromium.use(stealth);

async function startServerNuclearAutomation() {
    const userDataDir = path.join(__dirname, 'local_raja_session');
    const proxyUser = 'user-shivasingh_clgdY';
    const proxyPass = 'Iamironman_3';
    const targetProfile = 'https://www.linkedin.com/in/shiva-singh-genai-llm/';

    console.log('[SERVER] Launching in Headless Nuclear Mode...');

    const context = await chromium.launchPersistentContext(userDataDir, {
        headless: true, // MUST BE TRUE ON SERVER
        proxy: {
            server: 'http://disp.oxylabs.io:8001',
            username: proxyUser,
            password: proxyPass
        },
        locale: 'en-IN',
        timezoneId: 'Asia/Kolkata',
        geolocation: { latitude: 18.5204, longitude: 73.8567 },
        permissions: ['geolocation'],
        args: [
            '--disable-blink-features=AutomationControlled',
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-http2',
            '--disable-dev-shm-usage',
            '--disable-gpu',
            '--disable-features=Translate,OptimizationHints'
        ]
    });

    const page = context.pages()[0] || await context.newPage();

    // --- NUCLEAR RESOURCE BLOCKING FOR SPEED (ALLOWED CSS FOR UI RENDERING) ---
    await page.route('**/*', (route) => {
        const req = route.request();
        const url = req.url();
        const type = req.resourceType();
        if (['image', 'media', 'font'].includes(type) || 
            url.includes('google-analytics') || url.includes('doubleclick')) {
            return route.abort();
        }
        return route.continue();
    });

    try {
        console.log('[1/4] Warming up: Navigating to Feed...');
        await page.goto('https://www.linkedin.com/feed/', { waitUntil: 'domcontentloaded', timeout: 90000 });
        await page.waitForTimeout(5000); // Small wait for session to settle

        console.log('[2/4] Navigating to Profile (Fast Mode)...');
        await page.goto(targetProfile, { waitUntil: 'domcontentloaded', timeout: 90000 });

        console.log('[3/4] Waiting for Profile Content...');
        await page.waitForSelector('.profile-view-grid, .pv-top-card, .msg-convo-wrapper', { timeout: 60000 });
        console.log('✅ Profile/Chat Loaded.');

        console.log('[4/4] Triggering Message...');
        const openMessageBox = page.locator('.msg-form__contenteditable, [role="textbox"]').filter({ visible: true }).first();
        
        if (await openMessageBox.isVisible()) {
            console.log('⚡ Message box already open. Typing directly...');
            await openMessageBox.fill("Hi Shiva! Fast deployment test from Hetzner server was a success.");
            await page.waitForTimeout(2000);
            await page.keyboard.press('Control+Enter');
            console.log('✅ SERVER AUTOMATION COMPLETE: Message Sent.');
        } else {
            const msgBtn = page.locator('button:has-text("Message"), .pvs-profile-actions button:visible').first();
            if (await msgBtn.isVisible()) {
                await msgBtn.click();
                const textBox = page.locator('.msg-form__contenteditable, [role="textbox"]').first();
                await textBox.waitFor({ state: 'visible' });
                await textBox.fill("Hi Shiva! This fast message comes from the Hetzner server.");
                await page.waitForTimeout(2000);
                await page.keyboard.press('Control+Enter');
                console.log('✅ SERVER AUTOMATION COMPLETE: Message Sent.');
            }
        }
    } catch (err) {
        console.error('❌ SERVER ERROR:', err.message);
        await page.screenshot({ path: 'headless_error.png' });
    } finally {
        await page.waitForTimeout(10000);
        await context.close();
    }
}

startServerNuclearAutomation();
