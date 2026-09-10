import { chromium } from 'patchright';
import type { BrowserContext, Page, Cookie } from 'patchright';
import { prisma } from '@repo/db';
import path from 'path';
import fs from 'fs';
import { io } from '../socket';
import { captureEvent } from './analytics.service';
import { uploadScreenshotToS3 } from './s3-upload.service';
import { markAccountHealthy } from '../campaign-engine/safety/checkpoint';
import { scopeToLinkedIn, purgeNonLinkedInCookies } from './cookie-scope';

const SESSION_STORAGE_PATH = process.env.SESSION_STORAGE_PATH || path.join(process.cwd(), 'sessions');

export type LoginStatus = 'IDLE' | 'LAUNCHING' | 'NAVIGATING' | 'AWAITING_CREDENTIALS' | 'SUBMITTING' | 'AWAITING_2FA' | 'AWAITING_APPROVAL' | 'VERIFYING_2FA' | 'CAPTCHA_REQUIRED' | 'SUCCESS' | 'FAILED';

export interface ActiveLoginSession {
    userId: string;
    context: BrowserContext;
    page: Page;
    status: LoginStatus;
    lastActivity: number;
    // The exact proxy this login is being captured behind. Persisted to
    // User.linkedinProxySnapshot on success so every later automation step
    // can pin itself to the same exit IP. LinkedIn invalidates a session
    // the moment it sees the cookies arrive from a different IP.
    proxy?: { server: string; username?: string; password?: string };
    // Live CDP screencast for interactive login (see startInteractive). Held
    // so input dispatch and teardown can reach the same session.
    cdp?: any;
    interactive?: boolean;
    // The page currently being streamed. Differs from `page` while an SSO
    // pop-up (Google/Apple sign-in) is open and has the user's attention.
    streamPage?: Page;
    // Chrome owns the final FedCM account/consent dialog, so it is not part of
    // any Page screenshot. A dialog can belong to the LinkedIn opener OR the
    // Google popup, so keep one observer per page.
    fedCmCdps?: Map<Page, any>;
    // Only reload a contentless Google handoff once per login attempt.
    ssoRecoveryAttempted?: boolean;
    lastFrameAt?: number;
    keyframeTimer?: NodeJS.Timeout;
    // Consecutive probes showing the streamed pop-up has no content.
    blankTicks?: number;
}

/**
 * Input events relayed from the browser-side viewer. Deliberately a narrow
 * shape: this is user-controlled data that ends up driving a real browser, so
 * only these fields are read and everything else is ignored.
 */
export interface InteractiveInputEvent {
    kind: 'mouse' | 'key' | 'text' | 'wheel';
    type?: string;      // mousePressed | mouseReleased | mouseMoved | keyDown | keyUp
    x?: number;
    y?: number;
    button?: 'left' | 'right' | 'middle' | 'none';
    clickCount?: number;
    deltaX?: number;
    deltaY?: number;
    key?: string;
    code?: string;
    text?: string;
    windowsVirtualKeyCode?: number;
    modifiers?: number;
}

class SessionManagerService {
    private activeSessions: Map<string, ActiveLoginSession> = new Map();

    constructor() {
        setInterval(() => this.cleanupStaleSessions(), 5 * 60 * 1000);
    }

    private emitStatus(userId: string, status: LoginStatus, data?: any) {
        if (io) {
            io.to(`user_${userId}`).emit('SESSION_LOGIN_STATUS', { status, ...data });
        }
    }

    private async cleanupStaleSessions() {
        const now = Date.now();
        for (const [userId, session] of this.activeSessions.entries()) {
            if (now - session.lastActivity > 10 * 60 * 1000) {
                console.log(`[SESSION-MANAGER] Session expired for user ${userId}`);
                this.stopKeyframeWatchdog(session);
                await session.context.close().catch(() => {});
                this.activeSessions.delete(userId);
                this.emitStatus(userId, 'FAILED', { error: 'Session timed out' });
            }
        }
    }

    private getUserSessionPath(userId: string): string {
        return path.join(SESSION_STORAGE_PATH, userId);
    }

    async startLogin(userId: string): Promise<{ success: boolean; error?: string }> {
        if (this.activeSessions.has(userId)) {
            const existing = this.activeSessions.get(userId)!;
            this.stopKeyframeWatchdog(existing);
            await existing.context.close().catch(() => {});
            this.activeSessions.delete(userId);
        }

        console.log(`[SESSION-MANAGER] Initiating MANUAL login for ${userId}`);
        this.emitStatus(userId, 'AWAITING_CREDENTIALS', { 
            message: 'Manual login required. Please log in to LinkedIn yourself.' 
        });

        const sessionPath = this.getUserSessionPath(userId);
        if (!fs.existsSync(sessionPath)) {
            fs.mkdirSync(sessionPath, { recursive: true });
        }

        // Clean existing session files
        const oldFiles = ['cookies.json', 'localStorage.json', 'fingerprint.json'];
        oldFiles.forEach(f => {
            const fp = path.join(sessionPath, f);
            if (fs.existsSync(fp)) fs.unlinkSync(fp);
        });

        // NOTE: we deliberately do NOT clear `sessionInvalid` here.
        //
        // This used to optimistically set `sessionInvalid: false` at the START of
        // the login — before a single credential had been submitted. Open the
        // Connect modal and abandon it, and the DB then claimed a working session
        // while `accountHealth` still said SESSION_EXPIRED. Those two flags
        // disagreeing is the same divergence that caused the campaign re-run loop
        // (bug #5), and it made the 4am inbox sweep — which filters on
        // `sessionInvalid: false` — drive a dead account into an authwall nightly.
        //
        // Both success paths (the inline credential login and handleSuccess)
        // already clear the flag once cookies are actually captured, which is the
        // only point at which it's true.

        const launchOptions: any = {
            headless: false,
            channel: 'chrome',
            args: [
                '--disable-blink-features=AutomationControlled',
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--start-maximized',
            ],
            viewport: null,
            userAgent: 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36'
        };

        // Sticky proxy per LinkedIn account: same exit IP for login + every campaign run
        try {
            const { getOrAssignProxy } = await import('./proxy.service');
            const proxy = await getOrAssignProxy(userId);
            if (proxy) {
                launchOptions.proxy = {
                    server: `http://${proxy.proxyHost}:${proxy.proxyPort}`,
                    username: proxy.proxyUsername || undefined,
                    password: proxy.proxyPassword || undefined,
                };
                console.log(`[SESSION-MANAGER] Using sticky proxy ${proxy.proxyHost}:${proxy.proxyPort} (${proxy.proxyCountry}) for user ${userId}`);
            } else if (process.env.DEFAULT_PROXY_SERVER && process.env.DEFAULT_PROXY_PORT) {
                launchOptions.proxy = {
                    server: `http://${process.env.DEFAULT_PROXY_SERVER}:${process.env.DEFAULT_PROXY_PORT}`,
                    username: process.env.DEFAULT_PROXY_USERNAME || undefined,
                    password: process.env.DEFAULT_PROXY_PASSWORD || undefined
                };
                console.log(`[SESSION-MANAGER] No proxy assigned — using DEFAULT_PROXY fallback ${process.env.DEFAULT_PROXY_SERVER}:${process.env.DEFAULT_PROXY_PORT}`);
            }
        } catch (err: any) {
            console.error(`[SESSION-MANAGER] Failed to load proxy for ${userId}: ${err.message}`);
        }

        const contextOptions: any = {
            userAgent: launchOptions.userAgent,
            viewport: null,
            locale: 'en-US',
            timezoneId: 'America/New_York'
        };

        try {
            const context = await chromium.launchPersistentContext(sessionPath, {
                ...launchOptions,
                ...contextOptions,
            } as any);

            const page = context.pages()[0] || await context.newPage();

            this.activeSessions.set(userId, {
                userId,
                context,
                page,
                status: 'NAVIGATING',
                lastActivity: Date.now(),
                proxy: launchOptions.proxy,
            });

            this.emitStatus(userId, 'NAVIGATING', { message: 'Navigating to LinkedIn...' });
            
            // Clear cookies first to avoid stale session issues
            await context.clearCookies();
            console.log(`[SESSION-MANAGER] Cleared stale cookies`);
            
            await page.goto('https://www.linkedin.com/login', { waitUntil: 'load', timeout: 120000 });

            console.log(`[SESSION-MANAGER] Arrived at: ${page.url()}`);
            
            // Take a screenshot for debugging
            try {
                await page.screenshot({ path: path.join(SESSION_STORAGE_PATH, `login_debug_${userId}.png`) });
                console.log(`[SESSION-MANAGER] Screenshot saved for debugging`);
            } catch {}
            uploadScreenshotToS3(page, userId, 'login_debug').catch(() => {});

            if (page.url().includes('/feed') || page.url().includes('/in/')) {
                console.log(`[SESSION-MANAGER] User already logged in, capturing session`);
                return this.handleSuccess(userId);
            }

            const session = this.activeSessions.get(userId)!;
            session.status = 'AWAITING_CREDENTIALS';
            this.emitStatus(userId, 'AWAITING_CREDENTIALS', { message: 'Ready for credentials' });

            return { success: true };
        } catch (error: any) {
            console.error(`[SESSION-MANAGER] Failed to launch browser: ${error.message}`);
            this.emitStatus(userId, 'FAILED', { error: 'Failed to launch browser' });
            return { success: false, error: error.message };
        }
    }

