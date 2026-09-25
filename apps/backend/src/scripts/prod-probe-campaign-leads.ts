// Ask LinkedIn what actually happened to a campaign's leads — READ ONLY.
//
// Deliberately NOT reconcilePendingInvites: that one corrects our rows as it
// goes, and writing the answer into the database before the campaign's own
// CHECK_CONNECTION node runs would let the gate pass by reading our write
// instead of its own probe. The measurement would create the result. This
// script touches nothing: browser-free topcard reads, no clicks, no updates.
//
// Use it to establish ground truth BEFORE a scheduled run, so the run can be
// graded against a known answer rather than merely observed.
//
// ENV: QCAMPAIGN_ID (required), QUSER_ID (required)
import { PrismaClient } from '@repo/db';
import { getMemberRelationship, getBrowserlessVoyagerContext } from '../services/voyager-api.service';

const prisma = new PrismaClient();

const vanityOf = (url: string): string | null =>
    (url || '').match(/\/in\/([^/?#]+)/)?.[1]?.toLowerCase() || null;

async function main() {
    const campaignId = process.env.QCAMPAIGN_ID;
    const userId = process.env.QUSER_ID;
    if (!campaignId || !userId) { console.error('QCAMPAIGN_ID and QUSER_ID required'); process.exit(2); }

    const rows = await prisma.campaignLead.findMany({
        where: { campaignId },
        select: { leadId: true, Lead: { select: { firstName: true, lastName: true, linkedinUrl: true } } },
    });

    const progress = await prisma.campaignLeadProgress.findMany({
        where: { campaignId },
        select: { leadId: true, connectionStatus: true, status: true, currentNodeIndex: true },
    });
    const byLead = new Map(progress.map((p) => [p.leadId, p]));

    console.log(`\n${rows.length} leads in ${campaignId}\n`);
    console.log('name                      | ours          | LinkedIn says            | verdict');
    console.log('--------------------------+---------------+--------------------------+------------------');

    const bl = await getBrowserlessVoyagerContext(userId);
    if (!bl) { console.error('no browser-free session — is LinkedIn connected?'); process.exit(1); }

    try {
        for (const r of rows) {
            const name = `${r.Lead?.firstName || ''} ${r.Lead?.lastName || ''}`.trim().slice(0, 25);
            const vanity = vanityOf(r.Lead?.linkedinUrl || '');
            const ours = byLead.get(r.leadId)?.connectionStatus || '?';

            if (!vanity) { console.log(`${name.padEnd(25)} | ${ours.padEnd(13)} | (no vanity)              | SKIP`); continue; }

            const rel = await getMemberRelationship(userId, vanity, null, bl.ctx);
            const live = rel
                ? `distance=${rel.distance ?? '?'} pending=${rel.pendingInvite ?? '?'}`
                : 'unreachable';

            // The verdict is the point: where our stored state and LinkedIn
            // disagree is exactly what the campaign will get wrong.
            let verdict = 'unknown';
            if (!rel) verdict = 'COULD NOT READ';
            else if (rel.connected) verdict = ours === 'connected' ? 'accepted (in sync)' : 'ACCEPTED — ours stale';
            else if (rel.pendingInvite === true) verdict = ours === 'pending' ? 'still pending (in sync)' : 'PENDING — ours stale';
            else if (rel.pendingInvite === false) verdict = 'no invite exists';

            console.log(`${name.padEnd(25)} | ${ours.padEnd(13)} | ${live.padEnd(24)} | ${verdict}`);
            // Space the reads out; this is the same rate-limited path the
            // engine uses and there is no hurry.
            await new Promise((res) => setTimeout(res, 1500 + Math.random() * 1500));
        }
    } finally {
        await bl.dispose().catch(() => {});
    }

    console.log('\n(read-only — nothing was written)');
    await prisma.$disconnect();
}

main().catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exit(1); });
