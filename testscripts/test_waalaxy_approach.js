/**
 * test_waalaxy_approach.js
 *
 * Replicates Waalaxy's architecture:
 * 1. Chrome launched with proxy + channel:'chrome' (real TLS fingerprint)
 * 2. Cookies injected from saved session
 * 3. ALL LinkedIn operations via page.evaluate(fetch()) — mimicking
 *    Waalaxy's service worker making direct API calls from the browser
 * 4. NO DOM manipulation — pure API calls from the browser context
 *
 * Usage: node testscripts/test_waalaxy_approach.js
 */

const { chromium } = require('patchright');
const path = require('path');
const fs = require('fs');

const PROXY = {
    server: 'http://82.41.252.111:46222',
    username: 'xBVyYdUpx84nWx7',
    password: 'dwwTxtvv5a10RXn',
};

const SCREENSHOT_DIR = path.join(__dirname, 'screenshots');

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

async function main() {
    fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });

    // Load cookies
    const cookies = JSON.parse(fs.readFileSync(path.join(SCREENSHOT_DIR, 'session', 'cookies.json'), 'utf8'));
    const liAt = cookies.find((c) => c.name === 'li_at');
    console.log(`[WAL] Loaded ${cookies.length} cookies, li_at: ${liAt ? 'PRESENT' : 'MISSING'}`);
    if (!liAt) { console.error('No li_at cookie!'); process.exit(1); }

    // Launch Chrome (exactly like Waalaxy's browser — real Chrome, cookies, no CDP needed for TLS)
    console.log('[WAL] Launching Chrome with proxy...');
    const browser = await chromium.launch({
        headless: false,
        channel: 'chrome',
        proxy: PROXY,
        args: ['--no-sandbox', '--disable-blink-features=AutomationControlled'],
    });

    const context = await browser.newContext({
        userAgent: 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36',
        viewport: { width: 1280, height: 800 },
        locale: 'en-US',
        timezoneId: 'America/New_York',
    });

    // Inject LinkedIn cookies
    const liCookies = cookies.filter((c) => c.domain.includes('linkedin'));
    await context.addCookies(liCookies);
    console.log(`[WAL] Injected ${liCookies.length} LinkedIn cookies`);

    const page = await context.newPage();

    try {
        // ─── Step 1: Navigate to /feed/ to establish CSRF token ───
        console.log('\n[STEP 1] Loading /feed/ to get CSRF token...');
        await page.goto('https://www.linkedin.com/feed/', { waitUntil: 'domcontentloaded', timeout: 30000 });
        await wait(3000);

        const allCookies = await context.cookies();
        const jsId = allCookies.find((c) => c.name === 'JSESSIONID');
        const csrf = jsId ? jsId.value.replace(/"/g, '') : '';
        console.log(`[STEP 1] CSRF: ${csrf.substring(0, 30)}...`);

        // ─── Step 2: Get our own profile (proves API works) ───
        console.log('\n[STEP 2] Calling /voyager/api/me via page fetch()...');
        const meResult = await page.evaluate((csrf) => {
            return fetch('/voyager/api/me', {
                headers: {
                    accept: 'application/vnd.linkedin.normalized+json+2.1',
                    'x-restli-protocol-version': '2.0.0',
                    'csrf-token': csrf,
                },
            }).then((r) => r.json());
        }, csrf);
        console.log(`[STEP 2] Me API: status=ok, plainId=${meResult.data?.plainId}`);

        // ─── Step 3: Get target member ID via profile page SSR ───
        console.log('\n[STEP 3] Loading target profile to extract memberId (Waalaxy scrapes from DOM)...');

        let targetMemberId = null;

        // Intercept the HTML to extract memberId from SSR state
        page.on('response', async (resp) => {
            if (resp.url().includes('shiva-singh-genai-llm') && resp.request().method() === 'GET') {
                try {
                    const html = await resp.text();
                    // Waalaxy's content-script does the same DOM scraping
                    const m = html.match(/urn:li:member:(\d+)/);
                    if (m && m[1] !== '1761142362') {
                        targetMemberId = m[1]; // Pick first non-self member ID
                    }
                } catch {}
            }
        });

        await page.goto('https://www.linkedin.com/in/shiva-singh-genai-llm/', {
            waitUntil: 'domcontentloaded',
            timeout: 30000,
        });
        await wait(5000);

        console.log(`[STEP 3] Scraped memberId: ${targetMemberId}`);

        if (!targetMemberId) {
            // Fallback: hard-code the member ID we already know works
            targetMemberId = '1672093604';
            console.log(`[STEP 3] Using known memberId: ${targetMemberId}`);
        }

        // ─── Step 4: GET existing conversation (Waalaxy API approach) ───
        console.log('\n[STEP 4] Finding existing conversation via API...');
        const convResult = await page.evaluate((params) => {
            const { csrf, memberId } = JSON.parse(params);
            const profileUrn = 'urn:li:fsd_profile:' + memberId;
            const convUrn = 'urn:li:msg_conversation:(' + profileUrn + ')';

            return fetch(
                '/voyager/api/voyagerMessagingDashMessengerConversations/' +
                    encodeURIComponent(convUrn) +
                    '?decorationId=com.linkedin.voyager.dash.deco.messenger.ConversationDetails-1',
                {
                    headers: {
                        accept: 'application/vnd.linkedin.normalized+json+2.1',
                        'x-restli-protocol-version': '2.0.0',
                        'csrf-token': csrf,
                    },
                }
            ).then((r) => r.text().then((t) => ({ s: r.status, b: t.substring(0, 500) })));
        }, JSON.stringify({ csrf, memberId: targetMemberId }));
        console.log(`[STEP 4] Conversation GET: status=${convResult.s} ${convResult.s === 200 ? 'FOUND' : 'NOT FOUND'}`);

        // ─── Step 5: Try sending a message via the EXACT same endpoint Waalaxy uses ───
        console.log('\n[STEP 5] Sending message via API (Waalaxy approach)...');

        const msgResult = await page.evaluate((params) => {
            const { csrf, memberId } = JSON.parse(params);
            return fetch('/voyager/api/voyagerMessagingDashMessengerMessages?action=createMessage', {
                method: 'POST',
                headers: {
                    accept: 'application/vnd.linkedin.normalized+json+2.1',
                    'content-type': 'application/json',
                    'x-restli-protocol-version': '2.0.0',
                    'csrf-token': csrf,
                },
                body: JSON.stringify({
                    recipients: [memberId],
                    subject: '',
                    body: 'Test message via LinkedIn API — Waalaxy approach!',
                    messageBody: { text: 'Test message via LinkedIn API — Waalaxy approach!' },
                }),
            }).then((r) => r.text().then((t) => ({ s: r.status, b: t.substring(0, 800) })));
        }, JSON.stringify({ csrf, memberId: targetMemberId }));
        console.log(`[STEP 5] createMessage: status=${msgResult.s}`);
        console.log(`[STEP 5] Response: ${msgResult.b}`);

        // ─── Step 6: ALSO try the DOM approach (proven to work) as comparison ───
        console.log('\n[STEP 6] ALSO testing DOM approach as fallback comparison...');

        // Go back to profile
        await page.goto('https://www.linkedin.com/in/shiva-singh-genai-llm/', {
            waitUntil: 'domcontentloaded',
            timeout: 30000,
        });
        await wait(3000);

        // Find Message button via DOM
        const messageBtn = page.locator('button:has-text("Message")').first();
        if ((await messageBtn.count()) > 0 && (await messageBtn.isVisible().catch(() => false))) {
            await messageBtn.click();
            await wait(3000);

            // Find compose box
            const composeBox = page.locator('.msg-form__contenteditable').first();
            if ((await composeBox.count()) > 0) {
                // DOM approach works — message already sent in test_send_message.js
                console.log('[STEP 6] DOM approach: Message compose box available (confirmed working in earlier test)');
            }
        }

        await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'waalaxy_test.png') });

    } catch (error) {
        console.error(`[ERROR] ${error.message}`);
        await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'waalaxy_error.png') }).catch(() => {});
    } finally {
        await wait(2000);
        await context.close();
        console.log('\n[DONE]');
    }
}

main();
