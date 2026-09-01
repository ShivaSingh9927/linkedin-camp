/**
 * backfill-connected-degree.ts — ONE-TIME corrective recompute of coarse status
 * after "connected" was redefined as genuine 1st-degree (connectionDegree===1)
 * rather than connectionStatus==='connected' (which also counts Open-Profile
 * messability). syncLeadStatus is monotonic (upgrade-only), so it can't fix rows
 * already sitting too high — this script can, but CONSERVATIVELY:
 *
 *   replied (progress REPLIED or inbound msg)  → REPLIED
 *   connectionDegree === 1                     → CONNECTED
 *   connectionDegree === 2 or 3 (explicit not-1st) → PENDING   ← the only downgrade
 *   connectionDegree null/unknown              → LEAVE AS-IS    ← never risk it
 *
 * So the only rows it lowers are ones LinkedIn explicitly told us are 2nd/3rd
 * degree — i.e. Open-Profile leads mislabelled as connections. A genuine
 * connection whose degree was never persisted (null) is left untouched.
 *
 *   QCAP_EMAIL=foo@bar.com node dist/scripts/backfill-connected-degree.js   (one user)
 *   node dist/scripts/backfill-connected-degree.js                          (all users)
 */
import { PrismaClient } from '@repo/db';
import { rollupLeadStatus, type CoarseStatus } from '../campaign-engine/safety/lifecycle';

const prisma = new PrismaClient();
const email = process.env.QCAP_EMAIL || '';

async function dist(model: 'campaignLead' | 'lead', campIds?: string[], leadIds?: string[]) {
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
        ? await prisma.user.findMany({ where: { email }, select: { id: true } })
        : await prisma.user.findMany({ select: { id: true } });
    const userIds = users.map((u) => u.id);
    const camps = await prisma.campaign.findMany({ where: { userId: { in: userIds } }, select: { id: true } });
    const campIds = camps.map((c) => c.id);
    const cls = campIds.length
        ? await prisma.campaignLead.findMany({ where: { campaignId: { in: campIds } }, select: { campaignId: true, leadId: true, status: true } })
        : [];
    const leadIds = [...new Set(cls.map((c) => c.leadId))];

    console.log(`Scope: ${email || 'ALL USERS'} | ${campIds.length} campaigns, ${cls.length} campaign-leads, ${leadIds.length} leads`);
    console.log(`BEFORE CampaignLead: ${await dist('campaignLead', campIds)}`);
    console.log(`BEFORE Lead:         ${await dist('lead', undefined, leadIds)}`);

    // Degrees for every lead in scope (the acceptance truth).
    const degRows = await prisma.lead.findMany({ where: { id: { in: leadIds } }, select: { id: true, connectionDegree: true } });
    const degByLead = new Map(degRows.map((l) => [l.id, l.connectionDegree]));

    const changed: string[] = [];
    const touchedLeads = new Set<string>();
    let clChanges = 0, downgrades = 0;

    for (const cl of cls) {
        const [prog, msg] = await Promise.all([
            prisma.campaignLeadProgress.findUnique({ where: { campaignId_leadId: { campaignId: cl.campaignId, leadId: cl.leadId } }, select: { status: true } }).catch(() => null),
            prisma.message.findFirst({ where: { leadId: cl.leadId, direction: 'RECEIVED' }, select: { id: true } }).catch(() => null),
        ]);
        const replied = prog?.status === 'REPLIED' || !!msg;
        const degree = degByLead.get(cl.leadId);

        let target: CoarseStatus | null;
        if (replied) target = 'REPLIED';
        else if (degree === 1) target = 'CONNECTED';
        else if (degree === 2 || degree === 3) target = 'PENDING'; // the correction
        else target = null; // unknown degree → leave untouched

        if (target && target !== cl.status) {
            const rank: Record<string, number> = { IMPORTED: 0, BOUNCED: 0, PENDING: 1, CONNECTED: 2, REPLIED: 3 };
            if (rank[target] < rank[cl.status]) downgrades++;
            await prisma.campaignLead.updateMany({ where: { campaignId: cl.campaignId, leadId: cl.leadId }, data: { status: target } }).catch(() => {});
            cl.status = target; // keep in-memory copy current for the rollup below
            clChanges++;
            touchedLeads.add(cl.leadId);
            if (changed.length < 20) changed.push(`CL ${cl.leadId.slice(-6)} → ${target} (deg=${degree ?? '?'} replied=${replied})`);
        }
    }

    // Recompute Lead.status ONLY for leads we actually touched — rollup of their
    // (now-updated) campaign-lead statuses, allowing downgrade.
    let leadChanges = 0;
    for (const leadId of touchedLeads) {
        const rows = cls.filter((c) => c.leadId === leadId).map((c) => c.status as CoarseStatus);
        const rolled = rollupLeadStatus(rows);
        const res = await prisma.lead.updateMany({ where: { id: leadId, status: { not: rolled } }, data: { status: rolled } }).catch(() => ({ count: 0 }));
        if ((res as any).count) leadChanges++;
    }

    console.log(`\nCampaignLead changed: ${clChanges} (${downgrades} downgrades) | Lead changed: ${leadChanges}`);
    console.log(`AFTER  CampaignLead: ${await dist('campaignLead', campIds)}`);
    console.log(`AFTER  Lead:         ${await dist('lead', undefined, leadIds)}`);
    console.log(`\nSample changes:`);
    changed.forEach((s) => console.log('  ' + s));
    await prisma.$disconnect().catch(() => {});
    process.exit(0);
})();
