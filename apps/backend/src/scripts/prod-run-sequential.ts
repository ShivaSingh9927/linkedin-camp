// Run a sequential message campaign across N users sharing the same proxy.
// Creates a per-user campaign + lead, then invokes runCampaign() one user
// at a time and prints a consolidated summary. Intentionally bypasses the
// cron+worker pipeline so the output is synchronous and easy to read.
//
// ENV:
//   QUSER_IDS  — comma-separated Qampi user ids (order = run order)
//   QLEAD_URL  — LinkedIn profile URL (default shiva-singh-genai-llm)
//   QCAMP_NAME — display name (default "AI seq test <ts>")

import { PrismaClient } from '@repo/db';
import { runCampaign } from '../campaign-engine';

const prisma = new PrismaClient();

async function ensureLeadAndCampaign(userId: string, leadUrl: string, name: string) {
    let lead = await prisma.lead.findFirst({ where: { userId, linkedinUrl: leadUrl } });
    if (!lead) {
        lead = await prisma.lead.create({
            data: {
                id: 'lead-' + Date.now() + '-' + Math.floor(Math.random()*1e4),
                userId, linkedinUrl: leadUrl,
                firstName: 'Shiva', lastName: 'Singh',
                updatedAt: new Date(),
            },
        });
    }

    const workflowNodes = [
        { node: 'profile-visit' },
        { node: 'send-message', aiEnabled: true, tone: 'professional', cta: 'connect' },
    ];

    const campaign = await prisma.campaign.create({
        data: {
            id: 'cmp-' + Date.now() + '-' + Math.floor(Math.random()*1e4),
            userId, name,
            workflowJson: { nodes: workflowNodes } as any,
            status: 'ACTIVE',
            objective: 'Connect with prospects',
            toneOverride: 'professional',
            cta: 'connect',
        },
    });

    await prisma.campaignLead.create({
        data: {
            id: 'cl-' + Date.now() + '-' + Math.floor(Math.random()*1e4),
            campaignId: campaign.id,
            leadId: lead.id,
            isCompleted: false,
        },
    });

    return { campaign, lead };
}

async function loadSession(userId: string) {
    const u = await prisma.user.findUnique({
        where: { id: userId },
        select: {
            email: true,
            linkedinCookie: true,
            linkedinFingerprint: true,
            linkedinLocalStorage: true,
            linkedinProxySnapshot: true,
            accountHealth: true,
        },
    });
    if (!u) throw new Error(`user ${userId} not found`);
    if (u.accountHealth !== 'HEALTHY') {
        throw new Error(`user ${userId} accountHealth=${u.accountHealth} — must be HEALTHY before launch`);
    }
    let cookies: any = null;
    try { cookies = u.linkedinCookie ? JSON.parse(u.linkedinCookie as any) : null; } catch {}
    let fp: any = {};
    try { fp = u.linkedinFingerprint ? JSON.parse(u.linkedinFingerprint as any) : {}; } catch {}
    let ls: any = null;
    try { ls = u.linkedinLocalStorage ? JSON.parse(u.linkedinLocalStorage as any) : null; } catch {}
    const snap: any = u.linkedinProxySnapshot;
    if (!cookies?.length) throw new Error(`user ${userId} has no cookies`);
    if (!snap?.server) throw new Error(`user ${userId} has no proxy snapshot pinned`);
    return {
        email: u.email,
        cookies,
        userAgent: fp.userAgent || null,
        localStorage: ls,
        proxy: { server: snap.server, username: snap.username, password: snap.password },
    };
}

async function main() {
    const userIds = (process.env.QUSER_IDS || '').split(',').filter(Boolean);
    const leadUrl = process.env.QLEAD_URL || 'https://www.linkedin.com/in/shiva-singh-genai-llm/';
    const baseName = process.env.QCAMP_NAME || `AI seq test ${new Date().toISOString().slice(0,16)}`;
    if (userIds.length === 0) { console.error('QUSER_IDS required (comma-separated)'); process.exit(2); }

    const results: any[] = [];

    for (let i = 0; i < userIds.length; i++) {
        const userId = userIds[i];
        console.log(`\n${'='.repeat(60)}\n=== [${i+1}/${userIds.length}] user ${userId}\n${'='.repeat(60)}`);

        try {
            const sess = await loadSession(userId);
            console.log(`[seq] loaded session for ${sess.email} (${sess.cookies.length} cookies, proxy=${sess.proxy.server})`);

            const { campaign } = await ensureLeadAndCampaign(userId, leadUrl, `${baseName} — ${sess.email}`);
            console.log(`[seq] created campaign ${campaign.id}`);

            const workflowNodes = [
                { node: 'profile-visit' as const },
                { node: 'send-message' as const, aiEnabled: true, tone: 'professional', cta: 'connect' as const },
            ];

            const config = {
                flow: workflowNodes,
                objective: 'Connect with prospects',
                campaignDescription: 'AI-powered personalized outreach',
                cta: 'connect',
                toneOverride: 'professional',
                persona: undefined,
                valueProp: undefined,
                sessionContext: {
                    cookies: sess.cookies,
                    userAgent: sess.userAgent,
                    localStorage: sess.localStorage,
                    proxy: sess.proxy,
                },
            };

            const summary = await runCampaign(userId, campaign.id, config as any);
            results.push({ userId, email: sess.email, campaignId: campaign.id, summary });

            console.log(`[seq] user ${userId}: succeeded=${summary.succeeded}/${summary.totalLeads}`);
        } catch (err: any) {
            console.error(`[seq] user ${userId} FAILED: ${err.message}`);
            results.push({ userId, error: err.message });
        }
    }

    console.log(`\n${'='.repeat(60)}\n=== SEQUENTIAL RUN SUMMARY\n${'='.repeat(60)}`);
    for (const r of results) {
        if (r.error) {
            console.log(`✗ ${r.userId}: ${r.error}`);
        } else {
            const s = r.summary;
            console.log(`${s.succeeded === s.totalLeads ? '✓' : '⚠'} ${r.email} (${r.userId}): ${s.succeeded}/${s.totalLeads} succeeded`);
            for (const lr of s.leadResults) {
                console.log(`    ${lr.status === 'completed' ? '✓' : '✗'} ${lr.leadName}: ${lr.nodesExecuted.map((n: any) => `${n.node}(${n.status})`).join(' → ')}`);
                for (const n of lr.nodesExecuted) {
                    if (n.status === 'failed') console.log(`        ✗ ${n.node}: ${n.error}`);
                    const out = n.output as any;
                    if (out?.messageText) console.log(`        ✉ "${out.messageText.substring(0, 100).replace(/\n/g, ' ')}..."`);
                }
            }
        }
    }

    await prisma.$disconnect();
}

main().catch(e => { console.error(e); process.exit(1); });
