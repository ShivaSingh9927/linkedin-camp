import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function run() {
    const userId = '09cae3b3-585e-4b0d-bdb1-f7be855725e1';
    const proxy = await prisma.proxy.findFirst({
        where: { proxyHost: 'disp.oxylabs.io' }
    });

    if (proxy) {
        console.log('Assigning proxy:', proxy.proxyHost);
        await prisma.user.update({
            where: { id: userId },
            data: { proxyId: proxy.id }
        });
        console.log('Proxy restored successfully.');
    } else {
        console.error('Oxylabs proxy not found in the database. Trying first available...');
        const anyProxy = await prisma.proxy.findFirst();
        if (anyProxy) {
            await prisma.user.update({
                where: { id: userId },
                data: { proxyId: anyProxy.id }
            });
            console.log('Assigned generic proxy:', anyProxy.proxyHost);
        } else {
            console.error('NO PROXIES FOUND IN DB');
        }
    }
}
run();
