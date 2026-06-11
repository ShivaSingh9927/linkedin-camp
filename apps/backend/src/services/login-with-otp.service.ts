import { chromium } from 'patchright';
import type { Page } from 'patchright';
import { prisma } from '@repo/db';
import path from 'path';
import fs from 'fs';
import { classifyPage, markAccountHealthy, handleCheckpoint, type CheckpointInfo } from '../campaign-engine/safety/checkpoint';
import { uploadScreenshotToS3 } from './s3-upload.service';

const SCREENSHOT_DIR = process.env.SESSION_STORAGE_PATH || '/app/sessions';

function ensureScreenshotDir() {
    if (!fs.existsSync(SCREENSHOT_DIR)) fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
}

async function saveScreenshot(page: Page, userId: string, label: string) {
    try {
        ensureScreenshotDir();
        const p = path.join(SCREENSHOT_DIR, `${label}_${userId}_${Date.now()}.png`);
        await page.screenshot({ path: p, fullPage: true });
        console.log(`[login-otp] screenshot saved: ${p}`);
    } catch (err: any) {
        console.error(`[login-otp] screenshot failed: ${err.message}`);
    }
    uploadScreenshotToS3(page, userId, label).catch(() => {});
}

// Production port of testscripts/auto_login_with_otp.js. Headless, proxy at
// LAUNCH level (sticky-proxy invariant), pluggable OTP resolver — for the
// recovery API the resolver is Redis-backed (see otp-relay.service.ts).
//
// On success, persists the new session blobs back to the User row and flips
// accountHealth → HEALTHY. Idempotent enough to retry on transient failures.

const wait = (ms: number) => new Promise(res => setTimeout(res, ms));

const MAX_OTP_ATTEMPTS = 3;

export interface ProxyConfig {
    server: string;
    username?: string;
    password?: string;
}

export type OtpResolver = (attempt: number) => Promise<string>;

export interface LoginInput {
    userId: string;
    email: string;
    password: string;
    proxy: ProxyConfig;
    otpResolver: OtpResolver;
    /** UA to use. If omitted, falls back to the canonical Chrome UA. */
    userAgent?: string;
}

export type LoginOutcomeKind =
    | 'success'
    | 'otp_failed'
    | 'still_login'         // creds rejected or LinkedIn forbade the IP
    | 'challenge_other'     // captcha / phone / app — out of scope for auto
    | 'unknown';

export interface LoginOutcome {
    kind: LoginOutcomeKind;
    finalUrl?: string;
    error?: string;
    /** Cookie count on success — useful for sanity-checking persistence. */
    cookieCount?: number;
}

const DEFAULT_UA = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36';

/**
 * Solve the email-OTP challenge with the supplied resolver. Identical logic
 * to the test-script version, with the secondary-challenge fallthrough.
 */
async function solveOtp(page: Page, otpResolver: OtpResolver): Promise<boolean> {
    let prevUrl = page.url();

    for (let attempt = 1; attempt <= MAX_OTP_ATTEMPTS; attempt++) {
        const code = await otpResolver(attempt);
        if (!code || code.length < 4) {
            console.log('[login-otp] empty code — aborting');
            return false;
        }

        const pin = await page.$('#input__email_verification_pin, input[name="pin"]').catch(() => null);
        if (!pin) {
            console.log('[login-otp] no pin input — may have advanced past OTP step');
            return false;
        }
        await pin.fill(code);
        await wait(500);

        const submit = page.getByRole('button', { name: /^Submit$/i }).first();
        if (await submit.count() > 0) await submit.click();
        else await page.click('button[type="submit"]').catch(() => {});

        await wait(6000);
        try { await page.waitForLoadState('networkidle', { timeout: 12000 }); } catch {}

        const info = await classifyPage(page);
        console.log(`[login-otp] post-submit attempt=${attempt} kind=${info.kind} url=${info.url}`);

        if (info.kind === 'feed') return true;

        const errVisible = await page.$('text=/Hmm.*not the right code/i, text=/incorrect/i').catch(() => null);
        if (errVisible && info.url === prevUrl) {
            console.log('[login-otp] code rejected — looping');
            continue;
        }

        if (info.kind === 'otp' && info.url !== prevUrl) {
            console.log('[login-otp] secondary OTP page — looping for next code');
            prevUrl = info.url;
            continue;
        }

        // Non-OTP follow-up — try a primary button if there is one.
        if (info.kind !== 'otp') {
            const candidates = [/Yes.*was me/i, /Confirm/i, /Continue/i, /Done/i];
            for (const re of candidates) {
                const b = page.getByRole('button', { name: re }).first();
                if (await b.count() > 0 && await b.isVisible().catch(() => false)) {
                    console.log(`[login-otp] clicking "${re.source}"`);
                    await b.click().catch(() => {});
                    await wait(6000);
                    const next = await classifyPage(page);
                    if (next.kind === 'feed') return true;
                    break;
                }
            }
            return false;
        }
    }
    return false;
}

