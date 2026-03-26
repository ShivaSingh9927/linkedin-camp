import { prisma } from '@repo/db';

export const getOrAssignProxy = async (userId: string, detectedCountry?: string): Promise<any> => {
    // 1. Fetch user to check current proxy and actual country
    const user = await prisma.user.findUnique({
        where: { id: userId },
        include: { proxy: true }
    });

    if (!user) throw new Error('User not found');

    // Update actualCountry if provided and not already set
    if (detectedCountry && !user.actualCountry) {
        await prisma.user.update({
            where: { id: userId },
            data: { actualCountry: detectedCountry }
        });
    }

    const targetCountry = detectedCountry || user.actualCountry;

    // 2. If user already has a healthy proxy, return it
    if (user.proxy && !user.proxy.banned) {
        return user.proxy;
    }

    // If it was banned, notify user about IP rotation
    if (user.proxy && user.proxy.banned) {
        console.log(`[PROXY] Rotating IP for user ${userId} because current IP ${user.proxy.proxyIp} is banned.`);
        await prisma.notification.create({
            data: {
                userId,
                title: 'IP Address Rotation',
                body: 'Your dedicated proxy IP has been rotated due to performance issues to ensure your campaign safety.',
                type: 'SYSTEM'
            }
        });
    }

    // 3. Find an available proxy based on tier and country
    const tier = user.tier === 'ADVANCED' || user.tier === 'PLUS' || user.tier === 'EXPERT' || user.tier === 'ULTIMATE'
        ? 'RESIDENTIAL'
        : 'ECONOMY';

    // Apply scaling strategy: 12 users for freemium/economy, 5 users for paid/residential
    const maxCapacity = tier === 'RESIDENTIAL' ? 5 : 12;

    // Strategy:
    // Try 1: Match Tier AND Country
    // Try 2: Match Tier ONLY (Fallback)

    let targetProxy = await prisma.proxy.findFirst({
        where: {
            banned: false,
            linkedinBanned: false,
            tierClass: tier === 'RESIDENTIAL' ? 'RESIDENTIAL' : 'ECONOMY',
            proxyCountry: targetCountry || undefined, // Try matching country
            assignedUsers: { none: { id: userId } }
        },
        include: { _count: { select: { assignedUsers: true } } },
        orderBy: { assignedUsers: { _count: 'asc' } }
    });

    // Verify capacity
    if (targetProxy && (targetProxy as any)._count.assignedUsers >= maxCapacity) {
        targetProxy = null;
    }

    // Fallback if no country match found
    if (!targetProxy) {
        console.log(`[PROXY] No ${tier} healthy proxy found for ${targetCountry}. Falling back to any available ${tier} proxy.`);
        const proxies = await prisma.proxy.findMany({
            where: {
                banned: false,
                linkedinBanned: false,
                tierClass: tier === 'RESIDENTIAL' ? 'RESIDENTIAL' : 'ECONOMY',
            },
            include: { _count: { select: { assignedUsers: true } } }
        });
        targetProxy = (proxies as any[]).find(p => p._count.assignedUsers < maxCapacity) || null;
    }

    if (!targetProxy) {
        console.warn(`[PROXY] No available proxy found for user ${userId} in tier ${tier}.`);
        return null;
    }

    // 4. Assign the proxy
    await prisma.user.update({
        where: { id: userId },
        data: { proxyId: targetProxy.id }
    });

    console.log(`[PROXY] Assigned ${targetProxy.proxyIp} (${targetProxy.proxyCountry}) to user ${userId} (${tier} tier - Origin: ${targetCountry})`);
    return targetProxy;
};
