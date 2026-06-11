import { chromium } from 'patchright';
import type { BrowserContext, Page, Cookie } from 'patchright';
import { prisma } from '@repo/db';
import path from 'path';
import fs from 'fs';
import { io } from '../socket';
import { uploadScreenshotToS3 } from './s3-upload.service';

const SESSION_STORAGE_PATH = process.env.SESSION_STORAGE_PATH || path.join(process.cwd(), 'sessions');

export type LoginStatus = 'IDLE' | 'LAUNCHING' | 'NAVIGATING' | 'AWAITING_CREDENTIALS' | 'SUBMITTING' | 'AWAITING_2FA' | 'VERIFYING_2FA' | 'CAPTCHA_REQUIRED' | 'SUCCESS' | 'FAILED';

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

        await prisma.user.update({
            where: { id: userId },
            data: { sessionInvalid: false }
        });

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
                await humanType(page, usernameInput, email);
                await page.waitForTimeout(1000);

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
                    await humanType(page, passwordInput, password);
                    await page.waitForTimeout(1000);

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

                    // LinkedIn checkpoint/challenge (OTP, phone, captcha) after login.
                    // Emit AWAITING_2FA so the frontend shows the OTP input instead
                    // of waiting 120s for the feed timeout.
                    if (postSubmitUrl.includes('/checkpoint/')) {
                        console.log(`[SESSION-MANAGER] Checkpoint detected — awaiting 2FA code`);
                        try {
                            const ssDir = SESSION_STORAGE_PATH;
                            if (!fs.existsSync(ssDir)) fs.mkdirSync(ssDir, { recursive: true });
                            const ssPath = path.join(ssDir, `checkpoint_${userId}_${Date.now()}.png`);
                            await page.screenshot({ path: ssPath, fullPage: true });
                            console.log(`[SESSION-MANAGER] Checkpoint screenshot saved: ${ssPath}`);
                        } catch {}
                        uploadScreenshotToS3(page, userId, 'checkpoint').catch(() => {});
                        checkpointDetected = true;
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

            const cookies = await context.cookies();
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
            this.emitStatus(userId, 'SUCCESS', { sessionPath });

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

        const cookies = await context.cookies();
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