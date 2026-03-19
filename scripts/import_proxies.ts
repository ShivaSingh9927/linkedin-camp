import { prisma } from '../packages/db';
import * as fs from 'fs';
import * as path from 'path';

async function main() {
    const proxyListPath = path.join(__dirname, '../Proxy lists.json');
    const proxyData = JSON.parse(fs.readFileSync(proxyListPath, 'utf8'));

    const username = "user-shivasingh_clgdY";
    const password = "Iamironman_3";

    console.log(`Starting import of ${proxyData.length} proxies...`);

    for (const p of proxyData) {
        const proxyIdStr = `${p.entryPoint}:${p.port}@${username}`;

        try {
            const created = await prisma.proxy.upsert({
                where: { proxyIp: proxyIdStr },
                update: {
                    proxyHost: p.entryPoint,
                    proxyPort: p.port,
                    proxyUsername: username,
                    proxyPassword: password,
                    proxyCountry: p.countryCode,
                    tierClass: 'RESIDENTIAL',
                    maxUsers: 5, // Typical for high-quality proxies
                },
                create: {
                    proxyIp: proxyIdStr,
                    proxyHost: p.entryPoint,
                    proxyPort: p.port,
                    proxyUsername: username,
                    proxyPassword: password,
                    proxyCountry: p.countryCode,
                    tierClass: 'RESIDENTIAL',
                    maxUsers: 5,
                }
            });
            console.log(`✅ ${created.proxyHost}:${created.proxyPort} (${created.proxyCountry}) imported as ${created.tierClass}.`);
        } catch (e) {
            console.error(`❌ Failed to import ${p.ip}:`, e);
        }
    }

    // Also, let's auto-upgrade the latest user to ADVANCED tier to test this
    const latestUser = await prisma.user.findFirst({
        orderBy: { createdAt: 'desc' }
    });

    if (latestUser) {
        await prisma.user.update({
            where: { id: latestUser.id },
            data: { tier: 'ADVANCED' }
        });
        console.log(`🚀 Upgraded user ${latestUser.email} to ADVANCED tier.`);
    }

    process.exit(0);
}

main().catch(err => {
    console.error(err);
    process.exit(1);
});
