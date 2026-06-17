import { chromium } from 'patchright';
import type { Cookie } from 'patchright';
import { prisma, Prisma } from '@repo/db';
import { getOrAssignProxy } from './proxy.service';

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

            // DB-backed session (canonical). Disk files no longer consulted.
            if (!user.linkedinCookie) {
                console.log(`[SESSION-VALIDATOR] No linkedinCookie in DB for user ${userId}`);
                await this.markInvalid(userId);
                return { valid: false, reason: 'NO_SESSION' };
            }

            let cookies: any[];
            try {
                const raw = JSON.parse(user.linkedinCookie);
                cookies = Array.isArray(raw) ? raw.map((c: any) => ({
                    ...c,
                    expires: c.expires != null ? Math.round(Number(c.expires)) : Math.round(Date.now() / 1000) + 86400 * 30,
                })) : [raw];
            } catch (e) {
                console.error(`[SESSION-VALIDATOR] Failed to parse linkedinCookie from DB: ${e}`);
                await this.markInvalid(userId);
                return { valid: false, reason: 'ERROR' };
            }

            let userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36';
            try {
                if (user.linkedinFingerprint) {
                    const fp = typeof user.linkedinFingerprint === 'string'
                        ? JSON.parse(user.linkedinFingerprint) : user.linkedinFingerprint;
                    if (fp?.userAgent) userAgent = fp.userAgent;
                }
            } catch {}

            let localStorageData: Record<string, string> | null = null;
            try {
                if (user.linkedinLocalStorage) {
                    localStorageData = typeof user.linkedinLocalStorage === 'string'
                        ? JSON.parse(user.linkedinLocalStorage) : user.linkedinLocalStorage as any;
                }
            } catch {}

            const launchOptions: any = {
                headless: false,
                channel: 'chrome',
                args: [
                    '--no-sandbox',
                    '--disable-setuid-sandbox',
                    '--disable-blink-features=AutomationControlled',
                ]
            };

            const contextOptions: any = {
                userAgent,
                viewport: null,
                locale: 'en-US',
                timezoneId: 'America/New_York'
            };

            try {
                const proxy = await getOrAssignProxy(userId);
                if (proxy) {
                    contextOptions.proxy = {
                        server: `http://${proxy.proxyHost}:${proxy.proxyPort}`,
                        username: proxy.proxyUsername || undefined,
                        password: proxy.proxyPassword || undefined,
                    };
                    console.log(`[SESSION-VALIDATOR] Using sticky proxy ${proxy.proxyHost}:${proxy.proxyPort} for user ${userId}`);
                }
            } catch (err: any) {
                console.error(`[SESSION-VALIDATOR] Failed to load proxy: ${err.message}`);
            }

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

    /**
     * Authoritative liveness check — confirms the session via a browser-FREE
     * Voyager /me read (no Chromium), then self-heals the DB flags. Unlike
     * quickCheck (which only trusts sessionInvalid + sessionValidatedAt and so
     * reports dead sessions as healthy), this actually asks LinkedIn.
     *
     * Returns the same shape as quickCheck so it's a drop-in. On a confirmed
     * 401 it marks the session invalid (fixing the false-positive problem); on
     * success it refreshes sessionValidatedAt.
     */
    async liveCheck(userId: string): Promise<{ connected: boolean; sessionInvalid: boolean; sessionValidatedAt?: Date }> {
        // Cheap DB gate first — no cookie / already-flagged-invalid short-circuits
        // without an API round-trip.
        const pre = await this.quickCheck(userId);
        if (!pre.connected) return pre;

        const { validateSessionBrowserless } = await import('./voyager-api.service');
        const res = await validateSessionBrowserless(userId);

        if (res.valid) {
            const sessionValidatedAt = new Date();
            await prisma.user.update({
                where: { id: userId },
                data: { sessionInvalid: false, sessionValidatedAt },
            }).catch(() => {});
            return { connected: true, sessionInvalid: false, sessionValidatedAt };
        }

        // A 401/gated /me means the saved session is dead — mark invalid so the
        // DB stops reporting it healthy and the user gets prompted to re-login.
        if (res.status === 401 || res.reason === 'no-identity-in-/me') {
            await this.markInvalid(userId);
            return { connected: false, sessionInvalid: true };
        }

        // Transient (proxy/network/build) failure — don't nuke the session over
        // a blip; report connected so the caller proceeds (the DOM path will
        // surface a real checkpoint if the session is genuinely gone).
        console.warn(`[SESSION-VALIDATOR] liveCheck inconclusive for ${userId}: ${res.reason}`);
        return { connected: true, sessionInvalid: false, sessionValidatedAt: pre.sessionValidatedAt };
    }

    async markInvalid(userId: string): Promise<void> {
        try {
            await prisma.user.update({
                where: { id: userId },
                data: {
                    sessionInvalid: true,
                    sessionValidatedAt: new Date(),
                    // Flip account health too so the polled UI surfaces it: the
                    // top-bar LinkedIn pill turns red and the AccountHealthBanner
                    // appears (both read accountHealth). markInvalid is the
                    // authoritative "session is dead" signal, so SESSION_EXPIRED
                    // is the correct terminal state here.
                    accountHealth: 'SESSION_EXPIRED',
                    accountHealthReason: 'session_invalid',
                    accountHealthAt: new Date(),
                }
            });
            console.log(`[SESSION-VALIDATOR] Marked session as invalid for user ${userId}`);

            // The worker process has no Socket.IO server (io lives in the API
            // process), so `io` is undefined there — guard it. The UI still
            // turns red via the /linkedin-status + /session/health polls that
            // read the accountHealth we just wrote; the socket emit is just the
            // instant-flip fast path when this runs in the API process.
            io?.to(`user_${userId}`)?.emit('SESSION_EXPIRED', {
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