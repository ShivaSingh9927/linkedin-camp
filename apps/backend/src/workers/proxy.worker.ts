import { prisma } from '@repo/db';
import { request as pwRequest } from 'patchright';

/**
 * Checks a single proxy by attempting to fetch an IP through it.
 * Implements a "3 tries" logic before banning.
 */
export const checkProxyHealth = async (proxyId: string) => {
    const proxy = await prisma.proxy.findUnique({ where: { id: proxyId } });
    if (!proxy) return;

    // Proxy config for Playwright's request context. This replaces a shell-out
    // to `curl`, which is NOT in the container image — so every check threw
    // "curl: not found", failed, and inflated failureCount into the thousands
    // (10,695 on one proxy). Since getOrAssignProxy orders by failureCount, that
    // silently corrupted proxy selection. Playwright's request context egresses
    // through the proxy natively, in-process, no external binary.
    const proxyConfig = {
        server: `http://${proxy.proxyHost}:${proxy.proxyPort}`,
        username: proxy.proxyUsername || undefined,
        password: proxy.proxyPassword || undefined,
    };

    let ctx: Awaited<ReturnType<typeof pwRequest.newContext>> | null = null;
    try {
        console.log(`[PROXY-HEALTH] Testing ${proxy.proxyIp} (General + LinkedIn)...`);
        ctx = await pwRequest.newContext({ proxy: proxyConfig, timeout: 20000 });

        // 1. General connectivity (ipify.org)
        const ipResp = await ctx.get('https://api.ipify.org', { timeout: 20000 });
        const reportedIp = (await ipResp.text()).trim();
        if (!ipResp.ok() || !reportedIp) throw new Error(`Proxy offline or empty response from ipify (status ${ipResp.status()})`);

        // 2. LinkedIn-specific reachability
        let linkedinBlocked = false;
        try {
            const liResp = await ctx.get('https://www.linkedin.com', { timeout: 30000, maxRedirects: 0 });
            const httpCode = liResp.status();
            console.log(`[PROXY-HEALTH] LinkedIn test status for ${proxy.proxyIp}: ${httpCode}`);
            if (httpCode === 999 || httpCode === 403) {
                linkedinBlocked = true;
            }
        } catch (le: any) {
            console.warn(`[PROXY-HEALTH] LinkedIn reachability test failed: ${le.message}`);
        }

        // Success: reset failure count and clear any legacy ban flags. We never
        // ban proxies — linkedinBlocked is logged for visibility only, not used
        // to exclude the proxy (sessions/proxies are reusable after expiry).
        await prisma.proxy.update({
            where: { id: proxyId },
            data: {
                banned: false,
                failureCount: 0,
                linkedinBanned: false,
                updatedAt: new Date()
            }
        });

        if (linkedinBlocked) {
            console.warn(`[PROXY-HEALTH] Proxy ${proxy.proxyIp} is ONLINE but LinkedIn returned 999/403 (logged, not banned).`);
        } else {
            console.log(`[PROXY-HEALTH] Proxy ${proxy.proxyIp} is healthy. Reported IP: ${reportedIp}`);
        }

        return !linkedinBlocked;
    } catch (error: any) {
        const newFailureCount = (proxy.failureCount || 0) + 1;
        console.log(`[PROXY-HEALTH] Proxy ${proxy.proxyIp} FAILED (Attempt ${newFailureCount}): ${error.message}`);

        // Track the failure count for health ordering only — never ban. A proxy
        // that fails health checks stays in rotation and recovers automatically
        // on its next successful check.
        await prisma.proxy.update({
            where: { id: proxyId },
            data: { failureCount: newFailureCount }
        });

        return false;
    } finally {
        await ctx?.dispose().catch(() => {});
    }
};

/**
 * Scans all active proxies and verifies their status.
 */
export const checkAllProxies = async () => {
    console.log('[PROXY-HEALTH] Starting global proxy health check...');
    // Check ALL proxies — we never permanently ban, so every proxy stays
    // monitored and can recover (a previously-failing proxy must come back).
    const proxiesToCheck = await prisma.proxy.findMany();

    console.log(`[PROXY-HEALTH] Checking ${proxiesToCheck.length} proxies...`);

    // Check in parallel with chunking (max 5 at a time to be safe)
    const chunks = [];
    for (let i = 0; i < proxiesToCheck.length; i += 5) {
        chunks.push(proxiesToCheck.slice(i, i + 5));
    }

    for (const chunk of chunks) {
        await Promise.all(chunk.map(p => checkProxyHealth(p.id)));
    }

    console.log('[PROXY-HEALTH] Health check cycle complete.');
};

/**
 * Initializes the periodic health check.
 */
export const initProxyHealthWorker = () => {
    // Run once on startup
    checkAllProxies().catch(e => console.error('Initial proxy check failed:', e));

    // Run every 15 minutes (frequent enough to catch 3 tries quickly if issues persist)
    setInterval(() => {
        checkAllProxies().catch(e => console.error('Recurring proxy check failed:', e));
    }, 15 * 60 * 1000);
};
