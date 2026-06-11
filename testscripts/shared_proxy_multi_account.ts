/**
 * shared_proxy_multi_account.ts
 *
 * Hypothesis test: can multiple LinkedIn accounts share one dedicated ISP IP
 * (sequentially) without triggering LinkedIn security challenges or warnings?
 *
 * This is a STANDALONE test — it does not touch the production DB,
 * session-manager service, or campaign engine. Sessions are persisted to
 * /tmp/test-sessions/ so we can re-launch them later for Test B without
 * polluting prod session storage.
 *
 * Phase A (this run): sequential cold login for accounts 1, 2, 3 through
 *                     dedicated ISP 82.41.252.111:46222. For each:
 *                       - launch-level proxy (sticky invariant)
 *                       - en-IN + Asia/Kolkata (matches engine.ts)
 *                       - fill creds, wait for /feed/ or a challenge
 *                       - classify outcome, screenshot, save storageState
 *
 * Phase B (later run with --reuse): relaunch each saved session, check /feed
 *                                   still loads + no warning banner.
 *
 *   npx ts-node --transpile-only testscripts/shared_proxy_multi_account.ts
 *   npx ts-node --transpile-only testscripts/shared_proxy_multi_account.ts --reuse
 */

import { chromium } from 'playwright-extra';
import * as fs from 'fs';
import * as path from 'path';

const stealth = require('puppeteer-extra-plugin-stealth')();
chromium.use(stealth);

const wait = (ms: number) => new Promise(res => setTimeout(res, ms));

const PROXY = {
    server: 'http://82.41.252.111:46222',
    username: 'xBVyYdUpx84nWx7',
    password: 'dwwTxtvv5a10RXn',
};

interface Account {
    label: string;
    username: string;
    password: string;
}

const ACCOUNTS: Account[] = [
    { label: 'acct1_rajaji', username: 'rajaji98971@gmail.com', password: 'Hue#35op' },
    { label: 'acct2_phone',  username: '7017789793',            password: 'Hue#35op' },
    { label: 'acct3_sneh',   username: 'snehlatasingh9012@gmail.com', password: 'Hehe#35op' },
];

const OUT_DIR = '/tmp/test-sessions';
fs.mkdirSync(OUT_DIR, { recursive: true });

type Outcome =
    | { kind: 'feed'; url: string }
    | { kind: 'challenge'; url: string; type: string }
    | { kind: 'blocked'; url: string; reason: string }
    | { kind: 'error';   message: string };

// Detect what happened after login submit.
// LinkedIn's challenge surface includes /checkpoint/lg/login-submit (2FA-style),
// /checkpoint/challenge/* (captcha / phone verification), and the security
// banner on /feed for "unusual activity". /feed by itself = clean.
async function classifyLanding(page: any): Promise<Outcome> {
    // Give post-submit redirects a moment to settle.
    try {
        await page.waitForLoadState('networkidle', { timeout: 15000 });
    } catch { /* networkidle can time out on LinkedIn, fine */ }

    const url = page.url();

    if (url.includes('/feed')) {
        // Watch for the "unusual sign-in" banner.
        const banner = await page.$('[data-test-id="security-banner"], .checkpoint-public-content').catch(() => null);
        if (banner) return { kind: 'challenge', url, type: 'security_banner_on_feed' };
        return { kind: 'feed', url };
    }
    if (url.includes('/checkpoint/challenge')) {
        return { kind: 'challenge', url, type: 'checkpoint_challenge' };
    }
    if (url.includes('/checkpoint/')) {
        return { kind: 'challenge', url, type: 'checkpoint_other' };
    }
    if (url.includes('/login') || url.includes('/uas/login')) {
        // Still on login page — likely credential rejection.
        const errEl = await page.$('#error-for-username, #error-for-password, .form__label--error').catch(() => null);
        const errText = errEl ? await errEl.textContent().catch(() => '') : '';
        return { kind: 'blocked', url, reason: (errText || 'still_on_login_no_visible_error').trim() };
    }
    return { kind: 'challenge', url, type: 'unknown_landing' };
}

