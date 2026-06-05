// One-shot: re-run profile-visit enrichment over an existing campaign's leads
// to repopulate headline/jobTitle/company/etc. with the fixed scraper. Visits
// only (no messaging). Reuses ONE authenticated context for all leads so the
// sticky login proxy is honoured at launch level (never per-lead relaunch).
//
//   docker exec backend-worker node dist/scripts/prod-reenrich.js
//
// ENV:
//   QUSER_ID  — Qampi User.id whose LinkedIn session to use
//   QCAMP_ID  — Campaign.id whose CampaignLeads to re-enrich
//   QLIMIT    — (optional) max leads to process (default all)

import { PrismaClient } from '@repo/db';
import { launchAuthenticatedContext } from '../campaign-engine/session-launch';
import { profileVisit } from '../campaign-engine/nodes/profile-visit';
import { updateLeadEnrichment } from '../campaign-engine/storage';

const prisma = new PrismaClient();
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
const rnd = (a: number, b: number) => Math.floor(Math.random() * (b - a + 1) + a);

async function main() {
    const userId = process.env.QUSER_ID!;
    const campaignId = process.env.QCAMP_ID!;
    const limit = process.env.QLIMIT ? parseInt(process.env.QLIMIT, 10) : undefined;
    if (!userId || !campaignId) throw new Error('QUSER_ID and QCAMP_ID are required');

    const campaignLeads = await prisma.campaignLead.findMany({
        where: { campaignId },
        include: { Lead: true },
        ...(limit ? { take: limit } : {}),
    });
    console.log(`[reenrich] ${campaignLeads.length} leads in campaign ${campaignId}`);

    const launch = await launchAuthenticatedContext(userId);
    if (!launch.ok) {
        console.log(`[reenrich] LAUNCH_FAILED at=${launch.failedAt} err=${launch.error}`);
        await prisma.$disconnect();
        process.exit(2);
    }
    const { browser, context, page } = launch;

    let ok = 0;
    try {
        for (const cl of campaignLeads) {
            const lead: any = (cl as any).Lead;
            if (!lead?.linkedinUrl) continue;
            const before = `title=${lead.jobTitle ?? '∅'} | company=${lead.company ?? '∅'} | headline=${(lead.headline ?? '∅').toString().slice(0, 40)}`;
            try {
                const res = await profileVisit(
                    { page, context, lead, userId, campaignId, storedOutputs: {} } as any,
                    { node: 'profile-visit' } as any
                );
                if (res.success && res.output) {
                    await updateLeadEnrichment(lead.id, res.output);
                    ok++;
                    const o: any = res.output;
                    console.log(`\n✓ ${lead.firstName} ${lead.lastName ?? ''}`);
                    console.log(`   before: ${before}`);
                    console.log(`   after : title=${o.jobTitle ?? '∅'} | company=${o.company ?? '∅'} | headline=${(o.headline ?? '∅').toString().slice(0, 40)}`);
                } else {
                    console.log(`\n✗ ${lead.firstName} ${lead.lastName ?? ''} — ${res.error ?? 'no output'}`);
                }
            } catch (e: any) {
                console.log(`\n✗ ${lead.firstName} — ERROR ${e?.message}`);
            }
            await wait(rnd(6000, 11000)); // human-like gap between profiles
        }
    } finally {
        await context.close().catch(() => {});
        await browser.close().catch(() => {});
        await prisma.$disconnect();
    }
    console.log(`\n[reenrich] done — ${ok}/${campaignLeads.length} enriched`);
    process.exit(0);
}

main().catch(async (e) => {
    console.error('[reenrich] fatal', e);
    await prisma.$disconnect();
    process.exit(1);
});
