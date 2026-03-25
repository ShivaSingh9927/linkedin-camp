import { prisma } from '@repo/db';

async function main() {
    try {
        const proxies = await prisma.proxy.findMany({});
        console.log('--- ALL PROXIES ---');
        proxies.forEach(p => {
            console.log(`IP: ${p.proxyIp}, Host: ${p.proxyHost}, Country: ${p.proxyCountry}, Tier: ${p.tierClass}`);
        });
        process.exit(0);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
}

main();