    async submitCredentials(userId: string, email: string, password: string): Promise<{ requires2FA?: boolean; error?: string }> {
        const session = this.activeSessions.get(userId);
        if (!session) {
            return { error: 'No active login session. Call startLogin first.' };
        }

        const { page, context } = session;
        const sessionPath = this.getUserSessionPath(userId);
        let checkpointDetected = false;

        try {
            const usernameSelectors = ['#username', 'input[name="session_key"]', 'input[autocomplete="username"]', 'input[type="email"]'];
            const passwordSelectors = ['#password', 'input[name="session_password"]', 'input[autocomplete="current-password"]', 'input[type="password"]'];

            let usernameInput = null;
            for (const sel of usernameSelectors) {
                await page.waitForSelector(sel, { state: 'visible', timeout: 8000 }).catch(() => null);
                const candidates = await page.$$(sel);
                for (const c of candidates) {
                    if (await c.isVisible().catch(() => false)) {
                        usernameInput = c;
                        break;
                    }
                }
                if (usernameInput) {
                    console.log(`[SESSION-MANAGER] Found visible username field via: ${sel}`);
                    break;
                }
            }

            if (usernameInput) {
                console.log(`[SESSION-MANAGER] Typing email (human-like)...`);
                const { humanType, humanMoveAndClick } = await import('./stealth.service');
                await humanMoveAndClick(page, usernameInput);
                await page.waitForTimeout(500);
                await humanType(page, usernameInput, email, { simulateTypos: false });
                await page.waitForTimeout(1000);

                // Read the field back. A mismatch here means the value we sent
                // isn't the value LinkedIn will receive (appended-to prefill, a
                // dropped keystroke, an autofill overwrite) — which otherwise
                // surfaces only as an indistinguishable "wrong email or
                // password" much later.
                const typedEmail = await usernameInput.inputValue().catch(() => null);
                if (typedEmail !== null && typedEmail !== email) {
                    console.warn(
                        `[SESSION-MANAGER] ⚠️  Email field mismatch — field holds ${typedEmail.length} chars, ` +
                        `expected ${email.length}. Correcting via fill().`
                    );
                    await usernameInput.fill(email).catch(() => {});
                }

                const continueBtn = await page.$('button[type="submit"]:has-text("Continue")');
                if (continueBtn) {
                    const continueVisible = await continueBtn.isVisible().catch(() => false);
                    if (continueVisible) {
                        console.log(`[SESSION-MANAGER] Clicking Continue (two-step variant)`);
                        await humanMoveAndClick(page, continueBtn);
                        await page.waitForTimeout(2000);
                    } else {
                        console.log(`[SESSION-MANAGER] Continue button hidden, single-page variant — skipping`);
                    }
                }

                let passwordInput = null;
                for (const sel of passwordSelectors) {
                    await page.waitForSelector(sel, { state: 'visible', timeout: 8000 }).catch(() => null);
                    const candidates = await page.$$(sel);
                    for (const c of candidates) {
                        if (await c.isVisible().catch(() => false)) {
                            passwordInput = c;
                            break;
                        }
                    }
                    if (passwordInput) {
                        console.log(`[SESSION-MANAGER] Found visible password field via: ${sel}`);
                        break;
                    }
                }

                if (passwordInput) {
                    console.log(`[SESSION-MANAGER] Typing password (human-like)...`);
                    await humanMoveAndClick(page, passwordInput);
                    await page.waitForTimeout(500);
                    await humanType(page, passwordInput, password, { simulateTypos: false });
                    await page.waitForTimeout(1000);

                    // Same read-back for the password. Compare LENGTH only —
                    // never log the value itself.
                    const typedPass = await passwordInput.inputValue().catch(() => null);
                    if (typedPass !== null && typedPass !== password) {
                        console.warn(
                            `[SESSION-MANAGER] ⚠️  Password field mismatch — field holds ${typedPass.length} chars, ` +
                            `expected ${password.length}. Correcting via fill().`
                        );
                        await passwordInput.fill(password).catch(() => {});
                    }

                    // Try multiple ways to find and click the submit button
                    let clicked = false;
                    const { humanMoveAndClick: hmc } = await import('./stealth.service');
                    const buttonSelectors = [
                        'button[type="submit"]:has-text("Sign in")',
                        'button[aria-label*="Sign in"]',
                        'button.btn__primary--large',
                        'button:has-text("Sign in")',
                    ];
                    for (const sel of buttonSelectors) {
                        const btn = await page.$(sel);
                        if (btn) {
                            const isVisible = await btn.isVisible().catch(() => false);
                            if (isVisible) {
                                console.log(`[SESSION-MANAGER] Clicking submit via: ${sel}`);
                                await hmc(page, btn);
                                clicked = true;
                                break;
                            }
                        }
                    }
                    if (!clicked) {
                        console.log(`[SESSION-MANAGER] No submit button matched; pressing Enter`);
                        await page.keyboard.press('Enter');
                    }

                    // Give the page a moment to react and log where we land
                    await page.waitForTimeout(5000);
                    const postSubmitUrl = page.url();
                    console.log(`[SESSION-MANAGER] Post-submit URL: ${postSubmitUrl}`);

                    // 1) Wrong email/password — LinkedIn renders an inline error and
                    //    does NOT navigate. Detect it now so we fail in ~1s rather
                    //    than spinning the full 120s feed timeout below.
                    const credError = await this.detectCredentialError(page);
                    if (credError && !postSubmitUrl.includes('/feed')) {
                        console.log(`[SESSION-MANAGER] Credential error detected: ${credError}`);
                        uploadScreenshotToS3(page, userId, 'cred_error').catch(() => {});
                        // A LinkedIn account created via "Continue with Google"
                        // (or Apple) has NO password — the credential lives with
                        // the identity provider. LinkedIn still answers a
                        // password attempt with the generic "wrong email or
                        // password", which sends the user hunting for a password
                        // that was never set. We can't tell the two cases apart
                        // from here, so say so and give them the way out.
                        const credErrorWithHint = `${credError} If you created your LinkedIn account with "Continue with Google" or Apple, it has no password yet — set one in LinkedIn under Settings & Privacy → Sign in & security → Change password, then try again.`;
                        this.emitStatus(userId, 'FAILED', { error: credErrorWithHint });
                        await context.close().catch(() => {});
                        this.activeSessions.delete(userId);
                        return {}; // already emitted FAILED — don't let the controller re-emit
                    }

                    // 2) A challenge/checkpoint. Classify it: OTP-code entry vs a
                    //    device push-approval vs an unsolvable CAPTCHA. Treating
                    //    every checkpoint as "enter a code" is what left the
                    //    device-approval flow stuck — there's no code to type.
                    if (postSubmitUrl.includes('/checkpoint/') || await this.hasCodeInput(page)) {
                        try {
                            const ssDir = SESSION_STORAGE_PATH;
                            if (!fs.existsSync(ssDir)) fs.mkdirSync(ssDir, { recursive: true });
                            const ssPath = path.join(ssDir, `checkpoint_${userId}_${Date.now()}.png`);
                            await page.screenshot({ path: ssPath, fullPage: true });
                            console.log(`[SESSION-MANAGER] Checkpoint screenshot saved: ${ssPath}`);
                        } catch {}
                        uploadScreenshotToS3(page, userId, 'checkpoint').catch(() => {});

                        if (await this.hasCodeInput(page)) {
                            console.log(`[SESSION-MANAGER] Checkpoint has a code input — awaiting OTP`);
                            checkpointDetected = true;
                        } else {
                            // No code box. Three possibilities: a solvable visual
                            // captcha (reCAPTCHA/hCaptcha/Arkose), a device push
                            // approval ("tap Yes on your phone"), or an unsolvable
                            // challenge. Try CapSolver first — it self-gates and
                            // only spends a call when it recognizes a captcha.
                            const { tryCapsolver } = await import('./captcha-solver.service');
                            this.emitStatus(userId, 'VERIFYING_2FA', { message: 'Solving LinkedIn security check…' });
                            const solve = await tryCapsolver(page).catch((e: any): import('./captcha-solver.service').SolveResult => {
                                console.error(`[SESSION-MANAGER] CapSolver threw: ${e?.message}`);
                                return { solved: false, reason: 'task_failed' };
                            });

                            if (solve.solved) {
                                // Token injected — submit the challenge and let the
                                // flow fall through to the normal feed-wait below.
                                console.log(`[SESSION-MANAGER] CapSolver solved ${solve.type} — submitting challenge`);
                                const submitSelectors = [
                                    '#email-pin-submit-button',
                                    'button[type="submit"]',
                                    'button:has-text("Submit")',
                                    'button:has-text("Verify")',
                                    'button:has-text("Next")',
                                    'button:has-text("Continue")',
                                ];
                                let submitted = false;
                                for (const sel of submitSelectors) {
                                    const btn = await page.$(sel);
                                    if (btn && await btn.isVisible().catch(() => false)) {
                                        await btn.click().catch(() => {});
                                        submitted = true;
                                        break;
                                    }
                                }
                                if (!submitted) await page.keyboard.press('Enter').catch(() => {});
                                // fall through → waitForURL('**/feed/**') below
                            } else if (solve.reason === 'no_captcha') {
                                // Not a captcha → device push-approval. Poll in the
                                // background and auto-succeed when the user taps Yes.
                                console.log(`[SESSION-MANAGER] No captcha detected — treating as device-approval, polling`);
                                session.status = 'AWAITING_APPROVAL';
                                this.emitStatus(userId, 'AWAITING_APPROVAL', {
                                    message: 'Open your LinkedIn mobile app and tap “Yes, it’s me” to approve this sign-in.'
                                });
                                void this.pollForApproval(userId);
                                return { requires2FA: false };
                            } else {
                                // Captcha present but CapSolver couldn't solve it
                                // (no API key / unsupported / timeout / failure).
                                console.log(`[SESSION-MANAGER] CapSolver could not solve (${solve.reason})`);
                                this.emitStatus(userId, 'CAPTCHA_REQUIRED', {
                                    error: solve.reason === 'no_api_key'
                                        ? 'A LinkedIn security check appeared and the solver isn\'t configured. Please try again shortly.'
                                        : 'Couldn\'t clear LinkedIn\'s security check automatically. Wait a few minutes and try connecting again.'
                                });
                                await context.close().catch(() => {});
                                this.activeSessions.delete(userId);
                                return {}; // already emitted CAPTCHA_REQUIRED — don't let the controller re-emit FAILED
                            }
                        }
                    }
                } else {
                    console.warn(`[SESSION-MANAGER] No password field found after filling email`);
                }
            } else {
                console.warn(`[SESSION-MANAGER] No username field matched any selector — page may be a checkpoint/challenge`);
                try {
                    const ssDir = SESSION_STORAGE_PATH;
                    if (!fs.existsSync(ssDir)) fs.mkdirSync(ssDir, { recursive: true });
                    const ssPath = path.join(ssDir, `no_field_${userId}_${Date.now()}.png`);
                    await page.screenshot({ path: ssPath, fullPage: true });
                    console.log(`[SESSION-MANAGER] No-field screenshot saved: ${ssPath}`);
                } catch {}
                uploadScreenshotToS3(page, userId, 'no_field').catch(() => {});
            }

            // If a checkpoint was detected during login, emit AWAITING_2FA and
            // return early — don't wait for the feed (which will never come).
            if (checkpointDetected) {
                session.status = 'AWAITING_2FA';
                this.emitStatus(userId, 'AWAITING_2FA', { message: 'LinkedIn sent a verification code. Enter it below.' });
                return { requires2FA: true };
            }

            await page.waitForURL('**/feed/**', { timeout: 120000 });
            console.log(`[SESSION-MANAGER] Feed detected!`);

            await page.waitForTimeout(5000);

            const cookies = scopeToLinkedIn(await context.cookies(), 'credential-login');
            await purgeNonLinkedInCookies(context, cookies, 'credential-login');
            fs.writeFileSync(path.join(sessionPath, 'cookies.json'), JSON.stringify(cookies, null, 2));
            console.log(`[SESSION-MANAGER] ${cookies.length} cookies saved`);

            const userAgent = await page.evaluate(() => navigator.userAgent);
            fs.writeFileSync(path.join(sessionPath, 'fingerprint.json'), JSON.stringify({ userAgent }, null, 2));
            console.log(`[SESSION-MANAGER] Fingerprint saved`);

            const localStorageData = await page.evaluate(() => JSON.stringify(window.localStorage));
            fs.writeFileSync(path.join(sessionPath, 'localStorage.json'), localStorageData);
            console.log(`[SESSION-MANAGER] LocalStorage saved`);

            // Capture proxy BEFORE deleting the session below. Engine reads
            // this verbatim and launches its browser through the same IP —
            // anything else and LinkedIn invalidates the cookies on first
            // request.
            const proxySnapshot = session?.proxy ?? null;

            await context.close().catch(() => {});
            this.activeSessions.delete(userId);

            await prisma.user.update({
                where: { id: userId },
                data: {
                    sessionPath,
                    sessionInvalid: false,
                    linkedinCookie: JSON.stringify(cookies),
                    linkedinLocalStorage: localStorageData,
                    linkedinFingerprint: JSON.stringify({ userAgent }),
                    linkedinProxySnapshot: proxySnapshot as any,
                }
            });

            console.log(`[SESSION-MANAGER] Session files saved to ${sessionPath}${proxySnapshot ? ` (proxy pinned: ${proxySnapshot.server})` : ' (NO PROXY — session will likely die on first automation step)'}`);

            // Flip accountHealth back to HEALTHY. Without this a cold re-login
            // left the user at NEEDS_LOGIN / SESSION_EXPIRED, so the engine's
            // pre-flight gate kept refusing to launch and the auto-paused
            // campaign stayed paused — the user had logged back in and nothing
            // resumed. markAccountHealthy also un-parks the leads that were
            // deferred 365 days by handleCheckpoint and resumes the campaigns
            // WE paused (pausedReason='session_expired'); campaigns the user
            // paused by hand are left alone.
            //
            // Ordering matters: this runs AFTER the session blobs are written
            // above, because resuming a campaign can have a worker pick it up
            // immediately — it must not read a half-written session.
            await markAccountHealthy(userId).catch((err: any) =>
                console.error(`[SESSION-MANAGER] markAccountHealthy failed for ${userId}: ${err?.message}`));

            captureEvent(userId, 'linkedin_connected', { method: 'login' });
            this.emitStatus(userId, 'SUCCESS', { sessionPath });

            // Kick off one-time self-profile enrichment so the AI/business profile
            // auto-fills from the user's own LinkedIn (headline, about, tone, etc.).
            // This inline success path is the COMMON credential-login outcome and
            // previously skipped enrichment entirely — only handleSuccess() (the
            // already-logged-in / 2FA paths) enqueued it. Mirror it here so a plain
            // email+password connect also gets enriched.
            try {
                const { enqueueSelfEnrichment } = await import('../workers/enrichment-worker');
                void enqueueSelfEnrichment(userId).catch((err: any) =>
                    console.error('[SESSION-MANAGER] Failed to enqueue self-enrichment:', err?.message)
                );
            } catch (err: any) {
                console.error('[SESSION-MANAGER] Could not load enrichment worker:', err?.message);
            }

            return {};
        } catch (e: any) {
            console.error(`[SESSION-MANAGER] Login failed: ${e.message}`);
            try {
                console.log(`[SESSION-MANAGER] Browser URL at failure: ${page.url()}`);
                await page.screenshot({ path: path.join(SESSION_STORAGE_PATH, `login_error_${userId}.png`), fullPage: true });
                uploadScreenshotToS3(page, userId, 'login_error').catch(() => {});
                const bodyText = await page.evaluate(() => document.body.innerText.slice(0, 1500)).catch(() => '');
                console.log(`[SESSION-MANAGER] Body text snippet: ${bodyText.replace(/\n+/g, ' | ')}`);
            } catch {}
            this.emitStatus(userId, 'FAILED', { error: e.message });
            return { error: e.message };
        }
    }

