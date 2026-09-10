import { prisma } from '@repo/db';

/**
 * Pick (or keep) the proxy a user's LinkedIn session egresses through.
 *
 * Country matters: LinkedIn scores a session whose IP country contradicts the
 * account's stated location, so a US account must never be handed the India
 * proxy. Resolution order for the target country is
 * `User.actualCountry` (explicit; see geo.service) > detectedCountry > 'IN'.
 *
 * Two invariants:
 *
 *  1. STICKY — once `linkedinProxySnapshot` is pinned, the assignment is
 *     FROZEN. The live cookies are bound to that exact egress IP, so moving the
 *     user to a "better" proxy would invalidate the session. We return the
 *     pinned proxy and change nothing, even on a country mismatch.
 *  2. CORRECTABLE BEFORE PINNING — with no snapshot yet, a stale/wrong-country
 *     assignment IS re-evaluated. This is what stops a user who signed up
 *     before their country was known (and got the default proxy) from carrying
 *     that mismatch into their first login, where it would become permanent.
 */
export const getOrAssignProxy = async (userId: string, detectedCountry?: string) => {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new Error('User not found');

    const now = new Date();
    const country = user.actualCountry || detectedCountry || 'IN';

    // Invariant 1: a pinned session's proxy is frozen. Never re-pick.
    const snapshot: any = (user as any).linkedinProxySnapshot;
    if (snapshot && typeof snapshot === 'object' && snapshot.server && user.proxyId) {
        return await prisma.proxy.findUnique({ where: { id: user.proxyId } });
    }

    // No snapshot yet: keep the current assignment only if it already matches
    // the resolved country, otherwise fall through and re-pick.
    if (user.proxyId) {
        const current = await prisma.proxy.findUnique({ where: { id: user.proxyId } });
        if (current && current.proxyCountry === country) return current;
        if (current) {
            console.log(
                `[PROXY] User ${userId} resolves to ${country} but holds a ${current.proxyCountry} proxy ` +
                `(${current.proxyIp}) with no pinned session — re-picking.`
            );
        }
    }

    const hasCapacity = async (proxy: { id: string; maxUsers: number }) => {
        // Exclude the user themselves so a re-pick of their existing proxy
        // isn't blocked by their own seat.
        const activeUsers = await prisma.user.count({
            where: { proxyId: proxy.id, id: { not: userId } },
        });
        return activeUsers < proxy.maxUsers;
    };

    const claim = async (proxy: { id: string; proxyHost: string; proxyPort: number }) => {
        await Promise.all([
            prisma.user.update({
                where: { id: userId },
                data: { proxyId: proxy.id, proxyIp: `${proxy.proxyHost}:${proxy.proxyPort}` },
            }),
            prisma.proxy.update({ where: { id: proxy.id }, data: { updatedAt: now } }),
        ]);
    };

    const availability = {
        isAssigned: true,
        OR: [{ lockedUntil: null }, { lockedUntil: { gte: now } }],
    };

    // Preferred: a proxy in the user's own country, least-failing first.
    const inCountry = await prisma.proxy.findMany({
        where: { ...availability, proxyCountry: country },
        orderBy: { failureCount: 'asc' },
    });
    for (const proxy of inCountry) {
        if (await hasCapacity(proxy)) {
            await claim(proxy);
            return proxy;
        }
    }

    // Fallback: any proxy at all. Functionally necessary — we don't have an IP
    // in every country — but it IS a country mismatch, so make it loud rather
    // than silent, since it raises this account's ban risk.
    const anyProxy = await prisma.proxy.findMany({
        where: availability,
        orderBy: { failureCount: 'asc' },
    });
    for (const proxy of anyProxy) {
        if (await hasCapacity(proxy)) {
            console.warn(
                `[PROXY] ⚠️  No ${country} proxy with capacity for user ${userId} — falling back to ` +
                `${proxy.proxyCountry} (${proxy.proxyIp}). Country mismatch raises LinkedIn ban risk; ` +
                `provision a ${country} proxy.`
            );
            await claim(proxy);
            return proxy;
        }
    }

    console.error(`[PROXY] No proxy with capacity for user ${userId} (wanted ${country}).`);
    await prisma.user.update({ where: { id: userId }, data: { proxyIp: null, proxyId: null } });
    return null;
};

