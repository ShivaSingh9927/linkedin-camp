import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    await prisma.proxy.deleteMany({});
    await prisma.proxy.create({
        data: {
            proxyIp: 'disp.oxylabs.io',
            proxyHost: 'disp.oxylabs.io',
            proxyPort: 8001,
            proxyUsername: 'user-shivasingh_clgdY',
            proxyPassword: 'Iamironman_3',
            proxyCountry: 'IN',
            tierClass: 'RESIDENTIAL',
            maxUsers: 15,
            isAssigned: true
        }
    });
    console.log('✅ Oxylabs proxy seeded!');
}

main().catch(console.error).finally(() => prisma.$disconnect());
