/**
 * auto_login_with_otp.js
 *
 * Headless LinkedIn login that handles the OTP challenge: when LinkedIn
 * shows the "Let's do a quick verification" page, we prompt the operator on
 * stdin for the code (which arrives in their email), type it into the page,
 * and resume. Saves cookies + UA + localStorage to testscripts/sessions/<label>/.
 *
 * Routes through the dedicated ISP at LAUNCH level (sticky-proxy invariant).
 *
 * This is the production primitive. The CLI version asks for the OTP via
 * stdin; the eventual server-side version will pass a different `otpResolver`
 * (e.g. a Promise that resolves when the web UI POSTs the code over WS).
 *
 *   ACCOUNT_LABEL=rajaa LOGIN_EMAIL=rajaa80356@gmail.com LOGIN_PASSWORD='dark#155op' \
 *     node testscripts/auto_login_with_otp.js
 */

const { chromium } = require('playwright-extra');
const stealth = require('puppeteer-extra-plugin-stealth')();
const path = require('path');
const fs = require('fs');
const readline = require('readline');

chromium.use(stealth);

const wait = (ms) => new Promise(res => setTimeout(res, ms));

const PROXY = {
    server: 'http://82.41.252.111:46222',
    username: 'xBVyYdUpx84nWx7',
    password: 'dwwTxtvv5a10RXn',
};

const MAX_OTP_ATTEMPTS = 3;

/** CLI implementation of the OTP resolver. Production will swap this. */
function cliOtpResolver(attemptNumber) {
    return new Promise(resolve => {
        const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
        const prompt = attemptNumber === 1
            ? '\n📧 LinkedIn sent a verification code to your email. Enter the 6-digit code: '
            : `\n⚠  Code rejected. Try again (attempt ${attemptNumber}/${MAX_OTP_ATTEMPTS}): `;
        rl.question(prompt, code => {
            rl.close();
            resolve(code.trim());
        });
    });
}

/**
 * File-based OTP resolver. Polls a path every 2s until something writes a code
 * to it, then reads + deletes the file. Used when the script runs in
 * background (or in CI / from another process) and someone else is providing
 * the OTP. This is also the closest analogue to the production design — the
 * web UI POSTs the code and the worker reads it from a shared store.
 */
function fileOtpResolver(filePath) {
    return async (attemptNumber) => {
        const banner = attemptNumber === 1
            ? `\n📧 Waiting for OTP at ${filePath} (write the code with: echo <code> > ${filePath})`
            : `\n⚠  Code rejected (attempt ${attemptNumber}/${MAX_OTP_ATTEMPTS}) — waiting for a new code at ${filePath}`;
        console.log(banner);
        // Make sure stale leftovers don't get picked up as "the answer".
        try { fs.unlinkSync(filePath); } catch {}
        while (true) {
            await wait(2000);
            try {
                const raw = fs.readFileSync(filePath, 'utf8').trim();
                if (raw.length >= 4) {
                    fs.unlinkSync(filePath);
                    console.log(`   (received code from file)`);
                    return raw;
                }
            } catch {}
        }
    };
}

/**
 * Classify what page the browser landed on after a navigation/submit.
 * Returns one of: 'feed' | 'otp' | 'challenge_other' | 'still_login' | 'unknown'.
 */
async function classifyLanding(page) {
    // Brief settle — post-submit redirects often take 2-3 networkidles.
    try { await page.waitForLoadState('networkidle', { timeout: 12000 }); } catch {}
    const url = page.url();

    if (url.includes('/feed')) return { kind: 'feed', url };

    // OTP page has the email-pin input. We don't rely on URL alone because
    // /checkpoint/challenge covers multiple challenge types (captcha, phone,
    // app-prompt, etc.) — only the email-pin variant is auto-resolvable.
    if (url.includes('/checkpoint/challenge') || url.includes('/checkpoint/')) {
        const pinInput = await page.$('#input__email_verification_pin, input[name="pin"]').catch(() => null);
        if (pinInput) return { kind: 'otp', url };
        return { kind: 'challenge_other', url };
    }

    if (url.includes('/login') || url.includes('/uas/login')) return { kind: 'still_login', url };
    return { kind: 'unknown', url };
}

