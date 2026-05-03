import { chromium } from 'playwright-extra';
import { BrowserContext, Page, Cookie } from 'playwright';
const stealth = require('puppeteer-extra-plugin-stealth')();
import { prisma } from '@repo/db';
import path from 'path';
import fs from 'fs';
import { getOrAssignProxy } from './proxy.service';
import { io } from '../socket';

chromium.use(stealth);

export interface LoginSession {
    userId: string;
    context: BrowserContext;
    page: Page;
    lastActivity: number;
    status: 'IDLE' | 'LOGGING_IN' | 'AWAITING_2FA' | 'SUCCESS' | 'FAILED';
}

export type LoginResult = {
    success?: boolean;
    requires2FA?: boolean;
    error?: string;
    url?: string;
};

class CloudLoginService {
    private activeSessions: Map<string, LoginSession> = new Map();

    constructor() {
        setInterval(() => this.cleanupSessions(), 5 * 60 * 1000);
    }

    private emitStatus(userId: string, status: string, data?: any) {
        io.to(`user_${userId}`).emit('CLOUD_LOGIN_STATUS', { status, ...data });
    }

    private async cleanupSessions() {
        const now = Date.now();
        for (const [userId, session] of this.activeSessions.entries()) {
            if (now - session.lastActivity > 15 * 60 * 1000) {
                console.log(`[CLOUD-LOGIN] Session expired for user ${userId}`);
                await session.context.close().catch(() => { });
                this.activeSessions.delete(userId);
            }
        }
    }

    async startLogin(userId: string, email: string, pass: string): Promise<LoginResult> {
        if (this.activeSessions.has(userId)) {
            const existing = this.activeSessions.get(userId)!;
            await existing.context.close().catch(() => { });
            this.activeSessions.delete(userId);
        }

        console.log(`[CLOUD-LOGIN] Initiating login for ${userId}`);
        this.emitStatus(userId, 'STARTING', { message: 'Initializing secure browser...' });

        const sessionPath = path.join(process.cwd(), 'sessions', userId);
        if (!fs.existsSync(sessionPath)) {
            fs.mkdirSync(sessionPath, { recursive: true });
        }

        const userWithProxy = await getOrAssignProxy(userId);
        const launchOptions: any = {
            headless: true,
            args: [
                '--disable-blink-features=AutomationControlled',
                '--no-sandbox',
                '--disable-setuid-sandbox'
            ],
            viewport: { width: 1280, height: 800 },
            userAgent: 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36'
        };

        if (userWithProxy) {
            launchOptions.proxy = {
                server: `${userWithProxy.proxyHost}:${userWithProxy.proxyPort}`,
                username: userWithProxy.proxyUsername || undefined,
                password: userWithProxy.proxyPassword || undefined
            };
        }

        const context = await chromium.launchPersistentContext(sessionPath, launchOptions);
        const page = context.pages()[0] || await context.newPage();

        this.activeSessions.set(userId, {
            userId,
            context,
            page,
            lastActivity: Date.now(),
            status: 'LOGGING_IN'
        });

        this.emitStatus(userId, 'NAVIGATING', { message: 'Navigating to LinkedIn...' });
        await page.goto('https://www.linkedin.com/login', { waitUntil: 'load', timeout: 120000 });
        console.log(`[CLOUD-LOGIN] Arrived at: ${page.url()}`);

        if (page.url().includes('/feed')) {
            return this.handleSuccess(userId);
        }

        this.emitStatus(userId, 'SUBMITTING', { message: 'Submitting credentials...' });
        
        try {
            console.log(`[CLOUD-LOGIN] Waiting for any input...`);
            await page.waitForSelector('input', { state: 'attached', timeout: 30000 });

            console.log(`[CLOUD-LOGIN] Simulating human keyboard entry...`);
            // Focus the first text input (username)
            const inputs = await page.$$('input');
            const userIdx = await page.evaluate(() => {
                const els = Array.from(document.querySelectorAll('input'));
                return els.findIndex(i => i.type === 'text' || i.type === 'email');
            });

            if (userIdx !== -1) {
                await inputs[userIdx].focus();
                await page.keyboard.type(email, { delay: 100 });
                await page.keyboard.press('Tab');
                await page.keyboard.type(pass, { delay: 100 });
                await page.keyboard.press('Enter');
            } else {
                throw new Error('Could not find username input via index');
            }
            
            console.log(`[CLOUD-LOGIN] Keyboard sequence complete.`);
        } catch (e: any) {
            console.error(`[CLOUD-LOGIN] Error during credential entry: ${e.message}`);
            const inputs = await page.$$eval('input', (els) => els.map(el => ({ id: el.id, name: el.name, type: el.type, placeholder: el.getAttribute('placeholder') })));
            console.log('[CLOUD-LOGIN] Available inputs:', JSON.stringify(inputs, null, 2));
            await page.screenshot({ path: path.join(process.cwd(), `error_login_${userId}.png`) });
            throw e;
        }
        
        await page.waitForTimeout(10000);

        const currentUrl = page.url();
        console.log(`[CLOUD-LOGIN] Current URL after submit: ${currentUrl}`);

        if (currentUrl.includes('/checkpoint/challenge') || await page.isVisible('.checkpoint-code-input')) {
            const session = this.activeSessions.get(userId)!;
            session.status = 'AWAITING_2FA';
            session.lastActivity = Date.now();
            this.emitStatus(userId, 'AWAITING_2FA', { message: 'Security code required' });
            return { requires2FA: true };
        }

        if (currentUrl.includes('/feed') || currentUrl.includes('/in/')) {
            return this.handleSuccess(userId);
        }

        const error = await page.innerText('.alert-content, #error-for-password, #error-for-username').catch(() => 'Login failed');
        await page.screenshot({ path: path.join(process.cwd(), `error_login_final_${userId}.png`) });
        await context.close();
        this.activeSessions.delete(userId);
        this.emitStatus(userId, 'FAILED', { error, url: currentUrl });
        return { error, url: currentUrl };
    }

    async submit2FA(userId: string, code: string) {
        const session = this.activeSessions.get(userId);
        if (!session)             return { error: 'Session expired', url: '' };

        session.lastActivity = Date.now();
        const { page } = session;

        this.emitStatus(userId, 'VERIFYING_2FA', { message: 'Verifying security code...' });

        const input = await page.waitForSelector('input#input-code, input[name="pin"]', { timeout: 10000 }).catch(() => null);
        if (!input) {
            this.emitStatus(userId, 'FAILED', { error: 'Code input not found' });
            return { error: 'Code input not found', url: '' };
        }

        await input.fill(code);
        await page.click('#email-pin-submit-button, button[type="submit"]');
        await page.waitForTimeout(10000);

        if (page.url().includes('/feed') || page.url().includes('/in/')) {
            return this.handleSuccess(userId);
        }

        this.emitStatus(userId, 'FAILED', { error: 'Verification failed' });
            return { error: 'Verification failed', url: '' };
    }

    private async handleSuccess(userId: string) {
        const session = this.activeSessions.get(userId)!;
        const cookies = await session.context.cookies();
        const liAt = cookies.find((c: Cookie) => c.name === 'li_at')?.value;

        await prisma.user.update({
            where: { id: userId },
            data: {
                linkedinCookie: liAt,
                persistentSessionPath: path.join(process.cwd(), 'sessions', userId)
            }
        });

        this.emitStatus(userId, 'SUCCESS', { message: 'Successfully connected!' });
        await session.context.close();
        this.activeSessions.delete(userId);
        return { success: true };
    }
}

export const cloudLoginService = new CloudLoginService();

