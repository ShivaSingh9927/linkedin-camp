/**
 * phase2_cookie_reuse.js
 *
 * Replay test: for each account in testscripts/sessions/, launch Chromium
 * through the dedicated ISP, inject the saved cookies + UA + localStorage,
 * navigate to /feed, and report whether the session held.
 *
 * Runs all accounts SEQUENTIALLY through the same proxy with an inter-account
 * gap so two browsers never share the egress IP at the same time (matches the
 * "shared proxy = serial queue" model we're testing).
 *
 *   node testscripts/phase2_cookie_reuse.js
 *
 * Optional:
 *   ACCOUNT_LABELS=raja,snehlata  node testscripts/phase2_cookie_reuse.js
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

function discoverAccounts() {
    if (process.env.ACCOUNT_LABELS) {
        return process.env.ACCOUNT_LABELS.split(',').map(s => s.trim()).filter(Boolean);
    }
    if (!fs.existsSync(SESSIONS_DIR)) return [];
    return fs.readdirSync(SESSIONS_DIR).filter(name => {
        const d = path.join(SESSIONS_DIR, name);
        return fs.statSync(d).isDirectory()
            && fs.existsSync(path.join(d, 'cookies.json'));
    });
}

async function reuseOne(label) {
    const dir = path.join(SESSIONS_DIR, label);
    const cookiesPath  = path.join(dir, 'cookies.json');
    const fpPath       = path.join(dir, 'fingerprint.json');
    const lsPath       = path.join(dir, 'localStorage.json');

    if (!fs.existsSync(cookiesPath)) {
        return { label, ok: false, reason: `missing ${cookiesPath}` };
    }

    const cookies = JSON.parse(fs.readFileSync(cookiesPath, 'utf8'));
    const fp = fs.existsSync(fpPath) ? JSON.parse(fs.readFileSync(fpPath, 'utf8')) : {};
    const localStorageData = fs.existsSync(lsPath) ? fs.readFileSync(lsPath, 'utf8') : '{}';

    console.log(`\n[${label}] === Reusing session ===`);
    console.log(`[${label}] cookies=${cookies.length}, ua="${(fp.userAgent || '').slice(0, 40)}..."`);

    const browser = await chromium.launch({
        headless: true,
        proxy: PROXY,
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-blink-features=AutomationControlled',
        ],
    });

    const context = await browser.newContext({
        userAgent: fp.userAgent || 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36',
        viewport: { width: 1920, height: 1080 },
        locale: 'en-IN',
        timezoneId: 'Asia/Kolkata',
        proxy: PROXY,
    });

    try {
        // Inject cookies BEFORE creating the page (matches engine.ts pattern).
        await context.addCookies(cookies);
        const verifyCookies = await context.cookies();
        console.log(`[${label}] Injected ${cookies.length} cookies, verified ${verifyCookies.length} present`);

        // localStorage has to be re-hydrated via initScript since it's
        // origin-scoped and can't be pre-populated like cookies.
        await context.addInitScript((data) => {
            try {
                const parsed = JSON.parse(data);
                for (const [k, v] of Object.entries(parsed)) {
                    window.localStorage.setItem(k, v);
                }
            } catch {}
        }, localStorageData);

        const page = await context.newPage();
        await page.goto('https://www.linkedin.com/feed/', { waitUntil: 'domcontentloaded', timeout: 60000 });
        await wait(6000);
        try { await page.waitForLoadState('networkidle', { timeout: 12000 }); } catch {}

        const finalUrl = page.url();
        const shot = path.join(SHOT_DIR, `phase2_${label}.png`);
        await page.screenshot({ path: shot, fullPage: false }).catch(() => {});

        let verdict;
        if (finalUrl.includes('/feed')) {
            // also check for a security banner overlay
            const banner = await page.$('[data-test-id="security-banner"], .checkpoint-public-content').catch(() => null);
            verdict = banner ? '⚠  FEED+BANNER' : '✅ FEED';
        } else if (finalUrl.includes('/checkpoint/challenge')) {
            verdict = '❌ CHALLENGE';
        } else if (finalUrl.includes('/login')) {
            verdict = '❌ KICKED to /login — session expired/rejected';
        } else if (finalUrl.includes('/checkpoint/')) {
            verdict = '⚠  OTHER CHECKPOINT';
        } else {
            verdict = `? ${finalUrl}`;
        }

        console.log(`[${label}] ${verdict}`);
        console.log(`[${label}] URL: ${finalUrl}`);
        console.log(`[${label}] Screenshot: ${shot}`);

        return { label, ok: verdict.startsWith('✅'), verdict, finalUrl, shot };
    } catch (err) {
        console.error(`[${label}] ERROR: ${err.message}`);
        return { label, ok: false, reason: err.message };
    } finally {
        await context.close().catch(() => {});
        await browser.close().catch(() => {});
    }
}

async function main() {
    const accounts = discoverAccounts();
    if (!accounts.length) {
        console.error(`No accounts found in ${SESSIONS_DIR}. Run phase1_cookie_login.js first.`);
        process.exit(1);
    }

    console.log(`\n══════ Phase 2 — session-reuse on shared dispA ══════`);
    console.log(`Proxy: ${PROXY.server}`);
    console.log(`Accounts (sequential): ${accounts.join(', ')}\n`);

    const results = [];
    for (const label of accounts) {
        const r = await reuseOne(label);
        results.push(r);
        if (label !== accounts[accounts.length - 1]) {
            const gap = 20000 + Math.floor(Math.random() * 20000);
            console.log(`\n--- Inter-account gap: ${Math.round(gap/1000)}s ---`);
            await wait(gap);
        }
    }

    console.log(`\n══════ RESULTS ══════`);
    for (const r of results) {
        const v = r.verdict || (r.reason ? `ERROR (${r.reason})` : '?');
        console.log(`  ${r.label.padEnd(18)} ${v}`);
    }
    console.log('');
}

main().catch(err => { console.error('FATAL:', err); process.exit(1); });