export const getActiveCountForProxy = async (proxyId: string) => {
    return prisma.user.count({ where: { proxyId } });
};

export const assignProxyToUser = async (userId: string, proxyId: string) => {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new Error('User not found');
    const proxy = await prisma.proxy.findUnique({ where: { id: proxyId } });
    if (!proxy) throw new Error('Proxy not found');
    // No ban gate — proxies are never permanently banned; always reusable.
    const activeUsers = await prisma.user.count({ where: { proxyId } });
    if (activeUsers >= proxy.maxUsers) throw new Error('Proxy capacity reached');
    await Promise.all([
        prisma.user.update({ where: { id: userId }, data: { proxyId, proxyIp: `${proxy.proxyHost}:${proxy.proxyPort}` } }),
        prisma.proxy.update({ where: { id: proxyId }, data: { updatedAt: new Date() } })
    ]);
    return proxy;
};

export const unassignUserFromProxy = async (userId: string) => {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user || !user.proxyId) return null;
    const proxyId = user.proxyId;
    await prisma.user.update({ where: { id: userId }, data: { proxyId: null, proxyIp: null } });
    return proxyId;
};

export const addProxy = async (data: {
    proxyIp: string;
    proxyHost: string;
    proxyPort: number;
    proxyUsername?: string;
    proxyPassword?: string;
    proxyCountry: string;
    tierClass?: string;
    maxUsers?: number;
}) => {
    const id = require('crypto').randomUUID();
    return prisma.proxy.create({
        data: {
            id,
            proxyIp: data.proxyIp,
            proxyHost: data.proxyHost,
            proxyPort: data.proxyPort,
            proxyUsername: data.proxyUsername,
            proxyPassword: data.proxyPassword,
            proxyCountry: data.proxyCountry,
            tierClass: (data.tierClass as any) || 'ECONOMY',
            maxUsers: data.maxUsers || 15,
            isAssigned: true,
            updatedAt: new Date()
        }
    });
};

export const updateProxy = async (proxyId: string, data: {
    maxUsers?: number;
    proxyCountry?: string;
    banned?: boolean;
}) => {
    const proxy = await prisma.proxy.findUnique({ where: { id: proxyId } });
    if (!proxy) throw new Error('Proxy not found');
    if (data.maxUsers !== undefined) {
        const activeUsers = await prisma.user.count({ where: { proxyId } });
        if (data.maxUsers < activeUsers) {
            throw new Error('Cannot set maxUsers below current usage');
        }
    }
    return prisma.proxy.update({ where: { id: proxyId }, data: { ...data, updatedAt: new Date() } });
};

export const bulkCheckProxyHealth = async () => {
    // Check ALL proxies — we never permanently ban, so none are excluded from
    // monitoring (a previously-failing proxy must be able to come back).
    const proxies = await prisma.proxy.findMany({
        select: { id: true, proxyHost: true, proxyPort: true, proxyUsername: true, proxyPassword: true, linkedinBanned: true }
    });
    const results = [];
    for (const proxy of proxies) {
        const start = Date.now();
        try {
            const http = require('http');
            await new Promise((resolve, reject) => {
                const req = http.get(`http://${proxy.proxyHost}:${proxy.proxyPort}/`, { timeout: 5000 }, (res: any) => {
                    res.resume();
                    res.on('end', () => resolve(true));
                });
                req.on('error', reject);
                req.on('timeout', () => { req.destroy(); reject(new Error('timeout')); });
            });
            const ping = Date.now() - start;
            results.push({ id: proxy.id, ping, status: 'healthy' });
        } catch (err: any) {
            // Track the failure for health ordering only — NEVER ban. A
            // transient ping blip must not permanently lock out a proxy; we want
            // it reusable (incl. reusing the same proxy after a session expired
            // on it). Verified safe to reuse.
            await prisma.proxy.update({
                where: { id: proxy.id },
                data: { failureCount: { increment: 1 } }
            });
            results.push({ id: proxy.id, status: 'failed', error: err.message });
        }
    }
    return results;
};
