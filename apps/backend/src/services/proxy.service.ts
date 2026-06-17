import { prisma } from '@repo/db';

export const getOrAssignProxy = async (userId: string, detectedCountry?: string) => {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new Error('User not found');
    if (user.proxyId) {
        return await prisma.proxy.findUnique({ where: { id: user.proxyId } });
    }
    const country = user.actualCountry || detectedCountry || 'IN';
    const now = new Date();
    const proxy = await prisma.proxy.findFirst({
        where: {
            proxyCountry: country,
            isAssigned: true,
            OR: [
                { lockedUntil: null },
                { lockedUntil: { gte: now } }
            ]
        },
        orderBy: { failureCount: 'asc' }
    });
    if (proxy) {
        const activeUsers = await prisma.user.count({ where: { proxyId: proxy.id } });
        if (activeUsers < proxy.maxUsers) {
            await Promise.all([
                prisma.user.update({ where: { id: userId }, data: { proxyId: proxy.id } }),
                prisma.proxy.update({ where: { id: proxy.id }, data: { updatedAt: now } })
            ]);
            return proxy;
        }
    }
    const availableProxy = await prisma.proxy.findFirst({
        where: {
            isAssigned: true,
            OR: [
                { lockedUntil: null },
                { lockedUntil: { gte: now } }
            ]
        },
        orderBy: { failureCount: 'asc' }
    });
    if (availableProxy) {
        const activeUsers = await prisma.user.count({ where: { proxyId: availableProxy.id } });
        if (activeUsers < availableProxy.maxUsers) {
            await Promise.all([
                prisma.user.update({ where: { id: userId }, data: { proxyId: availableProxy.id } }),
                prisma.proxy.update({ where: { id: availableProxy.id }, data: { updatedAt: now } })
            ]);
            return availableProxy;
        }
    }
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