export async function loginWithOtp(input: LoginInput): Promise<LoginOutcome> {
    const { userId, email, password, proxy, otpResolver, userAgent } = input;
    console.log(`[login-otp] user=${userId} email=${email} proxy=${proxy.server}`);

    const browser = await chromium.launch({
        headless: false,
        channel: 'chrome',
        proxy,
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-blink-features=AutomationControlled',
            '--start-maximized',
        ],
    });

    const context = await browser.newContext({
        userAgent: userAgent || DEFAULT_UA,
        viewport: null,
        locale: 'en-US',
        timezoneId: 'America/New_York',
        proxy,
    });

    let outcome: LoginOutcome = { kind: 'unknown' };

    try {
        const page = await context.newPage();
        await page.goto('https://www.linkedin.com/login', { waitUntil: 'domcontentloaded', timeout: 60000 });
        await wait(3000);
        await saveScreenshot(page, userId, 'login_page');

        // LinkedIn's 2026 sign-in renders a hidden duplicate of each input;
        // find the visible username input
        const { humanType, humanMoveAndClick } = await import('./stealth.service');
        let emailInput = null;
        for (const c of await page.$$('input[type="email"]')) {
            if (await c.isVisible().catch(() => false)) { emailInput = c; break; }
        }
        if (emailInput) {
            await humanMoveAndClick(page, emailInput);
            await wait(500);
            await humanType(page, emailInput, email);
            await wait(1000);
        }

        let passInput = null;
        for (const c of await page.$$('input[type="password"]')) {
            if (await c.isVisible().catch(() => false)) { passInput = c; break; }
        }
        if (passInput) {
            await humanMoveAndClick(page, passInput);
            await wait(500);
            await humanType(page, passInput, password);
            await wait(1000);
        }

        await humanMoveAndClick(page, page.getByRole('button', { name: /^Sign in$/i }).first());
        await wait(8000);
        try { await page.waitForLoadState('networkidle', { timeout: 12000 }); } catch {}
        await saveScreenshot(page, userId, 'post_submit');

        let info: CheckpointInfo = await classifyPage(page);
        console.log(`[login-otp] post-submit kind=${info.kind} url=${info.url}`);

        if (info.kind === 'otp') {
            await saveScreenshot(page, userId, 'otp_challenge');
            const solved = await solveOtp(page, otpResolver);
            if (!solved) {
                await saveScreenshot(page, userId, 'otp_failed');
                outcome = { kind: 'otp_failed', finalUrl: page.url(), error: 'OTP unresolved' };
                throw new Error('OTP unresolved');
            }
            info = await classifyPage(page);
        }

        if (info.kind !== 'feed') {
            await saveScreenshot(page, userId, `challenge_${info.kind}`);
            outcome = { kind: info.kind as LoginOutcomeKind, finalUrl: info.url, error: `landed on ${info.kind}` };
            throw new Error(`final state ${info.kind}`);
        }

        await saveScreenshot(page, userId, 'login_success');

        // Settle on /feed so all post-login cookies (CSRF, etc.) land.
        await wait(4000);

        const cookies = await context.cookies();
        const livedUa = await page.evaluate(() => navigator.userAgent);
        const lsObj = await page.evaluate(() => {
            const out: Record<string, string> = {};
            for (let i = 0; i < window.localStorage.length; i++) {
                const k = window.localStorage.key(i);
                if (k) out[k] = window.localStorage.getItem(k) || '';
            }
            return out;
        });

        // Persist on User. Mirrors the existing session-manager save shape so
        // engine.ts and session-validator pick the new blobs up unchanged.
        await prisma.user.update({
            where: { id: userId },
            data: {
                linkedinCookie: JSON.stringify(cookies),
                linkedinFingerprint: JSON.stringify({ userAgent: livedUa }),
                linkedinLocalStorage: JSON.stringify(lsObj),
                linkedinProxySnapshot: {
                    server: proxy.server,
                    username: proxy.username,
                    password: proxy.password,
                },
            },
        });

        await markAccountHealthy(userId);

        outcome = { kind: 'success', finalUrl: info.url, cookieCount: cookies.length };
        console.log(`[login-otp] user=${userId} SUCCESS, ${cookies.length} cookies`);
    } catch (err: any) {
        console.error(`[login-otp] user=${userId} failed: ${err.message}`);
        if (outcome.kind === 'unknown') outcome.error = err.message;

        // If the run failed in a known checkpoint state, push the user into
        // the right account-health bucket so the UI shows the right CTA.
        if (outcome.kind && outcome.kind !== 'unknown' && outcome.kind !== 'success') {
            await handleCheckpoint({
                userId,
                info: { kind: outcome.kind as any, url: outcome.finalUrl || '' },
            }).catch(() => {});
        }
    } finally {
        await context.close().catch(() => {});
        await browser.close().catch(() => {});
    }

    return outcome;
}