    // ─── Interactive (remote-controlled) login ──────────────────────────
    //
    // Why this exists: a LinkedIn account created with Google/Apple SSO has no
    // password, and a passkey account can't authenticate to a datacenter
    // browser at all (cross-device passkeys need BLE proximity). Those users
    // cannot complete the credential form no matter what they type.
    //
    // The fix is to let them drive OUR browser: we stream the proxied Chromium
    // to them and relay their clicks and keystrokes back. They sign in however
    // they normally do — SSO, passkey-on-this-device, 2FA, CAPTCHA — and the
    // cookies are minted INSIDE the proxied context, so the sticky-proxy
    // invariant (see launchAuthenticatedContext) holds exactly as it does for
    // the credential path. Nothing is stored on our side but the resulting
    // session, same as before.

    /** JPEG quality/width for streamed frames — legible text without flooding the socket. */
    private static readonly SCREENCAST = { format: 'jpeg' as const, quality: 60, maxWidth: 1280, maxHeight: 800 };

    /**
     * Attach a live view to an already-launched login session and wait, in the
     * background, for the user to reach the feed. Returns as soon as streaming
     * starts; success arrives later over the socket.
     */
    /**
     * Point the live stream at `target`, replacing whatever was streaming.
     * Used both for the initial attach and for following SSO pop-ups.
     */
    private async attachScreencast(userId: string, target: Page): Promise<void> {
        const session = this.activeSessions.get(userId);
        if (!session) return;

        // Tear down the previous stream first — two screencasts feeding one
        // socket would interleave frames from different pages.
        if (session.cdp) {
            try { await session.cdp.send('Page.stopScreencast'); } catch {}
            try { await session.cdp.detach(); } catch {}
            session.cdp = undefined;
        }

        // Chromium only composites the FOREGROUND page. With the opener and an
        // SSO pop-up both alive, whichever one is backgrounded stops painting:
        // screencast emits nothing and screenshots come back blank. That is the
        // white view — a live page we simply weren't allowed to see. Make the
        // page we stream the visible one.
        await target.bringToFront().catch(() => {});

        const cdp = await session.context.newCDPSession(target);
        session.cdp = cdp;
        session.streamPage = target;
        console.log(`[SESSION-MANAGER] Streaming ${target.url().slice(0, 80)} for ${userId}`);

        cdp.on('Page.screencastFrame', (frame: any) => {
            // Ack FIRST: Chromium stops producing frames until the previous
            // one is acknowledged, so a throw here would freeze the stream.
            cdp.send('Page.screencastFrameAck', { sessionId: frame.sessionId }).catch(() => {});
            session.lastActivity = Date.now();
            session.lastFrameAt = Date.now();
            if (io) {
                io.to(`user_${userId}`).emit('INTERACTIVE_FRAME', {
                    data: frame.data, // base64 jpeg
                    metadata: frame.metadata, // deviceWidth/Height for click mapping
                });
            }
        });

        await cdp.send('Page.startScreencast', SessionManagerService.SCREENCAST);

        // Chromium drops the screencast when a page navigates ACROSS PROCESSES.
        // SSO pop-ups always do this: Google opens about:blank, then navigates
        // to accounts.google.com — a cross-origin hop — so the stream we just
        // started dies exactly when the interesting page appears, leaving the
        // blank first frame on screen with no error anywhere. Restart it after
        // each navigation of the page we're streaming.
        const restart = async () => {
            const live = this.activeSessions.get(userId);
            if (!live?.interactive || live.streamPage !== target || target.isClosed()) return;
            try {
                await target.bringToFront().catch(() => {});
                await cdp.send('Page.startScreencast', SessionManagerService.SCREENCAST);
                console.log(`[SESSION-MANAGER] Screencast restarted after navigation → ${target.url().slice(0, 80)}`);
            } catch (e: any) {
                // "already active" just means the stream survived the
                // navigation — the common case, and not worth reporting.
                if (!/already active/i.test(e?.message || '')) {
                    console.log(`[SESSION-MANAGER] Screencast restart failed: ${e.message}`);
                }
            }
        };
        target.on('domcontentloaded', restart);
        target.on('load', restart);

        this.startKeyframeWatchdog(userId);
    }