/**
 * Solve the email-OTP challenge interactively, with retries on rejection.
 * Returns true if cleared.
 *
 * Edge cases this handles, all empirically observed on LinkedIn's challenge
 * surface:
 *   - Code rejected → same URL + visible "Hmm, that's not the right code".
 *     We loop and ask for a new code.
 *   - Code accepted but a secondary verification page appears (different URL,
 *     still has a pin input). We treat this as a fresh OTP round.
 *   - Code accepted and we land on a "Confirm this was you" / similar
 *     click-to-proceed page (no pin input, just a button). We try to find
 *     and click the obvious primary button.
 */
async function solveOtp(page, otpResolver, shotDir, label) {
    let prevUrl = page.url();

    for (let attempt = 1; attempt <= MAX_OTP_ATTEMPTS; attempt++) {
        const code = await otpResolver(attempt);
        if (!code || code.length < 4) {
            console.log('   (empty code — aborting)');
            return false;
        }

        const pinInput = await page.$('#input__email_verification_pin, input[name="pin"]').catch(() => null);
        if (!pinInput) {
            console.log('   (no pin input visible — page may have advanced past the email-OTP step)');
            break;
        }

        await pinInput.fill(code);
        await wait(500);

        const submit = page.getByRole('button', { name: /^Submit$/i }).first();
        if (await submit.count() > 0) await submit.click();
        else await page.click('button[type="submit"]').catch(() => {});

        await wait(6000);

        const landing = await classifyLanding(page);
        const heading = await page.locator('h1, h2').first().textContent({ timeout: 2000 }).catch(() => '');
        console.log(`   [post-submit] kind=${landing.kind} url=${landing.url} h="${(heading || '').trim().slice(0, 60)}"`);
        await page.screenshot({ path: path.join(shotDir, `auto_${label}_after_otp_${attempt}.png`) }).catch(() => {});

        if (landing.kind === 'feed') {
            console.log('   ✅ Landed on /feed');
            return true;
        }

        // Same URL + error toast = wrong code, retry.
        const errVisible = await page.$('text=/Hmm.*not the right code/i, text=/incorrect/i').catch(() => null);
        if (errVisible && landing.url === prevUrl) {
            console.log('   ❌ Code rejected — looping for a new one.');
            continue;
        }

        // URL changed and we still have a pin input → secondary OTP round.
        const secondaryPin = await page.$('#input__email_verification_pin, input[name="pin"]').catch(() => null);
        if (secondaryPin && landing.url !== prevUrl) {
            console.log('   ↻ Secondary verification page with another pin input — looping for the next code.');
            prevUrl = landing.url;
            continue;
        }

        // No pin input — could be "confirm this was you" or "click to continue".
        if (!secondaryPin) {
            console.log('   → No pin input on the new page. Looking for a primary button to click...');
            // Try the most common labels in order of likelihood.
            const candidates = [/Yes.*was me/i, /Confirm/i, /Continue/i, /Done/i, /Skip/i];
            let clicked = false;
            for (const re of candidates) {
                const b = page.getByRole('button', { name: re }).first();
                if (await b.count() > 0 && await b.isVisible().catch(() => false)) {
                    console.log(`   → clicking "${re}"`);
                    await b.click().catch(() => {});
                    clicked = true;
                    break;
                }
            }
            if (clicked) {
                await wait(6000);
                const l2 = await classifyLanding(page);
                if (l2.kind === 'feed') return true;
                console.log(`   Post-click landing: ${l2.kind} (${l2.url})`);
            }
            return false;
        }

        console.log(`   ⚠  Unhandled state: ${landing.kind} (${landing.url}). Aborting.`);
        return false;
    }
    console.log(`   Exhausted ${MAX_OTP_ATTEMPTS} attempts.`);
    return false;
}

