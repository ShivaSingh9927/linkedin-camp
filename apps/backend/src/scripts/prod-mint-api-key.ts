// Mint a public-API key for a user and print the plaintext ONCE.
// ENV: QUSER_ID, QKEY_NAME
import { PrismaClient } from '@repo/db';
import { generateApiKey } from '../services/api-key.service';

const prisma = new PrismaClient();

async function main() {
    const userId = process.env.QUSER_ID!;
    if (!userId) { console.error('QUSER_ID required'); process.exit(2); }
    const name = process.env.QKEY_NAME || 'api-smoke-test';
    const { key, keyHash, prefix } = generateApiKey();
    const row = await prisma.apiKey.create({
        data: { userId, name, keyHash, prefix },
        select: { id: true, prefix: true },
    });
    console.log(`KEY_ID=${row.id}`);
    console.log(`KEY=${key}`);
    await prisma.$disconnect();
}
main().catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exit(1); });