    /**
     * Complete Chrome's browser-owned FedCM prompts for Google SSO.
     *
     * The interactive viewer streams webpage pixels only. FedCM account and
     * consent dialogs live in Chrome UI, outside those pixels, so a user can
     * successfully finish Google password + 2FA and still be left on
     * accounts.google.com/gsi/select while LinkedIn waits forever. The login
     * context starts with cleared cookies, which means the only account in the
     * chooser is the account the user has just explicitly authenticated.
     */
    private async attachFedCmHandler(userId: string, page: Page): Promise<void> {
        const session = this.activeSessions.get(userId);
        if (!session) return;
        if (!session.fedCmCdps) session.fedCmCdps = new Map();
        if (session.fedCmCdps.has(page)) return;

        try {
            const cdp = await session.context.newCDPSession(page);
            session.fedCmCdps.set(page, cdp);

            cdp.on('FedCm.dialogShown', async (dialog: any) => {
                const live = this.activeSessions.get(userId);
                if (!live?.interactive) return;
                live.lastActivity = Date.now();

                const accounts = Array.isArray(dialog?.accounts) ? dialog.accounts : [];
                console.log(
                    `[SESSION-MANAGER] FedCM dialog for ${userId}: type=${dialog?.dialogType} ` +
                    `accounts=${accounts.length}`
                );

                try {
                    if (dialog?.dialogType === 'AccountChooser') {
                        if (accounts.length !== 1) {
                            // Never guess when Chrome offers more than the one
                            // account the user just authenticated. This should
                            // not happen because startLogin clears cookies.
                            console.error(
                                `[SESSION-MANAGER] FedCM chooser has ${accounts.length} accounts; refusing automatic selection`
                            );
                            this.emitStatus(userId, 'FAILED', {
                                error: 'Google offered multiple accounts in a browser-only dialog. Cancel and retry the connection in a fresh window.',
                            });
                            return;
                        }
                        await cdp.send('FedCm.selectAccount', {
                            dialogId: dialog.dialogId,
                            accountIndex: 0,
                        });
                        console.log(`[SESSION-MANAGER] Selected the newly authenticated FedCM account for ${userId}`);
                    } else if (dialog?.dialogType === 'ConfirmIdpLogin') {
                        await cdp.send('FedCm.clickDialogButton', {
                            dialogId: dialog.dialogId,
                            dialogButton: 'ConfirmIdpLoginContinue',
                        });
                        console.log(`[SESSION-MANAGER] Confirmed FedCM identity-provider login for ${userId}`);
                    } else if (dialog?.dialogType === 'Error') {
                        console.error(`[SESSION-MANAGER] Chrome displayed a FedCM error for ${userId}`);
                    }
                    // AutoReauthn intentionally needs no command; Chrome is
                    // already completing it without a user choice.
                } catch (e: any) {
                    console.error(`[SESSION-MANAGER] FedCM dialog handling failed for ${userId}: ${e?.message}`);
                }
            });

            await cdp.send('FedCm.enable', { disableRejectionDelay: true });
            console.log(
                `[SESSION-MANAGER] FedCM dialog handler enabled for ${userId} on ` +
                `${page === session.page ? 'LinkedIn opener' : 'SSO popup'}`
            );
        } catch (e: any) {
            // Older Chrome builds may not expose the domain. Keep the manual
            // page flow available and make the missing capability diagnosable.
            session.fedCmCdps.delete(page);
            console.error(`[SESSION-MANAGER] Could not enable FedCM handler for ${userId}: ${e?.message}`);
        }
    }

