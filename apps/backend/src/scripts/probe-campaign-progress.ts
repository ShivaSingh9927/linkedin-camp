/**
 * probe-campaign-progress.ts
 *
 * Live validation of the node-graph-aware copilot status against a real account.
 * READ-ONLY: calls getCampaignProgress + describeCampaignProgress; no writes.
 *
 *   QCAP_EMAIL=shivasingh9927@gmail.com node dist/scripts/probe-campaign-progress.js
 */
import { PrismaClient } from '@repo/db';
import { getCampaignProgress, describeCampaignProgress } from '../copilot/query-tools';

const prisma = new PrismaClient();
const email = process.env.QCAP_EMAIL || 'shivasingh9927@gmail.com';

(async () => {
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) { console.error(`[probe] no user for ${email}`); process.exit(2); }
    console.log(`[probe] user=${user.id} email=${email}`);

    const p = await getCampaignProgress(user.id);
    if (!p) { console.log('[probe] no campaign found'); await prisma.$disconnect(); process.exit(1); }

    console.log('\n===== RAW CampaignProgressData =====');
    console.log(JSON.stringify(p, null, 2));

    console.log('\n===== describeCampaignProgress (what the copilot shows) =====');
    console.log(describeCampaignProgress(p, Date.now()));

    await prisma.$disconnect().catch(() => {});
    process.exit(0);
})();
