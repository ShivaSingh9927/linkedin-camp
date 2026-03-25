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

    const targetX = box.x + box.width * (0.2 + Math.random() * 0.6);
    const targetY = box.y + box.height * (0.2 + Math.random() * 0.6);

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
        await page.keyboard.type(text[i], { delay: randomRange(50, 150) });
        if ([' ', '.', ',', '!'].includes(text[i])) {
            await wait(randomRange(200, 500));
        }
    }
}

async function startPhase2ProxyAutomation() {
    const userDataDir = path.join(__dirname, 'local_raja_session');

    const proxyUser = 'user-shivasingh_clgdY';
    const proxyPass = 'Iamironman_3';

    // Target Info
    const targetProfile = 'https://www.linkedin.com/in/shiva-singh-genai-llm/';
    const message = "Hi Shiva! I noticed the amazing work you're doing with GenAI. Would love to connect and share some ideas.";

    // --- IDENTITY CLONING (Waalaxy Strategy) ---
    let savedUserAgent = undefined;
    try {
        const fs = require('fs');
        const fp = JSON.parse(fs.readFileSync(path.join(__dirname, 'fingerprint.json'), 'utf-8'));
        savedUserAgent = fp.userAgent;
        console.log(`[STEALTH] Cloning Identity: ${savedUserAgent.slice(0, 40)}...`);
    } catch (e) {
        console.log('[STEALTH] No fingerprint.json found. Using default UA.');
    }

    console.log('[PHASE 2] Launching PROXY browser (HTTP Protocol)...');

    const context = await chromium.launchPersistentContext(userDataDir, {
        headless: true,
        userAgent: savedUserAgent,
        proxy: {
            // CHANGED: Use http instead of socks5
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
            '--ignore-certificate-errors',
            '--disable-http2', // Critical for ISP Proxy stability
            '--start-maximized'
        ],
        viewport: null
    });

    const page = context.pages()[0] || await context.newPage();
    page.setDefaultTimeout(200000);

    try {
        console.log('[STEP 1] Navigating straight to LinkedIn Feed...');
        await page.goto('https://www.linkedin.com/feed/', {
            waitUntil: 'domcontentloaded',
            timeout: 200000
        });

        await wait(randomRange(5000, 10000));

        // Safety Check: If we got logged out
        if (page.url().includes('/login') || page.url().includes('/checkpoint')) {
            console.log('⚠️ Session expired. Please login manually in the browser.');
            await page.waitForURL('**/feed/**', { timeout: 300000 });
        }

        console.log('[STEP 2] Human-style Search for Profile...');
        // Much more robust set of search bar selectors
        const searchInput = page.locator('input[placeholder="Search"], #global-nav-typeahead input, .search-global-typeahead__input').first();
        
        try {
            await searchInput.waitFor({ state: 'visible', timeout: 45000 });
            await wait(randomRange(1000, 3000));
            await searchInput.click();
            console.log('⚡ Search bar clicked.');
        } catch (e) {
            console.log('⚠️ Standard search bar selector failed. Trying fallback click...');
            await page.click('.search-global-typeahead__collapsed-button', { timeout: 5000 }).catch(() => {});
            await searchInput.waitFor({ state: 'visible', timeout: 10000 });
        }
        
        // Type the slug as search keyword
        const profileSlug = targetProfile.split('/in/')[1].replace('/', '');
        await searchInput.fill(profileSlug);
        await wait(randomRange(1200, 2500));
        await page.keyboard.press('Enter');
        
        console.log('✅ Search submitted. Waiting for results...');
        await page.waitForTimeout(randomRange(6000, 10000));

        // Now go to the profile (this looks like a click from the history/search results)
        console.log('[STEP 2.5] Loading Profile page (Increased Timeout)...');
        await page.goto(targetProfile, { 
            waitUntil: 'domcontentloaded', 
            timeout: 180000 
        }); 
        await wait(randomRange(25000, 45000)); 

        console.log('[STEP 3] Triggering Message Box (BIO-STEALTH Detection)...');
        // Natural scrolling to trigger React hydration
        await page.mouse.wheel(0, 400); 
        await wait(2000);

        const messageButtonSelectors = [
            '.pvs-profile-actions button:has-text("Message")', // Most specific
            'button.artdeco-button:has-text("Message")',
            'button:has-text("Message")',
            'a:has-text("Message")',
            '[data-control-name="message"]',
        ];

        let clicked = false;
        for (const sel of messageButtonSelectors) {
            try {
                const btn = page.locator(sel).filter({ visible: true }).first();
                if (await btn.isVisible({ timeout: 5000 })) {
                    console.log(`✅ Message button found using: ${sel}`);
                    clicked = await humanMoveAndClick(page, btn);
                    if (clicked) break;
                }
            } catch (e) {
                // Try next
            }
        }

        if (clicked) {
            console.log('✅ Message modal opening...');
            await wait(randomRange(5000, 8000)); 

            console.log('[STEP 4] Typing and Sending...');
            const textBox = page.locator('div.msg-form__contenteditable[contenteditable="true"], .msg-form__textarea, [role="textbox"]').first();
            await textBox.waitFor({ state: 'visible', timeout: 35000 });
            
            await humanType(page, message);
            await wait(randomRange(3000, 5000));

            const sendBtn = page.locator('button.msg-form__send-button, [data-control-name="send"]').filter({ visible: true }).first();
            await humanMoveAndClick(page, sendBtn);
            
            console.log('✅ MESSAGE SENT SUCCESSFULLY!');
        } else {
            console.log('❌ Message button not found after multi-layer scan. Taking final screenshot...');
            await page.screenshot({ path: path.join(__dirname, 'profile_error.png') });
            console.log('See: profile_error.png');
        }

    } catch (err) {
        console.error('[CRITICAL] Automation failed:', err.message);
    } finally {
        await wait(60000); // Wait 10s to ensure message is actually transmitted
        await context.close();
    }
}

startPhase2ProxyAutomation();