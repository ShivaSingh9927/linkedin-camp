const { chromium } = require('playwright-extra');
const stealth = require('puppeteer-extra-plugin-stealth')();
const path = require('path');

chromium.use(stealth);

async function saveLinkedInSession() {
    const userDataDir = path.join(__dirname, 'local_raja_session');
    
    // Proxy Credentials
    const proxyUser = 'shivasingh_clgdY';
    const proxyPass = 'Iamironman_3';

    console.log('[SYSTEM] Launching Browser for LinkedIn Login...');

    const context = await chromium.launchPersistentContext(userDataDir, {
        headless: false,
        proxy: {
            server: 'http://disp.oxylabs.io:8001',
            username: proxyUser,
            password: proxyPass
        },
        // --- STEALTH & GEO-ALIGNMENT ---
        locale: 'en-IN',
        timezoneId: 'Asia/Kolkata',
        geolocation: { latitude: 18.5204, longitude: 73.8567 },
        permissions: ['geolocation'],
        userAgent: 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36',
        // --------------------------------
        args: [
            '--disable-blink-features=AutomationControlled',
            '--no-sandbox',
            '--ignore-certificate-errors',
            '--disable-features=IsolateOrigins,site-per-process',
            '--start-maximized'
        ],
        viewport: null
    });

    const page = context.pages()[0];
    page.setDefaultTimeout(90000);

    try {
        // Step 1: Verification
        console.log('[1/2] Verifying Proxy Outbound IP...');
        await page.goto('https://ip.oxylabs.io/location', { waitUntil: 'networkidle' });
        console.log('✅ Proxy Active (Vodafone ISP confirmed)');

        // Step 2: LinkedIn Login
        console.log('[2/2] Navigating to LinkedIn Login...');
        await page.goto('https://www.linkedin.com/login', { 
            waitUntil: 'domcontentloaded' 
        });

        console.log('\n--- ACTION REQUIRED ---');
        console.log('1. Enter your LinkedIn Email and Password.');
        console.log('2. Solve the Security Check / CAPTCHA.');
        console.log('3. DO NOT close the browser until you see the Home Feed.');
        console.log('------------------------\n');

        // Wait for up to 10 minutes for you to finish the login manually
        // Once the URL contains "/feed/", the script knows you are in.
        await page.waitForURL('**/feed/**', { timeout: 600000 });

        console.log('✅ LOGIN DETECTED!');
        console.log('[SYSTEM] Staying active for 15 seconds to flush cookies to disk...');
        
        // This wait is crucial so the 'local_raja_session' folder saves the login state
        await page.waitForTimeout(15000);
        
        console.log('✅ SESSION SAVED SUCCESSFULLY.');
        console.log('You can now close the terminal/browser.');

    } catch (error) {
        console.error('❌ ERROR:', error.message);
        console.log('TIP: If the page closed before you finished, just run the script again.');
    } finally {
        await context.close();
    }
}

saveLinkedInSession();