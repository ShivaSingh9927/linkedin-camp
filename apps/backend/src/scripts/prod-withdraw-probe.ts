// Exercise the withdraw path. DRY RUN unless QWITHDRAW_LIVE=true.
// ENV: QUSER_ID, QDAYS (default 30), QMAX, QWITHDRAW_LIVE
import { PrismaClient } from '@repo/db';
import { withdrawStaleInvites } from '../workers/withdraw.worker';

const prisma = new PrismaClient();

async function main() {
    const userId = process.env.QUSER_ID!;
    if (!userId) { console.error('QUSER_ID required'); process.exit(2); }
    const olderThanDays = parseInt(process.env.QDAYS || '30', 10);
    const max = parseInt(process.env.QMAX || '20', 10);
    const dryRun = process.env.QWITHDRAW_LIVE !== 'true';

    console.log(`[probe] user=${userId} olderThan=${olderThanDays}d max=${max} dryRun=${dryRun}`);
    const r = await withdrawStaleInvites(userId, { olderThanDays, max, dryRun });
    console.log('[probe] result:', JSON.stringify(r, null, 2));
    await prisma.$disconnect();
}
main().catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exit(1); });
