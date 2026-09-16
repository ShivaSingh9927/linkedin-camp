// Send ONE connection invite WITH an AI note, synchronously, and report what
// actually happened — including whether the note text was read back out of
// LinkedIn's own note field before Send was clicked.
//
// Bypasses cron/worker so the output is immediate and attributable. Refuses to
// run against a lead that is already connected or already has an invite
// pending (the connect node would correctly no-op, which proves nothing).
//
// ENV:
//   QUSER_ID   — Qampi user (rajaji98971 = cmpposqs50000mj08zdxpcuz2)
//   QLEAD_URL  — the single lead's LinkedIn profile URL
//   QNOTE      — optional literal note; omit to let the AI write it

import { PrismaClient } from '@repo/db';
import { runCampaign } from '../campaign-engine';

const prisma = new PrismaClient();

async function main() {
    const userId  = process.env.QUSER_ID!;
    const leadUrl = process.env.QLEAD_URL!;
    const literal = process.env.QNOTE || '';
    if (!userId || !leadUrl) { console.error('QUSER_ID and QLEAD_URL required'); process.exit(2); }

    const u = await prisma.user.findUnique({
        where: { id: userId },
        select: {
            email: true, linkedinCookie: true, linkedinFingerprint: true,
            linkedinLocalStorage: true, linkedinProxySnapshot: true, accountHealth: true,
        },
    });
    if (!u) throw new Error(`user ${userId} not found`);
    if (u.accountHealth !== 'HEALTHY') throw new Error(`accountHealth=${u.accountHealth}`);

    const cookies = u.linkedinCookie ? JSON.parse(u.linkedinCookie as any) : null;
    const fp: any = u.linkedinFingerprint ? JSON.parse(u.linkedinFingerprint as any) : {};
    const ls = u.linkedinLocalStorage ? JSON.parse(u.linkedinLocalStorage as any) : null;
    const snap: any = u.linkedinProxySnapshot;
    if (!cookies?.length) throw new Error('no cookies');
    if (!snap?.server) throw new Error('no proxy snapshot pinned');

    const lead = await prisma.lead.findFirst({ where: { userId, linkedinUrl: leadUrl } });
    if (!lead) throw new Error(`no lead for ${leadUrl}`);
    console.log(`[note-test] ${u.email} → ${lead.firstName} ${lead.lastName} (${lead.id}, degree=${lead.connectionDegree}, status=${lead.status})`);

    const flow = [
        { node: 'profile-visit-voyager' as const },
        // aiEnabled with no message = AI writes the note. QNOTE overrides with
        // literal copy so the DOM half can be tested without the LLM.
        { node: 'connect' as const, aiEnabled: !literal, message: literal, tone: 'friendly' },
    ];

    const campaign = await prisma.campaign.create({
        data: {
            id: 'cmp-note-' + Date.now(),
            userId,
            name: `Invite-note test ${new Date().toISOString().slice(0, 16)}`,
            workflowJson: { nodes: flow } as any,
            status: 'ACTIVE',
            objective: 'Connect with prospects',
            toneOverride: 'friendly',
            cta: 'connect',
        },
    });
    await prisma.campaignLead.create({
        data: { id: 'cl-note-' + Date.now(), campaignId: campaign.id, leadId: lead.id, isCompleted: false },
    });
    console.log(`[note-test] campaign ${campaign.id}`);

    const summary = await runCampaign(userId, campaign.id, {
        flow,
        objective: 'Connect with prospects',
        campaignDescription: 'AI-personalised outreach',
        cta: 'connect',
        toneOverride: 'friendly',
        sessionContext: {
            cookies,
            userAgent: fp.userAgent || null,
            localStorage: ls,
            proxy: { server: snap.server, username: snap.username, password: snap.password },
        },
    } as any);

    console.log('\n===== RESULT =====');
    for (const lr of summary.leadResults) {
        console.log(`${lr.status} — ${lr.leadName}`);
        for (const n of lr.nodesExecuted) {
            console.log(`  ${n.status === 'success' ? '✓' : '✗'} ${n.node}${n.error ? ` — ${n.error}` : ''}`);
            const out: any = n.output;
            if (n.node === 'connect') {
                console.log(`      status       : ${out?.status}`);
                console.log(`      verified     : ${out?.verified === true}`);
                console.log(`      noteAttached : ${out?.noteAttached}`);
                console.log(`      note         : ${out?.note ? JSON.stringify(out.note) : '(none)'}`);
            }
        }
    }
    await prisma.$disconnect();
}

main().catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exit(1); });
