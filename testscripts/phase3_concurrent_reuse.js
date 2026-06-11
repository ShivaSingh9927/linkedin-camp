/**
 * phase3_concurrent_reuse.js
 *
 * Concurrent session-reuse test: launch two Chromium browsers SIMULTANEOUSLY
 * through the same dedicated ISP proxy, each replaying a different account's
 * saved session, both navigating to /feed at roughly the same instant.
 *
 * This is the test we explicitly did NOT do in phase 2 — phase 2 was serial.
 * Now we want to know: if two egress packets from the same dispA carry two
 * different LinkedIn session cookies at the same time, does LinkedIn flag
 * either account?
 *
 * Pass = both land on /feed cleanly, no banner.
 * Fail = either gets challenged, kicked to /login, or shows a security banner.
 *
 *   node testscripts/phase3_concurrent_reuse.js
 */

const { chromium } = require('playwright-extra');
const stealth = require('puppeteer-extra-plugin-stealth')();
const path = require('path');
const fs = require('fs');

chromium.use(stealth);

const wait = (ms) => new Promise(res => setTimeout(res, ms));

const PROXY = {
    server: 'http://82.41.252.111:46222',
    username: 'xBVyYdUpx84nWx7',
    password: 'dwwTxtvv5a10RXn',
};

const SESSIONS_DIR = path.join(__dirname, 'sessions');
const SHOT_DIR = '/tmp/test-sessions';
fs.mkdirSync(SHOT_DIR, { recursive: true });

const ACCOUNTS = ['raja', 'snehlata'];

// Barrier: both browsers wait at this gate, then everyone navigates to /feed
// at the same wall-clock instant. Without it, the second launch lags ~1–2s
// behind the first and we wouldn't really be testing concurrency.
function makeBarrier(n) {
    let resolveAll;
    const ready = new Promise(r => { resolveAll = r; });
    let arrived = 0;
    return {
        async wait() {
            arrived++;
            if (arrived === n) resolveAll();
            await ready;
        }
    };
}

async function runOne(label, barrier) {
    const dir = path.join(SESSIONS_DIR, label);
    const cookies = JSON.parse(fs.readFileSync(path.join(dir, 'cookies.json'), 'utf8'));
    const fp = JSON.parse(fs.readFileSync(path.join(dir, 'fingerprint.json'), 'utf8'));
    const lsData = fs.readFileSync(path.join(dir, 'localStorage.json'), 'utf8');

    const browser = await chromium.launch({
        headless: true,
        proxy: PROXY,
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-blink-features=AutomationControlled'],
    });

    const context = await browser.newContext({
        userAgent: fp.userAgent,
        viewport: { width: 1920, height: 1080 },
        locale: 'en-IN',
        timezoneId: 'Asia/Kolkata',
        proxy: PROXY,
    });

    try {
        await context.addCookies(cookies);
        await context.addInitScript((data) => {
            try {
                const parsed = JSON.parse(data);
                for (const [k, v] of Object.entries(parsed)) {
                    window.localStorage.setItem(k, v);
                }
            } catch {}
        }, lsData);

        const page = await context.newPage();

        console.log(`[${label}] ready at barrier, waiting for partner...`);
        const t0 = Date.now();
        await barrier.wait();
        console.log(`[${label}] barrier released at +${Date.now() - t0}ms — navigating to /feed`);

        const navStart = Date.now();
        await page.goto('https://www.linkedin.com/feed/', { waitUntil: 'domcontentloaded', timeout: 60000 });
        const navEnd = Date.now();
        await wait(5000);
        try { await page.waitForLoadState('networkidle', { timeout: 12000 }); } catch {}

        const finalUrl = page.url();
        const shot = path.join(SHOT_DIR, `phase3_${label}.png`);
        await page.screenshot({ path: shot, fullPage: false }).catch(() => {});

        let verdict;
        if (finalUrl.includes('/feed')) {
            const banner = await page.$('[data-test-id="security-banner"], .checkpoint-public-content, [data-test-id="login-challenge"]').catch(() => null);
            verdict = banner ? '⚠  FEED+BANNER' : '✅ FEED';
        } else if (finalUrl.includes('/checkpoint/challenge')) verdict = '❌ CHALLENGE';
        else if (finalUrl.includes('/login'))                   verdict = '❌ KICKED to /login';
        else if (finalUrl.includes('/checkpoint/'))             verdict = '⚠  OTHER CHECKPOINT';
        else                                                    verdict = `? ${finalUrl}`;

        console.log(`[${label}] ${verdict} — nav took ${navEnd - navStart}ms, url=${finalUrl}`);
        return { label, verdict, finalUrl, shot, navMs: navEnd - navStart };
    } catch (err) {
        return { label, verdict: 'ERROR', reason: err.message };
    } finally {
        await context.close().catch(() => {});
        await browser.close().catch(() => {});
    }
}

async function main() {
    console.log(`\n══════ Phase 3 — CONCURRENT session-reuse on shared dispA ══════`);
    console.log(`Proxy: ${PROXY.server}`);
    console.log(`Accounts (parallel): ${ACCOUNTS.join(', ')}\n`);

    const barrier = makeBarrier(ACCOUNTS.length);
    const results = await Promise.all(ACCOUNTS.map(label => runOne(label, barrier)));

    console.log(`\n══════ RESULTS ══════`);
    for (const r of results) {
        const tail = r.reason ? `(${r.reason})` : (r.navMs ? `[nav=${r.navMs}ms]` : '');
        console.log(`  ${r.label.padEnd(18)} ${r.verdict.padEnd(20)} ${tail}`);
    }
    console.log('');
}

main().catch(err => { console.error('FATAL:', err); process.exit(1); });
