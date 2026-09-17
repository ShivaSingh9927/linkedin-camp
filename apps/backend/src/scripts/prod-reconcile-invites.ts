// Re-check a user's outstanding invitations against LinkedIn and correct our
// rows. Read-only as far as LinkedIn is concerned — browser-free topcard reads,
// no clicks, no writes. ENV: QUSER_ID
import { PrismaClient } from '@repo/db';
import { reconcilePendingInvites, countOutstandingInvites } from '../services/invite-reconcile.service';

const prisma = new PrismaClient();

async function main() {
    const userId = process.env.QUSER_ID!;
    if (!userId) { console.error('QUSER_ID required'); process.exit(2); }

    console.log(`[reconcile] outstanding before: ${await countOutstandingInvites(userId)}`);
    const r = await reconcilePendingInvites(userId, { minAgeHours: 0 });
    console.log(`[reconcile] result: ${JSON.stringify(r)}`);
    console.log(`[reconcile] outstanding after:  ${await countOutstandingInvites(userId)}`);
    await prisma.$disconnect();
}

main().catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exit(1); });
