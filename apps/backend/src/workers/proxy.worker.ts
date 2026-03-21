import { prisma } from '@repo/db';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

/**
 * Checks a single proxy by attempting to fetch an IP through it.
 * Implements a "3 tries" logic before banning.
 */
export const checkProxyHealth = async (proxyId: string) => {
    const proxy = await prisma.proxy.findUnique({ where: { id: proxyId } });
    if (!proxy) return;

    const proxyUrl = proxy.proxyUsername
        ? `http://${proxy.proxyUsername}:${proxy.proxyPassword}@${proxy.proxyHost}:${proxy.proxyPort}`
        : `http://${proxy.proxyHost}:${proxy.proxyPort}`;

    try {
        // Updated: 60-second timeout as requested
        console.log(`[PROXY-HEALTH] Testing ${proxy.proxyIp} (General + LinkedIn)...`);

        // 1. General Connectivity (ipify.org)
        const { stdout } = await execAsync(`curl -x ${proxyUrl} -m 20 -s https://api.ipify.org`);
        const reportedIp = stdout.trim();

        if (!reportedIp) throw new Error('Proxy offline or empty response from ipify');

            // 2. LinkedIn-Specific Health Check
            // We check the LinkedIn homepage.
            let linkedinBlocked = false;
            try {
                const { stdout: linkedinOut } = await execAsync(`curl -x ${proxyUrl} -m 30 -s -k -o /dev/null -w "%{http_code}" https://www.linkedin.com`);
                const httpCode = linkedinOut.trim();
                console.log(`[PROXY-HEALTH] LinkedIn test status for ${proxy.proxyIp}: ${httpCode}`);

                if (httpCode === '999' || httpCode === '403') {
                    linkedinBlocked = true;
                }
            } catch (le: any) {
            console.warn(`[PROXY-HEALTH] LinkedIn reachability test failed: ${le.message}`);
        }

        // Success: Reset failure count and ensure healthy status
        await prisma.proxy.update({
            where: { id: proxyId },
            data: {
                banned: false,
                failureCount: 0,
                linkedinBanned: linkedinBlocked,
                updatedAt: new Date()
            }
        });

        if (linkedinBlocked) {
            console.warn(`[PROXY-HEALTH] Proxy ${proxy.proxyIp} is ONLINE but LinkedIn-BANNED (HTTP 999/403).`);
        } else {
            console.log(`[PROXY-HEALTH] Proxy ${proxy.proxyIp} is healthy. Reported IP: ${reportedIp}`);
        }

        return !linkedinBlocked;
    } catch (error: any) {
        const newFailureCount = (proxy.failureCount || 0) + 1;
        console.log(`[PROXY-HEALTH] Proxy ${proxy.proxyIp} FAILED (Attempt ${newFailureCount}/3): ${error.message}`);

        const shouldBan = newFailureCount >= 3;

        await prisma.proxy.update({
            where: { id: proxyId },
            data: {
                failureCount: newFailureCount,
                banned: shouldBan,
                bannedAt: shouldBan ? new Date() : proxy.bannedAt
            }
        });

        if (shouldBan) {
            console.warn(`[PROXY-HEALTH] Proxy ${proxy.proxyIp} has been BANNED after 3 consecutive failures.`);
        }

        return false;
    }
};

/**
 * Scans all active proxies and verifies their status.
 */
export const checkAllProxies = async () => {
    console.log('[PROXY-HEALTH] Starting global proxy health check...');
    // We check proxies that are either not banned, or recently failed but not yet reached 3 tries
    const proxiesToCheck = await prisma.proxy.findMany({
        where: {
            OR: [
                { banned: false },
                { failureCount: { gt: 0, lt: 3 } }
            ]
        }
    });

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