    /**
     * Screencast only emits on repaint, so a page that has finished rendering
     * and then sits still produces nothing. That is fine while the user is
     * looking at a page they already saw — but after switching back from a
     * closed SSO pop-up, the viewer's last frame belongs to the pop-up (or is
     * blank), and without a repaint on the main page it would stay that way
     * indefinitely: a white screen with a perfectly healthy session behind it.
     *
     * So poll for staleness and push a screenshot as a keyframe. Cheap,
     * because it only fires when the stream has genuinely gone quiet.
     */
    private startKeyframeWatchdog(userId: string) {
        const session = this.activeSessions.get(userId);
        if (!session || session.keyframeTimer) return;

        let ticks = 0;
        session.keyframeTimer = setInterval(async () => {
            const live = this.activeSessions.get(userId);
            if (!live?.interactive || !live.streamPage) return;

            // Periodic ground truth about WHAT is on screen. A blank stream is
            // ambiguous from the outside — dead screencast, backgrounded page,
            // or a page that is genuinely white — and guessing between those
            // cost several deploy cycles. Log the page's own view of itself.
            if (++ticks % 2 === 0 && !live.streamPage.isClosed()) {
                try {
                    const info = await live.streamPage.evaluate(() => ({
                        url: location.href,
                        title: document.title,
                        visible: document.visibilityState,
                        bodyChars: document.body?.innerText?.trim().length ?? 0,
                        text: (document.body?.innerText || '').trim().slice(0, 120).replace(/\s+/g, ' '),
                    }));
                    console.log(
                        `[SESSION-MANAGER] stream state ${userId}: url=${info.url.slice(0, 70)} ` +
                        `visible=${info.visible} chars=${info.bodyChars} title="${info.title.slice(0, 40)}" text="${info.text}"`
                    );

                    // A pop-up with no content is Google Identity Services'
                    // handshake step (accounts.google.com/gsi/select and
                    // friends): it has NO UI by design — it postMessages the
                    // result to the opener and closes. Streaming it shows the
                    // user a white rectangle while the page that actually
                    // matters, the LinkedIn opener, sits behind it. Worse,
                    // holding the pop-up in the foreground backgrounds the
                    // opener, and Chromium throttles background pages — which
                    // can stall the very handshake we're waiting on.
                    //
                    // So once a pop-up proves contentless, hand the view back
                    // to the opener.
                    const isPopup = live.streamPage !== live.page;
                    if (isPopup && info.bodyChars === 0) {
                        live.blankTicks = (live.blankTicks || 0) + 1;
                        if (live.blankTicks >= 2 && !live.page.isClosed()) {
                            const isGoogleHandoff = /^https:\/\/accounts\.google\.com\/gsi\/select(?:[/?#]|$)/i.test(info.url);
                            if (isGoogleHandoff && !live.ssoRecoveryAttempted) {
                                // Google password + 2FA have already succeeded
                                // here. Retry the callback document once using
                                // those freshly authenticated cookies.
                                live.ssoRecoveryAttempted = true;
                                live.blankTicks = 0;
                                console.log(`[SESSION-MANAGER] Reloading stalled Google SSO handoff once for ${userId}`);
                                await live.streamPage.reload({
                                    waitUntil: 'domcontentloaded',
                                    timeout: 30000,
                                }).catch((e: any) =>
                                    console.log(`[SESSION-MANAGER] Google SSO handoff reload failed: ${e?.message}`));
                                return;
                            }
                            console.log(
                                `[SESSION-MANAGER] Pop-up has no UI (${info.url.slice(0, 60)}) — returning the view to LinkedIn`
                            );
                            live.blankTicks = 0;
                            await this.attachScreencast(userId, live.page).catch(() => {});
                            return;
                        }
                    } else {
                        live.blankTicks = 0;
                    }
                } catch (e: any) {
                    console.log(`[SESSION-MANAGER] stream state probe failed for ${userId}: ${e?.message}`);
                }
            }

            if (Date.now() - (live.lastFrameAt || 0) < 1500) return; // stream is healthy

            try {
                if (live.streamPage.isClosed()) return;
                // A stalled stream usually means this page lost the foreground
                // (an SSO pop-up took it) and stopped compositing. Reclaim it,
                // otherwise both the screencast AND this screenshot stay blank.
                await live.streamPage.bringToFront().catch(() => {});
                const buf = await live.streamPage.screenshot({ type: 'jpeg', quality: 60 });
                const viewport = live.streamPage.viewportSize() || { width: 1280, height: 800 };
                live.lastFrameAt = Date.now();
                io?.to(`user_${userId}`).emit('INTERACTIVE_FRAME', {
                    data: buf.toString('base64'),
                    metadata: { deviceWidth: viewport.width, deviceHeight: viewport.height },
                });
            } catch (e: any) {
                // Page may be mid-navigation; the next tick will catch it. Log
                // it though — a permanently failing watchdog is the difference
                // between "briefly stale" and "white screen forever", and
                // swallowing it silently already cost one debugging round.
                console.log(`[SESSION-MANAGER] Keyframe capture failed for ${userId}: ${e?.message}`);
            }
        }, 1000);
    }

    private stopKeyframeWatchdog(session: ActiveLoginSession) {
        if (session.keyframeTimer) {
            clearInterval(session.keyframeTimer);
            session.keyframeTimer = undefined;
        }
    }

    /** True while a live interactive stream exists for this user. */
    isInteractive(userId: string): boolean {
        return !!this.activeSessions.get(userId)?.interactive;
    }

    async startInteractive(userId: string): Promise<{ success: boolean; error?: string }> {
        const session = this.activeSessions.get(userId);
        if (!session) {
            return { success: false, error: 'No active login session. Start the login first.' };
        }
        if (session.interactive) {
            return { success: true }; // already streaming — don't stack screencasts
        }

        const { page, context } = session;
        try {
            // Enable before the user clicks "Continue with Google"; FedCM only
            // reports dialogs that appear after the domain is enabled.
            await this.attachFedCmHandler(userId, page);
            await this.attachScreencast(userId, page);
            session.interactive = true;

            // Follow pop-ups. "Continue with Google" is Google Identity
            // Services, which opens sign-in in a NEW WINDOW rather than
            // navigating — a separate Page in this same context. Streaming
            // only the original page made that click look like it did
            // nothing: the Google window was open on the server, invisible to
            // the user. Switch the stream to whatever page opens, and switch
            // back when it closes (SSO pop-ups close themselves on success).
            context.on('page', async (popup: Page) => {
                try {
                    console.log(`[SESSION-MANAGER] Pop-up opened for ${userId} — following it`);
                    // Browser-owned Google UI may be associated with this
                    // popup target rather than the LinkedIn opener.
                    await this.attachFedCmHandler(userId, popup);
                    await popup.waitForLoadState('domcontentloaded').catch(() => {});
                    await this.attachScreencast(userId, popup);

                    popup.once('close', async () => {
                        console.log(`[SESSION-MANAGER] Pop-up closed for ${userId} — back to the main window`);
                        const live = this.activeSessions.get(userId);
                        if (!live?.interactive) return;
                        await this.attachScreencast(userId, live.page).catch(() => {});
                    });
                } catch (err: any) {
                    console.error(`[SESSION-MANAGER] Failed to follow pop-up for ${userId}: ${err.message}`);
                }
            });

            console.log(`[SESSION-MANAGER] Interactive login streaming for ${userId}`);
            this.emitStatus(userId, 'AWAITING_CREDENTIALS', {
                interactive: true,
                message: 'Sign in to LinkedIn in the window below — including "Continue with Google" if that is how you joined.',
            });

            // Watch for completion out-of-band. The user may take minutes
            // (password managers, phone for 2FA), so this window is generous
            // but bounded; cleanupStaleSessions is kept at bay by the frame
            // handler touching lastActivity.
            void page
                .waitForURL('**/feed/**', { timeout: 15 * 60 * 1000 })
                .then(async () => {
                    console.log(`[SESSION-MANAGER] Interactive login reached feed for ${userId}`);
                    await this.stopInteractive(userId);
                    await this.handleSuccess(userId);
                })
                .catch((e: any) => {
                    console.log(`[SESSION-MANAGER] Interactive login did not reach feed for ${userId}: ${e.message}`);
                });

            return { success: true };
        } catch (e: any) {
            console.error(`[SESSION-MANAGER] startInteractive failed for ${userId}: ${e.message}`);
            session.interactive = false;
            return { success: false, error: e.message };
        }
    }

    /**
     * Relay one viewer input into the live browser. Silently no-ops when there
     * is no interactive session — stray events from a stale tab are expected
     * and must not throw.
     */
    async dispatchInput(userId: string, evt: InteractiveInputEvent): Promise<void> {
        const session = this.activeSessions.get(userId);
        if (!session?.cdp || !session.interactive) return;
        session.lastActivity = Date.now();

        try {
            switch (evt.kind) {
                case 'mouse':
                    await session.cdp.send('Input.dispatchMouseEvent', {
                        type: evt.type || 'mouseMoved',
                        x: Math.round(evt.x || 0),
                        y: Math.round(evt.y || 0),
                        button: evt.button || 'none',
                        clickCount: evt.clickCount ?? (evt.type === 'mousePressed' || evt.type === 'mouseReleased' ? 1 : 0),
                        modifiers: evt.modifiers || 0,
                    });
                    break;
                case 'wheel':
                    await session.cdp.send('Input.dispatchMouseEvent', {
                        type: 'mouseWheel',
                        x: Math.round(evt.x || 0),
                        y: Math.round(evt.y || 0),
                        deltaX: evt.deltaX || 0,
                        deltaY: evt.deltaY || 0,
                        modifiers: evt.modifiers || 0,
                    });
                    break;
                case 'key':
                    await session.cdp.send('Input.dispatchKeyEvent', {
                        type: evt.type === 'keyUp' ? 'keyUp' : 'keyDown',
                        key: evt.key,
                        code: evt.code,
                        windowsVirtualKeyCode: evt.windowsVirtualKeyCode,
                        nativeVirtualKeyCode: evt.windowsVirtualKeyCode,
                        text: evt.text,
                        modifiers: evt.modifiers || 0,
                    });
                    break;
                case 'text':
                    // Paste and IME composition arrive as whole strings.
                    if (evt.text) await session.cdp.send('Input.insertText', { text: evt.text });
                    break;
            }
        } catch (e: any) {
            console.log(`[SESSION-MANAGER] dispatchInput (${evt.kind}) failed for ${userId}: ${e.message}`);
        }
    }

    /** Stop streaming but LEAVE the browser open — the caller decides its fate. */
    async stopInteractive(userId: string): Promise<void> {
        const session = this.activeSessions.get(userId);
        if (!session) return;
        this.stopKeyframeWatchdog(session);
        if (!session.cdp) {
            session.interactive = false;
            return;
        }
        try {
            await session.cdp.send('Page.stopScreencast');
        } catch {}
        try {
            await session.cdp.detach();
        } catch {}
        session.cdp = undefined;
        session.streamPage = undefined;
        if (session.fedCmCdps) {
            for (const cdp of session.fedCmCdps.values()) {
                try { await cdp.send('FedCm.disable'); } catch {}
                try { await cdp.detach(); } catch {}
            }
            session.fedCmCdps.clear();
            session.fedCmCdps = undefined;
        }
        session.interactive = false;
        console.log(`[SESSION-MANAGER] Interactive streaming stopped for ${userId}`);
    }

    async submit2FA(userId: string, code: string): Promise<{ success?: boolean; error?: string }> {
        const session = this.activeSessions.get(userId);
        if (!session) {
            return { error: 'Session expired' };
        }

        session.lastActivity = Date.now();
        session.status = 'VERIFYING_2FA';
        this.emitStatus(userId, 'VERIFYING_2FA', { message: 'Verifying security code...' });

        const { page } = session;

        try {
            const input = await page.waitForSelector('input#input-code, input[name="pin"]', { timeout: 10000 }).catch(() => null);
            if (!input) {
                this.emitStatus(userId, 'FAILED', { error: 'Code input not found' });
                return { error: 'Code input not found' };
            }

            await input.fill(code);
            await page.click('#email-pin-submit-button, button[type="submit"]');
            await page.waitForTimeout(10000);

            if (page.url().includes('/feed') || page.url().includes('/in/')) {
                return this.handleSuccess(userId);
            }

            this.emitStatus(userId, 'FAILED', { error: 'Verification failed' });
            return { error: 'Verification failed' };
        } catch (e: any) {
            console.error(`[SESSION-MANAGER] 2FA error: ${e.message}`);
            this.emitStatus(userId, 'FAILED', { error: e.message });
            return { error: e.message };
        }
    }

    private async handleSuccess(userId: string): Promise<{ success: boolean }> {
        const session = this.activeSessions.get(userId)!;
        const { page, context } = session;

        await page.waitForTimeout(3000);

        const cookies = scopeToLinkedIn(await context.cookies(), 'handleSuccess');
        // Interactive login sends the user through Google/Apple SSO in THIS
        // context, so strip the identity-provider session out of the on-disk
        // profile before it is flushed. We only ever needed li_at.
        await purgeNonLinkedInCookies(context, cookies, 'handleSuccess');
        const liAt = cookies.find((c: Cookie) => c.name === 'li_at')?.value;

        const userAgent = await page.evaluate(() => navigator.userAgent);
        const localStorageData = await page.evaluate(() => {
            const data: Record<string, string> = {};
            for (let i = 0; i < window.localStorage.length; i++) {
                const key = window.localStorage.key(i);
                if (key) data[key] = window.localStorage.getItem(key) || '';
            }
            return data;
        });

        const profileData: any = await page.evaluate(() => {
            const nav = document.querySelector('.global-nav__me');
            const nameEl = document.querySelector('.global-nav__me button img[alt]');
            const firstName = (nameEl as HTMLImageElement)?.alt?.split(' ')[0] || '';
            const lastName = (nameEl as HTMLImageElement)?.alt?.split(' ').slice(1).join(' ') || '';
            const avatarUrl = (nameEl as HTMLImageElement)?.src || '';
            return { firstName, lastName, avatarUrl };
        }).catch(() => ({}));

        const sessionPath = this.getUserSessionPath(userId);

        fs.writeFileSync(path.join(sessionPath, 'cookies.json'), JSON.stringify(cookies, null, 2));
        fs.writeFileSync(path.join(sessionPath, 'fingerprint.json'), JSON.stringify({ userAgent }, null, 2));
        fs.writeFileSync(path.join(sessionPath, 'localStorage.json'), JSON.stringify(localStorageData, null, 2));

        console.log(`[SESSION-MANAGER] Saved session for user ${userId}: ${cookies.length} cookies, ${Object.keys(localStorageData).length} localStorage keys`);

        const sessionForProxy = this.activeSessions.get(userId);
        const proxySnapshotForReval = sessionForProxy?.proxy ?? null;

        await prisma.user.update({
            where: { id: userId },
            data: {
                sessionPath: sessionPath,
                sessionValidatedAt: new Date(),
                sessionInvalid: false,
                profileData: profileData.firstName ? JSON.stringify(profileData) : undefined,
                persistentSessionPath: sessionPath,
                lastBrowserActivityAt: new Date(),
                linkedinCookie: JSON.stringify(cookies),
                linkedinLocalStorage: JSON.stringify(localStorageData),
                linkedinFingerprint: JSON.stringify({ userAgent }),
                linkedinProxySnapshot: proxySnapshotForReval as any,
            }
        });

        // Same recovery as the inline credential-login path above — this is the
        // already-logged-in / 2FA-completed / app-approval route, and it needs
        // the health flip just as much. See the comment there for ordering.
        await markAccountHealthy(userId).catch((err: any) =>
            console.error(`[SESSION-MANAGER] markAccountHealthy failed for ${userId}: ${err?.message}`));

        session.status = 'SUCCESS';
        this.emitStatus(userId, 'SUCCESS', { message: 'Successfully connected!', profile: profileData });

        await session.context.close().catch(() => {});
        this.activeSessions.delete(userId);

        // Fire-and-forget: kick off one-time self-profile enrichment. Delayed so
        // the freshly captured session settles; runs on the worker box behind the
        // per-account lock. The job no-ops if the user was already enriched.
        try {
            const { enqueueSelfEnrichment } = await import('../workers/enrichment-worker');
            void enqueueSelfEnrichment(userId).catch((err: any) =>
                console.error('[SESSION-MANAGER] Failed to enqueue self-enrichment:', err?.message)
            );
        } catch (err: any) {
            console.error('[SESSION-MANAGER] Could not load enrichment worker:', err?.message);
        }

        return { success: true };
    }

    // --- Post-submit page classification helpers -------------------------

    // LinkedIn renders a wrong-email / wrong-password error inline on the login
    // page (no navigation). Detect it so we fail in ~1s instead of waiting the
    // full 120s feed timeout. Returns the human-readable error text, or null.
    /**
     * Known LinkedIn credential-rejection copy. Used as a fallback when the
     * id-based error containers below don't match — LinkedIn reskins the login
     * form periodically, and when these selectors go stale the caller silently
     * falls through to the 120s feed timeout and reports
     * "page.waitForURL: Timeout" instead of "wrong password", which is
     * indistinguishable from a network/proxy failure to whoever is debugging.
     */
    private static readonly CRED_ERROR_PHRASES = [
        'Wrong email or password',
        "That's not the right password",
        'Hmm, that’s not the right password',
        'Please enter a valid email address or phone number',
        'Couldn’t find a LinkedIn account associated with this email',
    ];

    private async detectCredentialError(page: Page): Promise<string | null> {
        try {
            const selectors = ['#error-for-password', '#error-for-username', 'div[error-for]', '.form__label--error'];
            for (const sel of selectors) {
                const el = await page.$(sel);
                if (el && await el.isVisible().catch(() => false)) {
                    const txt = (await el.innerText().catch(() => '')).trim();
                    if (txt) return txt;
                }
            }

            // Fallback: look for the error copy itself. Scoped to VISIBLE nodes
            // so hidden/templated markup can't produce a false positive that
            // aborts a login which is really at a checkpoint.
            for (const phrase of SessionManagerService.CRED_ERROR_PHRASES) {
                const loc = page.locator(`text=${phrase}`).first();
                if (await loc.isVisible({ timeout: 500 }).catch(() => false)) {
                    const txt = (await loc.innerText().catch(() => '')).trim();
                    return txt || phrase;
                }
            }
        } catch {}
        return null;
    }

    // A checkpoint page that asks the user to type a PIN/OTP has one of these
    // inputs. A device-approval ("tap Yes on your phone") checkpoint does NOT —
    // that's how we tell the two apart.
    private async hasCodeInput(page: Page): Promise<boolean> {
        try {
            const el = await page.$('input#input-code, input[name="pin"], input[name="verification-code"]');
            return !!(el && await el.isVisible().catch(() => false));
        } catch { return false; }
    }

    // Background poll for the device-approval flow: the user taps "Yes, it's me"
    // on their LinkedIn app and the browser silently advances to the feed. We
    // watch for that (up to ~110s), and also switch to the OTP form if a code
    // input appears mid-flow (some challenges fall back to a code).
    private async pollForApproval(userId: string): Promise<void> {
        const session = this.activeSessions.get(userId);
        if (!session) return;
        const { page } = session;
        const deadline = Date.now() + 110_000;

        while (Date.now() < deadline) {
            if (!this.activeSessions.has(userId)) return; // cancelled/closed
            const url = page.url();

            if (url.includes('/feed') || url.includes('/in/')) {
                console.log(`[SESSION-MANAGER] Device approval confirmed — capturing session`);
                await this.handleSuccess(userId).catch((e: any) =>
                    console.error(`[SESSION-MANAGER] handleSuccess after approval failed: ${e.message}`));
                return;
            }

            // A code input appearing means LinkedIn switched to OTP — hand off.
            if (await this.hasCodeInput(page)) {
                console.log(`[SESSION-MANAGER] Approval flow surfaced a code input — switching to 2FA`);
                session.status = 'AWAITING_2FA';
                this.emitStatus(userId, 'AWAITING_2FA', { message: 'LinkedIn is asking for a verification code. Enter it below.' });
                return;
            }

            const err = await this.detectCredentialError(page);
            if (err) {
                this.emitStatus(userId, 'FAILED', { error: err });
                await session.context.close().catch(() => {});
                this.activeSessions.delete(userId);
                return;
            }

            session.lastActivity = Date.now();
            await page.waitForTimeout(3000);
        }

        console.log(`[SESSION-MANAGER] Device approval timed out for ${userId}`);
        this.emitStatus(userId, 'FAILED', { error: 'Approval timed out. Open the LinkedIn app, approve the sign-in, then reconnect.' });
        await session.context.close().catch(() => {});
        this.activeSessions.delete(userId);
    }

    getActiveSession(userId: string): ActiveLoginSession | undefined {
        return this.activeSessions.get(userId);
    }

    async closeSession(userId: string): Promise<void> {
        const session = this.activeSessions.get(userId);
        if (session) {
            await session.context.close().catch(() => {});
            this.activeSessions.delete(userId);
        }
    }
}

export const sessionManager = new SessionManagerService();
