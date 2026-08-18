import { chromium } from 'patchright';
import type { Cookie } from 'patchright';
import { prisma, Prisma } from '@repo/db';

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

            // Sticky-proxy invariant. Two things were wrong here:
            //
            //  1. The proxy was set on contextOptions ONLY. session-launch.ts's
            //     header spells out why that isn't enough — Chrome's background
            //     requests escape the context proxy on Linux and leak through
            //     the host IP, which is exactly what invalidates a session.
            //     It must be on launchOptions.
            //  2. It used getOrAssignProxy (the user's CURRENT assignment)
            //     rather than linkedinProxySnapshot (the exact egress the
            //     cookies were captured behind). Those are the same today with
            //     one proxy in the pool, but they diverge the moment a second
            //     one is added — and then this would validate a session from
            //     the wrong IP and mark a healthy account dead.
            //
            // Abort rather than fall back: no snapshot means we cannot reproduce
            // the login egress, and guessing is the guaranteed ban path.
            const snapshot: any = (user as any).linkedinProxySnapshot;
            if (!snapshot?.server) {
                console.error(`[SESSION-VALIDATOR] No linkedinProxySnapshot for ${userId} — refusing to validate (sticky-proxy). Re-login required.`);
                return { valid: false, reason: 'NO_SESSION' };
            }
            const proxyConfig = {
                server: snapshot.server,
                username: snapshot.username || undefined,
                password: snapshot.password || undefined,
            };
            launchOptions.proxy = proxyConfig;
            contextOptions.proxy = proxyConfig;
            console.log(`[SESSION-VALIDATOR] Using pinned login proxy ${proxyConfig.server} for user ${userId}`);

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

            await this.healStaleAccountHealth(userId, (user as any).accountHealth);

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

        // NOTE: this is a flags-only answer — it does NOT mean LinkedIn agrees.
        // Freshness is liveCheckCached's job; callers that need the truth (any
        // user-facing status endpoint) must go through that instead.
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

            // Same stale-flag heal as validateSession. Reading accountHealth is
            // one indexed lookup and only happens on a confirmed-live session.
            const h = await prisma.user.findUnique({
                where: { id: userId },
                select: { accountHealth: true },
            }).catch(() => null);
            await this.healStaleAccountHealth(userId, h?.accountHealth as string | undefined);

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

    /**
     * liveCheck behind a freshness gate, safe to call from a polling endpoint.
     *
     * Returns the liveCheck result when it actually probed, or `null` when it
     * decided the cached DB flags are fresh enough — in which case the caller
     * should just use those flags unchanged.
     *
     * Two independent guards, both needed:
     *  - `sessionValidatedAt` (DB): survives process restarts and is shared by
     *    every writer (worker runs, logins), so a session a campaign confirmed
     *    30s ago costs the UI nothing.
     *  - `liveProbeAt` (in-process): guards ATTEMPTS, not just successes. A
     *    transient proxy failure deliberately does NOT stamp sessionValidatedAt,
     *    so without this a 30s UI poll would become a 30s /me retry loop for as
     *    long as the proxy is sick.
     *
     * `liveProbeInflight` collapses concurrent callers (multiple browser tabs,
     * or the pill and ActivationHero on the same page load) into one probe.
     */
    private liveProbeAt = new Map<string, number>();
    private liveProbeInflight = new Map<string, Promise<{ connected: boolean; sessionInvalid: boolean; sessionValidatedAt?: Date }>>();

    async liveCheckCached(
        userId: string,
        ttlMs = 15 * 60 * 1000,
    ): Promise<{ connected: boolean; sessionInvalid: boolean; sessionValidatedAt?: Date } | null> {
        const inflight = this.liveProbeInflight.get(userId);
        if (inflight) return inflight;

        const now = Date.now();
        if (now - (this.liveProbeAt.get(userId) ?? 0) < ttlMs) return null;

        const user = await prisma.user.findUnique({
            where: { id: userId },
            select: { sessionValidatedAt: true },
        }).catch(() => null);
        if (user?.sessionValidatedAt && now - user.sessionValidatedAt.getTime() < ttlMs) return null;

        // Stamp BEFORE awaiting, so requests that arrive between this line and
        // the probe finishing are throttled even if the probe throws.
        this.liveProbeAt.set(userId, now);
        this.pruneProbeCache(ttlMs);

        // Logged on purpose: this is a UI-poll-triggered call to LinkedIn. If the
        // throttle ever regresses, this line appearing every 30s instead of every
        // 15min is the only way anyone would notice.
        const lastAt = user?.sessionValidatedAt ? `${Math.round((now - user.sessionValidatedAt.getTime()) / 1000)}s ago` : 'never';
        console.log(`[SESSION-VALIDATOR] live probe for ${userId} (last confirmed ${lastAt}, ttl ${Math.round(ttlMs / 1000)}s)`);

        const p = this.liveCheck(userId).finally(() => this.liveProbeInflight.delete(userId));
        this.liveProbeInflight.set(userId, p);
        return p;
    }

    /** Keep liveProbeAt from growing without bound in a long-lived API process. */
    private pruneProbeCache(ttlMs: number): void {
        if (this.liveProbeAt.size < 5000) return;
        const cutoff = Date.now() - ttlMs * 2;
        for (const [k, t] of this.liveProbeAt) {
            if (t < cutoff) this.liveProbeAt.delete(k);
        }
    }

    /**
     * A session that just proved itself alive against LinkedIn disproves a
     * stale SESSION_EXPIRED / NEEDS_LOGIN flag — so clear it and let the
     * engine's pre-flight gate stop refusing to launch.
     *
     * Deliberately narrow:
     *  - Only SESSION_EXPIRED and NEEDS_LOGIN are healed. A working session is
     *    direct evidence against exactly those two.
     *  - OTP_REQUIRED and RESTRICTED are left ALONE. Those need explicit user
     *    action or a cooldown, and auto-resuming campaigns on an account
     *    LinkedIn is actively challenging is how an "OTP please" escalates into
     *    a real restriction — the precise thing the health gate exists to stop.
     *  - Already-HEALTHY short-circuits with zero queries, so the hourly
     *    validation sweep costs nothing extra in the common case.
     *
     * The which-states-are-healable rule lives in checkpoint.isHealableHealth,
     * shared with the inbox worker's recordSessionAlive so the two can't drift.
     */
    private async healStaleAccountHealth(userId: string, currentHealth: string | undefined): Promise<void> {
        const { markAccountHealthy, isHealableHealth } = await import('../campaign-engine/safety/checkpoint');
        if (!isHealableHealth(currentHealth)) return;
        try {
            await markAccountHealthy(userId);
            console.log(`[SESSION-VALIDATOR] user=${userId} health was ${currentHealth} but session is live → healed to HEALTHY`);
        } catch (err: any) {
            console.error(`[SESSION-VALIDATOR] healStaleAccountHealth failed for ${userId}: ${err?.message}`);
        }
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