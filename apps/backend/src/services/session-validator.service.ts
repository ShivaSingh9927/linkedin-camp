import { chromium } from 'playwright-extra';
import { Cookie } from 'playwright';
const stealth = require('puppeteer-extra-plugin-stealth')();
import { prisma, Prisma } from '@repo/db';
import path from 'path';
import fs from 'fs';
import { getOrAssignProxy } from './proxy.service';

chromium.use(stealth);

const SESSION_STORAGE_PATH = process.env.SESSION_STORAGE_PATH || path.join(process.cwd(), 'sessions');

export interface ValidationResult {
    valid: boolean;
    reason?: 'EXPIRED' | 'LOGGED_OUT' | 'CHECKPOINT' | 'NO_SESSION' | 'ERROR';
    profile?: {
        firstName?: string;
        lastName?: string;
        headline?: string;
        avatarUrl?: string;
        urn?: string;
    };
}

class SessionValidatorService {
    private validationLocks: Map<string, boolean> = new Map();

    async validateSession(userId: string): Promise<ValidationResult> {
        if (this.validationLocks.get(userId)) {
            console.log(`[SESSION-VALIDATOR] Validation already in progress for user ${userId}`);
            const user = await prisma.user.findUnique({ where: { id: userId } });
            if (user?.sessionInvalid) {
                return { valid: false, reason: 'EXPIRED' };
            }
            return { valid: true };
        }

        this.validationLocks.set(userId, true);
        let browser: any;
        let context: any;

        try {
            const user = await prisma.user.findUnique({
                where: { id: userId }
            });

            if (!user) {
                return { valid: false, reason: 'NO_SESSION' };
            }

            const sessionPath = user.sessionPath || path.join(SESSION_STORAGE_PATH, userId);
            const cookiesPath = path.join(sessionPath, 'cookies.json');
            const fingerprintPath = path.join(sessionPath, 'fingerprint.json');
            const localStoragePath = path.join(sessionPath, 'localStorage.json');

            if (!fs.existsSync(cookiesPath)) {
                console.log(`[SESSION-VALIDATOR] No cookies.json found for user ${userId}`);
                await this.markInvalid(userId);
                return { valid: false, reason: 'NO_SESSION' };
            }

            let cookies: any[];
            try {
                cookies = JSON.parse(fs.readFileSync(cookiesPath, 'utf-8'));
            } catch (e) {
                console.error(`[SESSION-VALIDATOR] Failed to parse cookies.json: ${e}`);
                await this.markInvalid(userId);
                return { valid: false, reason: 'ERROR' };
            }

            let userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36';
            if (fs.existsSync(fingerprintPath)) {
                try {
                    const fp = JSON.parse(fs.readFileSync(fingerprintPath, 'utf-8'));
                    if (fp.userAgent) userAgent = fp.userAgent;
                } catch {}
            }

            let localStorageData: Record<string, string> | null = null;
            if (fs.existsSync(localStoragePath)) {
                try {
                    localStorageData = JSON.parse(fs.readFileSync(localStoragePath, 'utf-8'));
                } catch {}
            }

            const launchOptions: any = {
                headless: true,
                args: [
                    '--no-sandbox',
                    '--disable-setuid-sandbox',
                    '--disable-blink-features=AutomationControlled',
                    '--disable-dev-shm-usage'
                ]
            };

            const contextOptions: any = {
                userAgent,
                viewport: null,
                locale: 'en-IN',
timezoneId: 'Asia/Kolkata'
            };

            console.log(`[SESSION-VALIDATOR] Validating session for user ${userId} with ${cookies.length} cookies`);

            browser = await chromium.launch(launchOptions);
            context = await browser.newContext(contextOptions);

            await context.addCookies(cookies);

            if (localStorageData && Object.keys(localStorageData).length > 0) {
                await context.addInitScript((data: string) => {
                    const parsed = JSON.parse(data);
                    for (const [k, v] of Object.entries(parsed)) {
                        window.localStorage.setItem(k, v as string);
                    }
                }, JSON.stringify(localStorageData));
            }

            const page = context.pages()[0] || await context.newPage();

            console.log(`[SESSION-VALIDATOR] Navigating to LinkedIn feed...`);
            await page.goto('https://www.linkedin.com/feed/', {
                waitUntil: 'domcontentloaded',
                timeout: 45000
            });

            await page.waitForTimeout(3000);

            const finalUrl = page.url();
            console.log(`[SESSION-VALIDATOR] Final URL: ${finalUrl}`);

            if (finalUrl.includes('/login') || finalUrl.includes('/authwall')) {
                console.log(`[SESSION-VALIDATOR] Session EXPIRED - redirected to login`);
                await this.markInvalid(userId);
                return { valid: false, reason: 'LOGGED_OUT' };
            }

            if (finalUrl.includes('/checkpoint') || finalUrl.includes('/challenge')) {
                console.log(`[SESSION-VALIDATOR] Session blocked - checkpoint required`);
                await this.markInvalid(userId);
                return { valid: false, reason: 'CHECKPOINT' };
            }

            if (!finalUrl.includes('/feed/')) {
                console.log(`[SESSION-VALIDATOR] Unexpected URL: ${finalUrl}`);
                await this.markInvalid(userId);
                return { valid: false, reason: 'EXPIRED' };
            }

            const profileData = await page.evaluate(() => {
                const navMe = document.querySelector('.global-nav__me button[aria-label]');
                const ariaLabel = navMe?.getAttribute('aria-label') || '';
                const nameMatch = ariaLabel.match(/^(.+?)\s*\(/);
                const fullName = nameMatch ? nameMatch[1].trim() : ariaLabel;

                let firstName = '', lastName = '';
                if (fullName) {
                    const parts = fullName.split(' ');
                    firstName = parts[0] || '';
                    lastName = parts.slice(1).join(' ') || '';
                }

                const avatarImg = document.querySelector('.global-nav__me button img[alt]');
                const avatarUrl = (avatarImg as HTMLImageElement)?.src || '';

                const headlineEl = document.querySelector('a[href*="/in/"] span[aria-hidden="true"]');
                const headline = headlineEl?.textContent || '';

                const urnEl = document.querySelector('a[href*="/in/"]');
                const href = urnEl?.getAttribute('href') || '';
                const urnMatch = href.match(/\/in\/([^/?]+)/);
                const urn = urnMatch ? urnMatch[1] : '';

                return { firstName, lastName, fullName, headline, avatarUrl, urn };
            }).catch(() => ({}));

            console.log(`[SESSION-VALIDATOR] Session VALID for user ${userId}. Profile: ${profileData.fullName || 'unknown'}`);

            await prisma.user.update({
                where: { id: userId },
                data: {
                    sessionValidatedAt: new Date(),
                    sessionInvalid: false,
                    profileData: profileData.firstName ? JSON.stringify(profileData) : (user.profileData || Prisma.DbNull)
                }
            });

            return {
                valid: true,
                profile: {
                    firstName: profileData.firstName,
                    lastName: profileData.lastName,
                    headline: profileData.headline,
                    avatarUrl: profileData.avatarUrl,
                    urn: profileData.urn
                }
            };

        } catch (err: any) {
            console.error(`[SESSION-VALIDATOR] Validation error for user ${userId}: ${err.message}`);
            await this.markInvalid(userId);
            return { valid: false, reason: 'ERROR' };
        } finally {
            if (context) await context.close().catch(() => {});
            if (browser) await browser.close().catch(() => {});
            this.validationLocks.delete(userId);
        }
    }

    async quickCheck(userId: string): Promise<{ connected: boolean; sessionInvalid: boolean; sessionValidatedAt?: Date }> {
        const user = await prisma.user.findUnique({
            where: { id: userId },
            select: {
                sessionPath: true,
                sessionInvalid: true,
                sessionValidatedAt: true,
                linkedinCookie: true,
                persistentSessionPath: true
            }
        });

        if (!user) return { connected: false, sessionInvalid: true };

        if (user.sessionInvalid) {
            return { connected: false, sessionInvalid: true, sessionValidatedAt: user.sessionValidatedAt || undefined };
        }

        const hasSession = !!user.sessionPath || !!user.linkedinCookie || !!user.persistentSessionPath;
        if (!hasSession) {
            return { connected: false, sessionInvalid: false };
        }

        const needsValidation = !user.sessionValidatedAt ||
            (Date.now() - user.sessionValidatedAt.getTime() > 60 * 60 * 1000);

        return {
            connected: true,
            sessionInvalid: false,
            sessionValidatedAt: user.sessionValidatedAt || undefined
        };
    }

    async markInvalid(userId: string): Promise<void> {
        try {
            await prisma.user.update({
                where: { id: userId },
                data: {
                    sessionInvalid: true,
                    sessionValidatedAt: new Date()
                }
            });
            console.log(`[SESSION-VALIDATOR] Marked session as invalid for user ${userId}`);

            io.to(`user_${userId}`).emit('SESSION_EXPIRED', {
                userId,
                message: 'Your LinkedIn session has expired. Please re-login.',
                timestamp: new Date().toISOString()
            });
        } catch (err: any) {
            console.error(`[SESSION-VALIDATOR] Failed to mark session invalid: ${err.message}`);
        }
    }
}

import { io } from '../socket';

export const sessionValidator = new SessionValidatorService();