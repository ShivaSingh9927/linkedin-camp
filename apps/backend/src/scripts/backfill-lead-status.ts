/**
 * backfill-lead-status.ts — ONE-TIME projection backfill.
 *
 * Re-runs the canonical syncLeadStatus projection over EVERY campaign-lead once,
 * so coarse CampaignLead.status + Lead.status catch up to the execution truth
 * (CampaignLeadProgress.connectionStatus + inbound Message). Needed because leads
 * that went terminal BEFORE the projection was wired have no future event to
 * trigger re-projection, so their coarse status stays stale (e.g. shows PENDING
 * when the lead actually connected).
 *
 * SAFE: syncLeadStatus is strictly monotonic (statusesBelow guard) — it only ever
 * upgrades a status toward the truth, never downgrades. Validated read-only by
 * probe-status-projection.ts (0 downgrades).
 *
 * Optional scope to one user: QCAP_EMAIL=foo@bar.com node dist/scripts/backfill-lead-status.js
 * No QCAP_EMAIL = all users.
 */
import { PrismaClient } from '@repo/db';
import { syncLeadStatus } from '../campaign-engine/safety/lifecycle';

const prisma = new PrismaClient();
const email = process.env.QCAP_EMAIL || '';

async function countByStatus(model: 'campaignLead' | 'lead', campIds?: string[], leadIds?: string[]) {
    const where: any = {};
    if (model === 'campaignLead' && campIds) where.campaignId = { in: campIds };
    if (model === 'lead' && leadIds) where.id = { in: leadIds };
    const rows = model === 'campaignLead'
        ? await prisma.campaignLead.groupBy({ by: ['status'], where, _count: { _all: true } })
        : await prisma.lead.groupBy({ by: ['status'], where, _count: { _all: true } });
    return rows.map((r: any) => `${r.status}:${r._count._all}`).sort().join(' ');
}

(async () => {
    const users = email
        ? await prisma.user.findMany({ where: { email }, select: { id: true, email: true } })
        : await prisma.user.findMany({ select: { id: true, email: true } });

    const userIds = users.map((u) => u.id);
    const camps = await prisma.campaign.findMany({ where: { userId: { in: userIds } }, select: { id: true } });
    const campIds = camps.map((c) => c.id);
    const cls = campIds.length
        ? await prisma.campaignLead.findMany({ where: { campaignId: { in: campIds } }, select: { campaignId: true, leadId: true } })
        : [];
    const leadIds = [...new Set(cls.map((c) => c.leadId))];

    console.log(`Scope: ${email || 'ALL USERS'} | ${users.length} users, ${campIds.length} campaigns, ${cls.length} campaign-leads, ${leadIds.length} distinct leads`);
    console.log(`BEFORE CampaignLead: ${await countByStatus('campaignLead', campIds)}`);
    console.log(`BEFORE Lead:         ${await countByStatus('lead', undefined, leadIds)}`);

    let done = 0, failed = 0;
    for (const cl of cls) {
        try {
            await syncLeadStatus(cl.campaignId, cl.leadId);
            done++;
        } catch (e: any) {
            failed++;
            console.log(`  FAIL ${cl.campaignId.slice(-6)}/${cl.leadId.slice(-6)}: ${e?.message}`);
        }
        if (done % 100 === 0) console.log(`  ...${done}/${cls.length}`);
    }

    console.log(`\nProjected ${done} campaign-leads (${failed} failed)`);
    console.log(`AFTER  CampaignLead: ${await countByStatus('campaignLead', campIds)}`);
    console.log(`AFTER  Lead:         ${await countByStatus('lead', undefined, leadIds)}`);
    await prisma.$disconnect().catch(() => {});
    process.exit(0);
})();
