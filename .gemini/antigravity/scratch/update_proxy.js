const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    // 1. Delete all existing proxies
    console.log('Cleaning up old proxies...');
    await prisma.proxy.deleteMany({});

    // 2. Add the new proxy from proxy_cheap.txt
    const newProxy = {
        proxyIp: '82.41.252.111',
        proxyHost: '82.41.252.111',
        proxyPort: 46222,
        proxyUsername: 'xBVyYdUpx84nWx7',
        proxyPassword: 'dwwTxtvv5a10RXn',
        proxyCountry: 'GB', // 82.41... is UK/GB usually, or just leave as null
        tierClass: 'ECONOMY', // Setting to ECONOMY since the logs were looking for ECONOMY
        maxUsers: 15
    };

    console.log('Adding new residential proxy:', newProxy.proxyIp);
    await prisma.proxy.create({
        data: newProxy
    });

    console.log('✅ Proxy successfully updated.');
}

main().catch(console.error).finally(() => prisma.$disconnect());
