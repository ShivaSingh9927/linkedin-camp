// Run a real multi-lead campaign and report where the safety gates fired.
//
// Purpose is the CAPS, not the actions: the flow is deliberately short
// (visit → like → connect) and the lead count deliberately above the hourly
// connect ceiling, so the rolling-hour gate has to trip partway through and
// the remaining leads must park rather than fail.
//
// ENV:
//   QUSER_ID     — Qampi user
//   QLEAD_LIMIT  — how many leads (default 10)

import { PrismaClient } from '@repo/db';
import { runCampaign } from '../campaign-engine';
import { DAILY_CAPS, HOURLY_CAPS, HOURLY_TOTAL_CAP, WEEKLY_CAPS, getHourlyCount, getDailyCount, getWeeklyCount, rampedDailyCap } from '../campaign-engine/safety/quota';
import { getRampState, resetRampCache } from '../campaign-engine/safety/rampup';

const prisma = new PrismaClient();

async function budget(userId: string, label: string) {
    const rows: string[] = [];
    for (const action of ['connect', 'like-nth-post', 'profile-visit-voyager'] as const) {
        const [d, h] = await Promise.all([getDailyCount(userId, action), getHourlyCount(userId, action)]);
        rows.push(`${action}: ${h}/${HOURLY_CAPS[action]}h ${d}/${DAILY_CAPS[action]}d`);
    }
    const total = await getHourlyCount(userId);
    console.log(`[caps] ${label} — ${rows.join(' | ')} | combined ${total}/${HOURLY_TOTAL_CAP}h`);

    const week = await getWeeklyCount(userId, 'connect');
    resetRampCache();
    const ramp = await getRampState(userId);
    const todayCap = await rampedDailyCap(userId, 'connect');
    console.log(`[caps] ${label} — connect week ${week}/${WEEKLY_CAPS['connect']} | RAMP cap=${ramp.cap} `
        + `(reason=${ramp.reason}, day=${ramp.daysActive}, schedule=${ramp.scheduled}, pace=${ramp.paceCeiling}, `
        + `acceptance=${ramp.acceptanceRate === null ? 'n/a' : Math.round(ramp.acceptanceRate * 100) + '%'}) `
        + `→ today's effective cap ${todayCap} (ceiling ${DAILY_CAPS['connect']})`);
}

async function main() {
    const userId = process.env.QUSER_ID!;
    const limit = parseInt(process.env.QLEAD_LIMIT || '10', 10);
    if (!userId) { console.error('QUSER_ID required'); process.exit(2); }

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

    // Never-actioned 2nd-degree leads only: an already-pending lead is skipped
    // by connect's own guard, which would quietly under-count the gate test.
    const leads = await prisma.lead.findMany({
        where: { userId, status: 'IMPORTED', connectionDegree: 2 },
        take: limit,
        orderBy: { updatedAt: 'desc' },
    });
    if (!leads.length) throw new Error('no eligible IMPORTED 2nd-degree leads');
    console.log(`[caps] ${u.email}: ${leads.length} leads → ${leads.map(l => l.firstName).join(', ')}`);

    await budget(userId, 'BEFORE');

    const flow = [
        { node: 'profile-visit-voyager' as const },
        { node: 'like-nth-post' as const, n: 1 },
        { node: 'connect' as const, aiEnabled: true, tone: 'friendly' },
    ];

    const campaign = await prisma.campaign.create({
        data: {
            id: 'cmp-caps-' + Date.now(),
            userId,
            name: `Caps test ${new Date().toISOString().slice(0, 16)}`,
            workflowJson: { nodes: flow } as any,
            status: 'ACTIVE',
            objective: 'Connect with prospects',
            toneOverride: 'friendly',
            cta: 'connect',
        },
    });
    for (const lead of leads) {
        await prisma.campaignLead.create({
            data: { id: 'cl-caps-' + lead.id.slice(-8) + '-' + Date.now(), campaignId: campaign.id, leadId: lead.id, isCompleted: false },
        });
    }
    console.log(`[caps] campaign ${campaign.id}`);

    const summary = await runCampaign(userId, campaign.id, {
        flow,
        objective: 'Connect with prospects',
        campaignDescription: 'AI-personalised outreach',
        cta: 'connect',
        toneOverride: 'friendly',
        sessionContext: {
            cookies, userAgent: fp.userAgent || null, localStorage: ls,
            proxy: { server: snap.server, username: snap.username, password: snap.password },
        },
    } as any);

    await budget(userId, 'AFTER');

    console.log('\n===== PER-LEAD =====');
    for (const lr of summary.leadResults) {
        const nodes = lr.nodesExecuted.map((n: any) => `${n.node}(${n.status})`).join(' → ');
        console.log(`${lr.status.padEnd(9)} ${(lr.pausedReason || '').padEnd(12)} ${lr.leadName}: ${nodes}`);
    }
    console.log(`\nsucceeded=${summary.succeeded} parked=${summary.parked} failed=${summary.failed} of ${summary.totalLeads}`);

    // The gate is the point — count what parked because of it.
    const paced = summary.leadResults.filter((r: any) => r.pausedReason === 'hourly_cap').length;
    console.log(paced > 0
        ? `\n✅ hourly burst gate fired on ${paced} lead(s) — they are parked, not failed.`
        : `\n⚠ hourly burst gate never fired (not enough actions to reach a ceiling).`);

    await prisma.$disconnect();
}

main().catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exit(1); });