async function autoLogin(label, email, password, otpResolver) {
    const outDir = path.join(__dirname, 'sessions', label);
    fs.mkdirSync(outDir, { recursive: true });

    const shotDir = '/tmp/test-sessions';
    fs.mkdirSync(shotDir, { recursive: true });

    console.log(`\n[AUTO-LOGIN / ${label}]`);
    console.log(`  email:   ${email}`);
    console.log(`  proxy:   ${PROXY.server} (launch+context)`);
    console.log(`  out:     ${outDir}`);

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
    let outcome = 'unknown';

    try {
        console.log('[1] Navigating to /login');
        await page.goto('https://www.linkedin.com/login', { waitUntil: 'domcontentloaded', timeout: 60000 });
        await wait(3000);

        console.log('[2] Filling credentials');
        // Visible inputs disambiguated by autocomplete hints (LinkedIn renders
        // a hidden duplicate of each — see project_shared_proxy_findings for context).
        await page.locator('input[autocomplete="username webauthn"]').fill(email);
        await wait(600 + Math.random() * 600);
        await page.locator('input[autocomplete="current-password"]').last().fill(password);
        await wait(600 + Math.random() * 600);

        console.log('[3] Submitting login');
        await page.getByRole('button', { name: /^Sign in$/i }).click();
        await wait(8000);

        let landing = await classifyLanding(page);
        console.log(`[4] Landed: ${landing.kind} (${landing.url})`);

        if (landing.kind === 'otp') {
            console.log('[5] OTP challenge detected — entering solve loop');
            await page.screenshot({ path: path.join(shotDir, `auto_${label}_otp_page.png`) }).catch(() => {});
            const solved = await solveOtp(page, otpResolver, shotDir, label);
            if (!solved) {
                outcome = 'otp_failed';
                throw new Error('OTP challenge unresolved');
            }
            landing = await classifyLanding(page);
        }

        if (landing.kind !== 'feed') {
            outcome = landing.kind;
            await page.screenshot({ path: path.join(shotDir, `auto_${label}_${landing.kind}.png`) }).catch(() => {});
            throw new Error(`Did not reach /feed — final state: ${landing.kind} (${landing.url})`);
        }

        // Settle on /feed so all post-login cookies (CSRF, etc.) land before snapshot.
        await wait(4000);

        const cookies = await context.cookies();
        fs.writeFileSync(path.join(outDir, 'cookies.json'), JSON.stringify(cookies, null, 2));
        console.log(`[6] ${cookies.length} cookies → cookies.json`);

        const userAgent = await page.evaluate(() => navigator.userAgent);
        fs.writeFileSync(path.join(outDir, 'fingerprint.json'), JSON.stringify({ userAgent }, null, 2));
        console.log(`[7] Fingerprint → fingerprint.json`);

        const localStorageData = await page.evaluate(() => JSON.stringify(window.localStorage));
        fs.writeFileSync(path.join(outDir, 'localStorage.json'), localStorageData);
        console.log(`[8] localStorage → localStorage.json`);

        await page.screenshot({ path: path.join(shotDir, `auto_${label}_feed.png`) }).catch(() => {});

        outcome = 'feed';
        console.log(`\n✅ Session captured for ${label}.\n`);
    } catch (err) {
        console.error(`\n❌ ${err.message}\n`);
    } finally {
        await browser.close().catch(() => {});
    }

    return outcome;
}

async function main() {
    const label = process.env.ACCOUNT_LABEL || 'rajaa';
    const email = process.env.LOGIN_EMAIL;
    const password = process.env.LOGIN_PASSWORD;

    if (!email || !password) {
        console.error('Set LOGIN_EMAIL and LOGIN_PASSWORD env vars.');
        process.exit(1);
    }

    const resolver = process.env.OTP_FILE
        ? fileOtpResolver(process.env.OTP_FILE)
        : cliOtpResolver;
    const outcome = await autoLogin(label, email, password, resolver);
    process.exit(outcome === 'feed' ? 0 : 2);
}

main().catch(err => { console.error('FATAL:', err); process.exit(1); });