async function coldLogin(acct: Account): Promise<Outcome> {
    console.log(`\n[${acct.label}] === Cold login starting ===`);

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
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36',
        viewport: { width: 1920, height: 1080 },
        locale: 'en-IN',
        timezoneId: 'Asia/Kolkata',
        proxy: PROXY,
    });

    const page = await context.newPage();

    try {
        console.log(`[${acct.label}] Navigating to /login`);
        await page.goto('https://www.linkedin.com/login', { waitUntil: 'domcontentloaded', timeout: 60000 });
        await wait(2000);

        console.log(`[${acct.label}] Filling credentials`);
        // LinkedIn's new (2026) sign-in page uses React-generated IDs and no
        // name attributes. Two duplicate inputs are rendered (one hidden, one
        // visible) — getByLabel auto-resolves to the visible one via
        // Playwright's actionability checks, no explicit wait needed.
        await wait(3000); // give React a beat to mount
        // The visible username input carries autocomplete="username webauthn";
        // the hidden duplicate has only "username". Use the webauthn variant
        // to disambiguate (.first() would silently target the hidden one).
        await page.locator('input[autocomplete="username webauthn"]').fill(acct.username);
        await wait(500 + Math.random() * 800);
        // Password also has a hidden duplicate — use last() (the visible one
        // is rendered after the hidden one in DOM order).
        await page.locator('input[autocomplete="current-password"]').last().fill(acct.password);
        await wait(500 + Math.random() * 800);
        await page.getByRole('button', { name: /^Sign in$/i }).click();

        console.log(`[${acct.label}] Waiting for landing...`);
        await wait(8000);

        const outcome = await classifyLanding(page);
        console.log(`[${acct.label}] Outcome: ${outcome.kind} (${('type' in outcome ? outcome.type : ('reason' in outcome ? outcome.reason : ''))}) url=${('url' in outcome) ? outcome.url : 'n/a'}`);

        // Screenshot for visual inspection regardless of outcome
        const shot = path.join(OUT_DIR, `${acct.label}_landing.png`);
        await page.screenshot({ path: shot, fullPage: false }).catch(() => {});
        console.log(`[${acct.label}] Screenshot: ${shot}`);

        // Save storage state for Phase B even on challenge — we want to see
        // whether the session is recoverable or fully blocked.
        const statePath = path.join(OUT_DIR, `${acct.label}_state.json`);
        await context.storageState({ path: statePath });
        console.log(`[${acct.label}] State saved: ${statePath}`);

        return outcome;
    } catch (err: any) {
        const shot = path.join(OUT_DIR, `${acct.label}_error.png`);
        await page.screenshot({ path: shot, fullPage: false }).catch(() => {});
        console.error(`[${acct.label}] Error: ${err.message}`);
        return { kind: 'error', message: err.message };
    } finally {
        await context.close().catch(() => {});
        await browser.close().catch(() => {});
    }
}

async function reuseSession(acct: Account): Promise<Outcome> {
    console.log(`\n[${acct.label}] === Session reuse starting ===`);

    const statePath = path.join(OUT_DIR, `${acct.label}_state.json`);
    if (!fs.existsSync(statePath)) {
        return { kind: 'error', message: `no saved state at ${statePath}` };
    }

    const browser = await chromium.launch({
        headless: true,
        proxy: PROXY,
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-blink-features=AutomationControlled'],
    });

    const context = await browser.newContext({
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36',
        viewport: { width: 1920, height: 1080 },
        locale: 'en-IN',
        timezoneId: 'Asia/Kolkata',
        proxy: PROXY,
        storageState: statePath,
    });

    const page = await context.newPage();

    try {
        await page.goto('https://www.linkedin.com/feed/', { waitUntil: 'domcontentloaded', timeout: 60000 });
        await wait(5000);
        const outcome = await classifyLanding(page);
        const shot = path.join(OUT_DIR, `${acct.label}_reuse.png`);
        await page.screenshot({ path: shot, fullPage: false }).catch(() => {});
        console.log(`[${acct.label}] Reuse outcome: ${outcome.kind} url=${('url' in outcome) ? outcome.url : 'n/a'}`);
        return outcome;
    } catch (err: any) {
        return { kind: 'error', message: err.message };
    } finally {
        await context.close().catch(() => {});
        await browser.close().catch(() => {});
    }
}

async function main() {
    const reuse = process.argv.includes('--reuse');
    console.log(`\n══════ Shared-proxy multi-account test ══════`);
    console.log(`Proxy: ${PROXY.server}`);
    console.log(`Accounts: ${ACCOUNTS.map(a => a.label).join(', ')}`);
    console.log(`Mode: ${reuse ? 'PHASE B (reuse saved sessions)' : 'PHASE A (cold sequential logins)'}`);
    console.log(`Output dir: ${OUT_DIR}\n`);

    const results: Array<{ acct: string; outcome: Outcome }> = [];

    for (const acct of ACCOUNTS) {
        const outcome = reuse ? await reuseSession(acct) : await coldLogin(acct);
        results.push({ acct: acct.label, outcome });

        // Inter-account gap. We want LinkedIn to see this as three different
        // people on the same residential ISP IP, not a bot rotating accounts.
        if (acct !== ACCOUNTS[ACCOUNTS.length - 1]) {
            const gap = 30000 + Math.floor(Math.random() * 30000);
            console.log(`\n--- Inter-account gap: ${Math.round(gap/1000)}s ---`);
            await wait(gap);
        }
    }

    console.log(`\n══════ RESULTS ══════`);
    for (const r of results) {
        const o = r.outcome;
        const detail = o.kind === 'challenge' ? `(${o.type})`
                     : o.kind === 'blocked'   ? `(${o.reason})`
                     : o.kind === 'error'     ? `(${o.message})`
                     : '';
        const url = 'url' in o ? o.url : '';
        console.log(`  ${r.acct.padEnd(18)} ${o.kind.toUpperCase().padEnd(12)} ${detail} ${url}`);
    }
    console.log('');
    process.exit(0);
}

main().catch(err => { console.error('FATAL:', err); process.exit(1); });
