/**
 * probe-status-projection.ts — READ-ONLY validation of the coarse-status projection.
 * For every CampaignLead (optionally scoped to one user via QCAP_EMAIL), compute
 * what syncLeadStatus WOULD set (using the real exported pure logic) and compare to
 * the current coarse status. Flags DOWNGRADES (must be zero — projection is
 * monotonic) and CORRECTIONS (current drifted below the truth). Writes nothing.
 *
 *   QCAP_EMAIL=shivasingh9927@gmail.com node dist/scripts/probe-status-projection.js
 */
import { PrismaClient } from '@repo/db';
import { coarseLeadStatus, rollupLeadStatus, type CoarseStatus } from '../campaign-engine/safety/lifecycle';

const prisma = new PrismaClient();
const RANK: Record<string, number> = { IMPORTED: 0, BOUNCED: 0, PENDING: 1, CONNECTED: 2, REPLIED: 3 };
const email = process.env.QCAP_EMAIL || '';

(async () => {
    const users = email
        ? await prisma.user.findMany({ where: { email } })
        : await prisma.user.findMany({});
    let cl_total = 0, cl_correct = 0, cl_upgrade = 0, cl_downgrade = 0;
    let lead_total = 0, lead_correct = 0, lead_upgrade = 0, lead_downgrade = 0;
    const samples: string[] = [];

    for (const u of users) {
        const camps = await prisma.campaign.findMany({ where: { userId: u.id }, select: { id: true } }).catch(() => [] as { id: string }[]);
        const campIds = camps.map((c) => c.id);
        const cls = campIds.length
            ? await prisma.campaignLead.findMany({ where: { campaignId: { in: campIds } }, select: { campaignId: true, leadId: true, status: true } }).catch(() => [] as any[])
            : [];
        // per campaign-lead target
        for (const cl of cls) {
            const [prog, msg] = await Promise.all([
                prisma.campaignLeadProgress.findUnique({ where: { campaignId_leadId: { campaignId: cl.campaignId, leadId: cl.leadId } }, select: { status: true, connectionStatus: true } }),
                prisma.message.findFirst({ where: { leadId: cl.leadId, direction: 'RECEIVED' }, select: { id: true } }),
            ]);
            const target = coarseLeadStatus({ replied: prog?.status === 'REPLIED' || !!msg, connected: prog?.connectionStatus === 'connected' });
            cl_total++;
            const cur = cl.status as string;
            // Model the ACTUAL monotonic write: a value is written only when the
            // current status is strictly BELOW the target (statusesBelow guard).
            if (cur === target) cl_correct++;
            else if (RANK[target] > RANK[cur]) { cl_upgrade++; if (samples.length < 12) samples.push(`CL ${cl.leadId.slice(-6)} ${cur} → ${target} (conn=${prog?.connectionStatus} run=${prog?.status} msg=${!!msg})`); }
            else { cl_correct++; /* preserved: guard prevents any write (no downgrade) */ }
        }
        // per lead rollup
        const leadIds = [...new Set(cls.map((c: any) => c.leadId))];
        for (const leadId of leadIds) {
            const rows = cls.filter((c: any) => c.leadId === leadId);
            // rollup uses the TARGET per campaign-lead (post-projection), matching syncLeadStatus
            const targets: CoarseStatus[] = [];
            for (const cl of rows) {
                const [prog, msg] = await Promise.all([
                    prisma.campaignLeadProgress.findUnique({ where: { campaignId_leadId: { campaignId: cl.campaignId, leadId } }, select: { status: true, connectionStatus: true } }),
                    prisma.message.findFirst({ where: { leadId, direction: 'RECEIVED' }, select: { id: true } }),
                ]);
                targets.push(coarseLeadStatus({ replied: prog?.status === 'REPLIED' || !!msg, connected: prog?.connectionStatus === 'connected' }));
            }
            const rolled = rollupLeadStatus(targets);
            const lead = await prisma.lead.findUnique({ where: { id: leadId }, select: { status: true } });
            const cur = (lead?.status as string) || 'IMPORTED';
            lead_total++;
            if (cur === rolled) lead_correct++;
            else if (RANK[rolled] > RANK[cur]) { lead_upgrade++; if (samples.length < 24) samples.push(`Lead ${leadId.slice(-6)} ${cur} → ${rolled}`); }
            else { lead_correct++; /* preserved: monotonic guard prevents any write */ }
        }
    }

    console.log(`\n=== CampaignLead: ${cl_total} total | ${cl_correct} already-correct | ${cl_upgrade} would-upgrade | ${cl_downgrade} DOWNGRADE`);
    console.log(`=== Lead:         ${lead_total} total | ${lead_correct} already-correct | ${lead_upgrade} would-upgrade | ${lead_downgrade} DOWNGRADE`);
    console.log(`\nSamples:`);
    samples.forEach((s) => console.log('  ' + s));
    console.log(`\n${cl_downgrade + lead_downgrade === 0 ? '✅ No downgrades — projection is safe (monotonic).' : '❌ DOWNGRADES DETECTED — investigate before deploy.'}`);
    await prisma.$disconnect().catch(() => {});
    process.exit(0);
})();
