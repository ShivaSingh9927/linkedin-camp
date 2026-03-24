import { PrismaClient } from '@prisma/client';
import fs from 'fs';
import path from 'path';

const prisma = new PrismaClient();

async function main() {
    const proxiesFile = path.join(__dirname, '../../Proxy_lists.json');
    if (!fs.existsSync(proxiesFile)) {
        console.error('❌ Proxy lists.json not found in root!');
        console.log('Searching at:', proxiesFile);
        return;
    }

    const proxiesData = JSON.parse(fs.readFileSync(proxiesFile, 'utf-8'));
    console.log(`Found ${proxiesData.length} proxies to import...`);

    for (const p of proxiesData) {
        await prisma.proxy.upsert({
            where: { proxyIp: String(p.ip) },
            update: {
                proxyHost: p.entryPoint,
                proxyPort: p.port,
                proxyUsername: 'user-shivasingh_clgdY',
                proxyPassword: 'Iamironman_3',
                proxyCountry: 'IN',
                tierClass: 'RESIDENTIAL'
            },
            create: {
                proxyIp: String(p.ip),
                proxyHost: p.entryPoint,
                proxyPort: p.port,
                proxyUsername: 'user-shivasingh_clgdY',
                proxyPassword: 'Iamironman_3',
                proxyCountry: 'IN',
                tierClass: 'RESIDENTIAL',
                maxUsers: 15
            }
        });
    }

    console.log('✅ Oxylabs ISP Proxies imported successfully.');
}

main().catch(console.error).finally(() => prisma.$disconnect());
