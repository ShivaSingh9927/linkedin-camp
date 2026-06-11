/**
 * test_campaign_api.js
 * Tests if we can make direct LinkedIn API calls from the server
 * using injected cookies (no Chrome browser needed after cookie injection).
 */
const { chromium } = require('patchright');
const fs = require('fs');
const path = require('path');

const PROXY = {
    server: 'http://82.41.252.111:46222',
    username: 'xBVyYdUpx84nWx7',
    password: 'dwwTxtvv5a10RXn',
};

async function testDirectApiCalls() {
    // Load saved session cookies
    const cookieFile = path.join(__dirname, 'screenshots', 'session', 'cookies.json');
    const cookies = JSON.parse(fs.readFileSync(cookieFile, 'utf8'));
    const liAt = cookies.find(c => c.name === 'li_at');
    const jsessionid = cookies.find(c => c.name === 'JSESSIONID');

    if (!liAt) { console.error('No li_at cookie found'); process.exit(1); }

    console.log('[TEST-DIRECT-API] Testing LinkedIn API calls with injected cookies');
    console.log(`[TEST-DIRECT-API] li_at: ${liAt.value.substring(0,40)}...`);
    console.log(`[TEST-DIRECT-API] JSESSIONID: ${jsessionid ? jsessionid.value.substring(0,30) + '...' : 'missing'}`);

    // Step 1: Use Playwright to get a CSRF token (needed for API calls)
    const browser = await chromium.launch({
        headless: false,
        channel: 'chrome',
        proxy: PROXY,
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-blink-features=AutomationControlled'],
    });

    const context = await browser.newContext({
        userAgent: 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36',
        viewport: { width: 1280, height: 800 },
        locale: 'en-US',
        timezoneId: 'America/New_York',
    });

    // Inject LinkedIn cookies
    const liCookies = cookies.filter(c => c.domain.includes('linkedin'));
    await context.addCookies(liCookies);
    console.log(`[TEST-DIRECT-API] Injected ${liCookies.length} LinkedIn cookies`);

    const page = await context.newPage();

    try {
        // Navigate to feed to get a valid JSESSIONID+"csrf-token" pairing
        console.log('[TEST-DIRECT-API] Navigating to /feed/ to get CSRF token...');
        await page.goto('https://www.linkedin.com/feed/', { waitUntil: 'domcontentloaded', timeout: 30000 });
        await page.waitForTimeout(3000);
        console.log(`[TEST-DIRECT-API] URL: ${page.url()}`);

        if (!page.url().includes('/feed')) {
            console.log(`[TEST-DIRECT-API] NOT on feed: ${page.url()}`);
            return;
        }

        // Get current cookies (they may have been refreshed) and derive CSRF token
        const currentCookies = await context.cookies();
        const currentLiAt = currentCookies.find(c => c.name === 'li_at');
        const currentJsId = currentCookies.find(c => c.name === 'JSESSIONID');
        // JSESSIONID IS the CSRF token in LinkedIn (strip quotes)
        const csrfToken = currentJsId ? currentJsId.value.replace(/"/g, '') : 'NONE';
        console.log(`[TEST-DIRECT-API] CSRF token (from JSESSIONID): ${csrfToken.substring(0,40)}...`);

        // Find the user's mini profile from the page to get profile ID
        const profileData = await page.evaluate(() => {
            const el = document.querySelector('code#bpr-guid-\\{\\{pageInstanceId\\}\\}, [data-linkedin-id]');
            if (el) return el.getAttribute('data-linkedin-id');
            // Try extracting from window data
            try {
                const w = window as any;
                const id = w.__SEO_DATA__?.profile?.memberId || '';
                return String(id);
            } catch { return ''; }
        });
        console.log(`[TEST-DIRECT-API] Profile ID from page: ${profileData || 'NOT FOUND'}`);

        // Get the profileId from the page's JSON data
        const profileId = await page.evaluate(() => {
            // LinkedIn embeds profile ID in various places
            const scripts = document.querySelectorAll('script[type="application/ld+json"]');
            for (const s of scripts) {
                try {
                    const data = JSON.parse(s.textContent || '');
                    if (data.identifier) return data.identifier;
                } catch {}
            }
            // Try from window data
            try {
                const w = window as any;
                const apps = w.LI?.apps || {};
                for (const k of Object.keys(apps)) {
                    const app = apps[k];
                    if (app?.data?.memberIdentifier) return app.data.memberIdentifier;
                }
            } catch {}
            return '';
        });
        console.log(`[TEST-DIRECT-API] Profile ID from scripts: ${profileId || 'NOT FOUND'}`);

        // Try the view profile endpoint that Waalaxy uses
        if (csrfToken !== 'NONE') {
            console.log('[TEST-DIRECT-API] Testing /me API (corrected)...');
            const meResult = await page.evaluate(async (csrf) => {
                try {
                    const res = await fetch('/voyager/api/me', {
                        headers: {
                            'accept': 'application/vnd.linkedin.normalized+json+2.1',
                            'x-restli-protocol-version': '2.0.0',
                            'csrf-token': csrf,
                        },
                    });
                    const text = await res.text();
                    return { status: res.status, body: text.substring(0, 500) };
                } catch (e) {
                    return { error: e.message };
                }
            }, csrfToken);
            console.log(`[TEST-DIRECT-API] /voyager/api/me: ${JSON.stringify(meResult)}`);
        }

    } catch (error) {
        console.error(`[TEST-DIRECT-API] Error: ${error.message}`);
    } finally {
        await browser.close();
        console.log('[TEST-DIRECT-API] Done');
    }
}

testDirectApiCalls().catch(console.error);
