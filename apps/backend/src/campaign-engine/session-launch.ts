import { chromium } from 'playwright-extra';
const stealth = require('puppeteer-extra-plugin-stealth')();
chromium.use(stealth);

import { prisma } from '@repo/db';
import type { SessionContext } from './types';

/**
 * Shared, authenticated Playwright launcher for a user's LinkedIn session.
 *
 * This is the SINGLE source of truth for the sticky-proxy invariant: LinkedIn
 * binds the captured cookies to the exact egress IP they were captured behind,
 * so the proxy snapshot pinned at login MUST be applied at LAUNCH level (not
 * just context level — Chrome's background requests escape the context proxy on
 * Linux and would leak through the host IP, instantly invalidating the session).
 *
 * Both the campaign engine (runLead) and the self-profile enrichment job call
 * this so the launch behavior can never drift between the two paths.
 *
 * If the proxy snapshot is missing we ABORT rather than fall back to a different
 * proxy — a different IP is a guaranteed ban path; aborting forces a re-login
 * through the correct proxy, which is the only safe outcome.
 */
export type LaunchResult =
    | { ok: true; browser: any; context: any; page: any; proxyServer: string }
    | { ok: false; failedAt: string; error: string };

const getChromiumPath = (): string | undefined => {
    const candidates = [
        '/root/.cache/ms-playwright/chromium-1217/chrome-linux64/chrome',
        '/home/shiva/.cache/ms-playwright/chromium-1217/chrome-linux64/chrome',
        '/home/shiva/.cache/ms-playwright/chromium-1208/chrome-linux64/chrome',
    ];
    for (const p of candidates) {
        if (require('fs').existsSync(p)) return p;
    }
    return undefined; // Let Playwright auto-detect
};

export async function launchAuthenticatedContext(
    userId: string,
    sessionContext?: SessionContext
): Promise<LaunchResult> {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
        return { ok: false, failedAt: 'init', error: 'User not found' };
    }

    const launchOptions: any = {
        headless: true,
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-blink-features=AutomationControlled',
            '--start-maximized',
            '--disable-gpu',
            '--disable-dev-shm-usage',
        ],
    };

    const chromiumPath = getChromiumPath();
    if (chromiumPath) {
        launchOptions.executablePath = chromiumPath;
    }

    // Session source priority: DB > worker-provided context > file fallback.
    // DB-first makes workers stateless and supports horizontal scaling.
    let activeCookies: any[] | null = null;
    let activeUserAgent: string | null = null;
    let activeLocalStorage: Record<string, string> | null = null;

    try {
        if (user.linkedinCookie) {
            const raw = JSON.parse(user.linkedinCookie);
            activeCookies = Array.isArray(raw)
                ? raw.map((c: any) => ({
                      ...c,
                      expires:
                          c.expires != null
                              ? Math.round(Number(c.expires))
                              : Math.round(Date.now() / 1000) + 86400 * 30,
                  }))
                : raw;
        }
    } catch (e: any) {
        console.log(`[LAUNCH] Failed to parse DB cookies: ${e.message}`);
    }
    try {
        if (user.linkedinFingerprint) {
            const fp =
                typeof user.linkedinFingerprint === 'string'
                    ? JSON.parse(user.linkedinFingerprint)
                    : user.linkedinFingerprint;
            activeUserAgent = fp?.userAgent || null;
        }
    } catch {}
    try {
        if (user.linkedinLocalStorage) {
            activeLocalStorage =
                typeof user.linkedinLocalStorage === 'string'
                    ? JSON.parse(user.linkedinLocalStorage)
                    : user.linkedinLocalStorage;
        }
    } catch {}

    if (activeCookies && activeCookies.length > 0) {
        console.log(
            `[LAUNCH] Using session from DB (${activeCookies.length} cookies, ua=${activeUserAgent ? 'yes' : 'no'}, ls=${activeLocalStorage ? Object.keys(activeLocalStorage).length : 0})`
        );
    } else if (sessionContext?.cookies) {
        console.log(`[LAUNCH] DB session empty, using worker context (${sessionContext.cookies.length} cookies)`);
        activeCookies = sessionContext.cookies;
        activeUserAgent = sessionContext.userAgent;
        activeLocalStorage = sessionContext.localStorage;
    }

    // Sticky-proxy invariant — see file header. Abort if no pinned proxy.
    let proxyConfig: { server: string; username?: string; password?: string } | null = null;
    const snapshot = (user as any).linkedinProxySnapshot;
    if (snapshot && typeof snapshot === 'object' && snapshot.server) {
        proxyConfig = {
            server: snapshot.server,
            username: snapshot.username || undefined,
            password: snapshot.password || undefined,
        };
        console.log(`[LAUNCH] Using pinned login proxy ${proxyConfig.server}`);
    } else {
        console.error(`[LAUNCH] No linkedinProxySnapshot on user ${userId} — refusing to launch. Re-login to pin a proxy.`);
        return { ok: false, failedAt: 'proxy-snapshot-missing', error: 'No proxy snapshot on user — re-login required' };
    }

    // Proxy at LAUNCH level so every Chrome subprocess egresses through the
    // same IP as the cookies were captured under.
    launchOptions.proxy = proxyConfig;

    const contextOptions: any = {
        userAgent:
            activeUserAgent ||
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36',
        viewport: null,
        locale: 'en-IN',
        timezoneId: 'Asia/Kolkata',
        proxy: proxyConfig,
    };

    const browser = await chromium.launch(launchOptions);
    const context = await browser.newContext(contextOptions);

    if (activeCookies && activeCookies.length > 0) {
        await context.addCookies(activeCookies);
        const verify = await context.cookies();
        console.log(`[LAUNCH] Injected ${activeCookies.length} cookies, verified ${verify.length} in context`);
    } else {
        console.warn('[LAUNCH] ⚠️ No cookies available — session will likely fail');
    }

    if (activeLocalStorage && Object.keys(activeLocalStorage).length > 0) {
        await context.addInitScript((data: any) => {
            const parsed = JSON.parse(data);
            for (const [k, v] of Object.entries(parsed)) {
                window.localStorage.setItem(k, v as string);
            }
        }, JSON.stringify(activeLocalStorage));
        console.log(`[LAUNCH] Injected ${Object.keys(activeLocalStorage).length} localStorage keys`);
    } else if (sessionContext?.localStorage && Object.keys(sessionContext.localStorage).length > 0) {
        await context.addInitScript((data: any) => {
            const parsed = JSON.parse(data);
            for (const [k, v] of Object.entries(parsed)) {
                window.localStorage.setItem(k, v as string);
            }
        }, JSON.stringify(sessionContext.localStorage));
        console.log(`[LAUNCH] Injected ${Object.keys(sessionContext.localStorage).length} localStorage keys from worker context`);
    }

    const page = context.pages()[0] || (await context.newPage());

    // Block heavy resources for speed and stealth.
    await page.route('**/*', (route: any) => {
        const type = route.request().resourceType();
        const url = route.request().url();
        if (['image', 'media', 'font'].includes(type) || url.includes('analytics') || url.includes('ads')) {
            return route.abort();
        }
        return route.continue();
    });

    return { ok: true, browser, context, page, proxyServer: proxyConfig.server };
}
