/**
 * test_inspect_waalaxy.js
 *
 * Opens Chrome, goes to app.waalaxy.com, and intercepts ALL network traffic.
 * User can log in and connect LinkedIn. We capture:
 * - All API calls to Waalaxy backend
 * - All cookie changes
 * - All LinkedIn-related network activity
 * - localStorage changes
 *
 * Usage: node testscripts/test_inspect_waalaxy.js
 */

const { chromium } = require('patchright');
const path = require('path');
const fs = require('fs');

const OUT_DIR = path.join(__dirname, 'waalaxy_inspection');
fs.mkdirSync(OUT_DIR, { recursive: true });

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

async function main() {
    console.log('========================================');
    console.log('  Waalaxy Inspection Mode');
    console.log('========================================');
    console.log('');
    console.log('Chrome will open on your display.');
    console.log('Please log into Waalaxy and connect LinkedIn.');
    console.log('All network traffic will be captured automatically.');
    console.log('Press Ctrl+C when done or wait for the script to time out.');
    console.log('');

    const browser = await chromium.launch({
        headless: false,
        channel: 'chrome',
        args: ['--no-first-run', '--no-default-browser-check', '--start-maximized'],
    });

    const context = await browser.newContext({
        viewport: null,
        locale: 'en-US',
        timezoneId: 'America/New_York',
    });

    const page = await context.newPage();

    // ─── Network capture ──────────────────────────────────────────────

    const networkLog = [];
    const cookieLog = [];
    const localStorageSnapshots = [];

    // Capture ALL requests
    page.on('request', (req) => {
        const url = req.url();
        if (
            url.includes('waalaxy.com') ||
            url.includes('stargate') ||
            url.includes('otto') ||
            url.includes('linkedin.com/voyager') ||
            url.includes('linkedin.com/checkpoint') ||
            url.includes('linkedin.com/login')
        ) {
            networkLog.push({
                time: new Date().toISOString(),
                type: 'request',
                method: req.method(),
                url: url.substring(0, 200),
                headers: req.headers(),
                postData: req.postData()?.substring(0, 500),
            });
        }
    });

    // Capture ALL responses
    page.on('response', async (resp) => {
        const url = resp.url();
        if (
            url.includes('waalaxy.com') ||
            url.includes('stargate') ||
            url.includes('otto') ||
            url.includes('linkedin.com/voyager') ||
            url.includes('linkedin.com/checkpoint') ||
            url.includes('linkedin.com/login')
        ) {
            try {
                const body = await resp.text();
                networkLog.push({
                    time: new Date().toISOString(),
                    type: 'response',
                    status: resp.status(),
                    url: url.substring(0, 200),
                    headers: resp.headers(),
                    body: body.substring(0, 1000),
                });
            } catch (e) {}
        }

        // Capture set-cookie headers
        const setCookie = resp.headers()['set-cookie'];
        if (setCookie) {
            cookieLog.push({
                time: new Date().toISOString(),
                url: url.substring(0, 100),
                cookies: setCookie,
            });
        }
    });

    // ─── Navigate to Waalaxy ──────────────────────────────────────────

    console.log('[1] Navigating to app.waalaxy.com...');
    await page.goto('https://app.waalaxy.com', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await wait(3000);
    console.log(`[1] URL: ${page.url()}`);

    // Log initial cookies
    const initialCookies = await context.cookies();
    cookieLog.push({
        time: new Date().toISOString(),
        phase: 'initial',
        allCookies: initialCookies.map((c) => ({ domain: c.domain, name: c.name, value: c.value.substring(0, 30) })),
    });

    // Take initial screenshot
    await page.screenshot({ path: path.join(OUT_DIR, '01_waalaxy_landing.png') });
    console.log('[1] Screenshot saved — please log in to Waalaxy');

    // ─── Wait for user to log in and connect LinkedIn ─────────────────

    console.log('');
    console.log('========================================');
    console.log('  👉 Please log into Waalaxy');
    console.log('  👉 Then connect your LinkedIn account');
    console.log('  👉 Navigate around the dashboard');
    console.log('  👉 I am capturing all network traffic');
    console.log('  ⏳ Waiting up to 10 minutes...');
    console.log('========================================');
    console.log('');

    // Monitor cookies every 5 seconds
    let previousCookieCount = initialCookies.length;
    const cookieMonitor = setInterval(async () => {
        try {
            const currentCookies = await context.cookies();
            if (currentCookies.length !== previousCookieCount) {
                console.log(`[COOKIE] Cookie count changed: ${previousCookieCount} → ${currentCookies.length}`);
                const newCookies = currentCookies.filter(
                    (c) => !initialCookies.find((ic) => ic.name === c.name && ic.domain === c.domain)
                );
                if (newCookies.length > 0) {
                    console.log('[COOKIE] New cookies:', newCookies.map((c) => c.name + '@' + c.domain));
                    cookieLog.push({
                        time: new Date().toISOString(),
                        phase: 'update',
                        newCookies: newCookies.map((c) => ({
                            name: c.name,
                            domain: c.domain,
                            value: c.value.substring(0, 30),
                        })),
                    });
                }
            }
            previousCookieCount = currentCookies.length;

            // Snapshot localStorage
            const ls = await page.evaluate(() => {
                const out = {};
                for (let i = 0; i < window.localStorage.length; i++) {
                    const k = window.localStorage.key(i);
                    if (k) out[k] = window.localStorage.getItem(k)?.substring(0, 50);
                }
                return out;
            });
            localStorageSnapshots.push({ time: new Date().toISOString(), data: ls });
        } catch (e) {}
    }, 5000);

    // Monitor page URL changes
    let previousUrl = page.url();
    setInterval(async () => {
        try {
            const currentUrl = page.url();
            if (currentUrl !== previousUrl) {
                console.log(`[NAV] ${previousUrl} → ${currentUrl}`);
                await page.screenshot({ path: path.join(OUT_DIR, 'nav_' + Date.now() + '.png') });
                previousUrl = currentUrl;
            }
        } catch (e) {}
    }, 2000);

    // Wait for user interaction (up to 10 minutes)
    await wait(10 * 60 * 1000);

    // ─── Save everything ──────────────────────────────────────────────

    console.log('\n[Saving results...]');
    clearInterval(cookieMonitor);

    // Save final cookies
    const finalCookies = await context.cookies();
    fs.writeFileSync(
        path.join(OUT_DIR, 'cookies.json'),
        JSON.stringify(
            finalCookies.map((c) => ({ name: c.name, domain: c.domain, value: c.value.substring(0, 40), httpOnly: c.httpOnly, secure: c.secure, sameSite: c.sameSite })),
            null,
            2
        )
    );

    // Save network log
    fs.writeFileSync(path.join(OUT_DIR, 'network_log.json'), JSON.stringify(networkLog, null, 2));

    // Save cookie log
    fs.writeFileSync(path.join(OUT_DIR, 'cookie_log.json'), JSON.stringify(cookieLog, null, 2));

    // Save localStorage snapshots
    fs.writeFileSync(path.join(OUT_DIR, 'localstorage_snapshots.json'), JSON.stringify(localStorageSnapshots, null, 2));

    console.log(`✅ Results saved to ${OUT_DIR}/`);
    console.log(`   network_log.json (${networkLog.length} entries)`);
    console.log(`   cookie_log.json (${cookieLog.length} entries)`);
    console.log(`   cookies.json (${finalCookies.length} cookies)`);
    console.log(`   localstorage_snapshots.json (${localStorageSnapshots.length} snapshots)`);

    await context.close();
}

main().catch(console.error);
