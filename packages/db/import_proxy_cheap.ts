import { PrismaClient } from '@prisma/client';
import fs from 'fs';
import path from 'path';

const prisma = new PrismaClient();

async function main() {
    console.log('🗑️ Deleting all existing proxies...');
    await prisma.proxy.deleteMany({});

    const filePath = path.join(__dirname, '../../proxy_cheap.txt');
    if (!fs.existsSync(filePath)) {
        console.error('❌ proxy_cheap.txt not found!');
        return;
    }

    const content = fs.readFileSync(filePath, 'utf-8');
    const lines = content.split('\n');

    let username = '';
    let password = '';
    let ip = '';
    let port = 0;

    for (const line of lines) {
        if (line.startsWith('username:')) username = line.split(':')[1].trim();
        if (line.startsWith('password:')) password = line.split(':')[1].trim();
        if (line.startsWith('IP Address:')) ip = line.split(':')[1].trim();
        if (line.startsWith('port:')) port = parseInt(line.split(':')[1].trim());
    }

    if (ip && port) {
        console.log(`📥 Importing proxy: ${ip}:${port}`);
        await prisma.proxy.create({
            data: {
                proxyIp: ip,
                proxyHost: ip,
                proxyPort: port,
                proxyUsername: username,
                proxyPassword: password,
                proxyCountry: 'IN', // Assuming IN or generic
                tierClass: 'RESIDENTIAL',
                maxUsers: 15,
                isAssigned: false
            }
        });
        console.log('✅ Proxy imported successfully.');
    } else {
        console.error('❌ Failed to parse proxy details from file.');
    }
}

main().catch(console.error).finally(() => prisma.$disconnect());
