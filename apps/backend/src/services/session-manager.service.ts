import { chromium } from 'playwright-extra';
import { BrowserContext, Page, Cookie } from 'playwright';
const stealth = require('puppeteer-extra-plugin-stealth')();
import { prisma } from '@repo/db';
import path from 'path';
import fs from 'fs';
import { io } from '../socket';

chromium.use(stealth);

const SESSION_STORAGE_PATH = process.env.SESSION_STORAGE_PATH || path.join(process.cwd(), 'sessions');

export type LoginStatus = 'IDLE' | 'LAUNCHING' | 'NAVIGATING' | 'AWAITING_CREDENTIALS' | 'SUBMITTING' | 'AWAITING_2FA' | 'VERIFYING_2FA' | 'CAPTCHA_REQUIRED' | 'SUCCESS' | 'FAILED';

export interface ActiveLoginSession {
    userId: string;
    context: BrowserContext;
    page: Page;
    status: LoginStatus;
    lastActivity: number;
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
            headless: true,
            args: [
                '--disable-blink-features=AutomationControlled',
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--start-maximized',
                '--disable-web-security'
            ],
            viewport: { width: 1280, height: 800 },
            userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'
        };

        const contextOptions: any = {
            userAgent: launchOptions.userAgent,
            viewport: null,
            locale: 'en-IN',
            timezoneId: 'Asia/Kolkata'
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
                lastActivity: Date.now()
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

        try {
            await page.waitForSelector('#username', { state: 'visible', timeout: 30000 }).catch(() => null);
            
            const usernameInput = await page.$('#username');
            
            if (usernameInput) {
                console.log(`[SESSION-MANAGER] Filling email and clicking Continue...`);
                await usernameInput.fill(email);
                await page.waitForTimeout(500);
                
                const continueBtn = await page.$('button[type="submit"]:has-text("Continue")');
                if (continueBtn) {
                    await continueBtn.click();
                    await page.waitForSelector('#password', { state: 'visible', timeout: 15000 }).catch(() => null);
                    await page.waitForTimeout(1000);
                } else {
                    await page.keyboard.press('Enter');
                    await page.waitForSelector('#password', { state: 'visible', timeout: 15000 }).catch(() => null);
                    await page.waitForTimeout(1000);
                }
                
                const passwordInput = await page.$('#password');
                if (passwordInput) {
                    await passwordInput.fill(password);
                    await page.waitForTimeout(500);
                    
                    const signInBtn = await page.$('button[type="submit"]:has-text("Sign in")');
                    if (signInBtn) {
                        await signInBtn.click();
                    } else {
                        await page.keyboard.press('Enter');
                    }
                }
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

            await context.close().catch(() => {});
            this.activeSessions.delete(userId);

            await prisma.user.update({
                where: { id: userId },
                data: { 
                    sessionPath,
                    sessionInvalid: false,
                    linkedinCookie: JSON.stringify(cookies)
                }
            });

            console.log(`[SESSION-MANAGER] Session files saved to ${sessionPath}`);
            this.emitStatus(userId, 'SUCCESS', { sessionPath });

            return {};
        } catch (e: any) {
            console.error(`[SESSION-MANAGER] Login failed: ${e.message}`);
            try {
                await page.screenshot({ path: path.join(SESSION_STORAGE_PATH, `login_error_${userId}.png`) });
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

        await prisma.user.update({
            where: { id: userId },
            data: {
                sessionPath: sessionPath,
                sessionValidatedAt: new Date(),
                sessionInvalid: false,
                profileData: profileData.firstName ? JSON.stringify(profileData) : undefined,
                persistentSessionPath: sessionPath,
                lastBrowserActivityAt: new Date()
            }
        });

        session.status = 'SUCCESS';
        this.emitStatus(userId, 'SUCCESS', { message: 'Successfully connected!', profile: profileData });

        await session.context.close().catch(() => {});
        this.activeSessions.delete(userId);

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