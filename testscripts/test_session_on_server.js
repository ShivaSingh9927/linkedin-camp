/**
 * test_session_on_server.js
 * Tests if saved session cookies work on the server with proxy.
 * Run on the SERVER: docker exec backend-api node /app/test_session.js
 */

const { chromium } = require('patchright');
const fs = require('fs');
const path = require('path');

async function testSession() {
    const cookieFile = '/tmp/session_cookies.json';
    if (!fs.existsSync(cookieFile)) {
        console.error('No cookie file at', cookieFile);
        process.exit(1);
    }

    const cookies = JSON.parse(fs.readFileSync(cookieFile, 'utf8'));
    const liAt = cookies.find(c => c.name === 'li_at');
    console.log(`[TEST] Cookies: ${cookies.length}, li_at: ${liAt ? 'present' : 'MISSING'}`);

    const browser = await chromium.launch({
        headless: true,
        proxy: { server: 'http://82.41.252.111:46222', username: 'xBVyYdUpx84nWx7', password: 'dwwTxtvv5a10RXn' },
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-blink-features=AutomationControlled'],
    });

    const context = await browser.newContext({
        userAgent: 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36',
    });

    // Inject cookies
    const linkedinCookies = cookies.filter(c => c.domain.includes('linkedin'));
    await context.addCookies(linkedinCookies);
    console.log(`[TEST] Injected ${linkedinCookies.length} LinkedIn cookies`);

    const page = await context.newPage();
    await page.goto('https://www.linkedin.com/feed/', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(5000);

    const url = page.url();
    console.log(`[TEST] URL: ${url}`);

    if (url.includes('/feed') || url.includes('/in/')) {
        console.log('✅ SUCCESS: Session valid on server with proxy!');
        await page.screenshot({ path: '/tmp/session_test_success.png' });
    } else if (url.includes('/login')) {
        console.log('❌ FAILED: Session invalid, redirected to login');
    } else if (url.includes('/checkpoint')) {
        console.log('⚠️ CHECKPOINT: Challenge appeared on server');
    } else {
        console.log(`❓ UNKNOWN: ${url}`);
    }

    await page.screenshot({ path: '/tmp/session_test_result.png' });
    await browser.close();
}

testSession().catch(e => { console.error(e.message); process.exit(1); });
