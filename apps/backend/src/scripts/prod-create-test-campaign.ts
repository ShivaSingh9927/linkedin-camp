// Create an AI-message campaign for a single user with the shiva lead.
// Idempotent on (userId, leadUrl) — reuses the lead if it already exists.
// Prints the campaign id; the cron picks it up on the next tick (or run
// runCampaign directly from another harness if you need synchronous output).
//
// ENV:
//   QUSER_ID    — Qampi user
//   QCAMP_NAME  — campaign display name
//   QLEAD_URL   — LinkedIn profile URL (default shiva-singh-genai-llm)
//   QSTATUS     — DRAFT or ACTIVE (default ACTIVE so the cron runs it)

import { PrismaClient } from '@repo/db';

const prisma = new PrismaClient();

async function main() {
    const userId    = process.env.QUSER_ID!;
    const name      = process.env.QCAMP_NAME || `AI message test ${new Date().toISOString().slice(0,16)}`;
    const leadUrl   = process.env.QLEAD_URL || 'https://www.linkedin.com/in/shiva-singh-genai-llm/';
    const status    = (process.env.QSTATUS || 'ACTIVE') as any;
    if (!userId) { console.error('QUSER_ID required'); process.exit(2); }

    let lead = await prisma.lead.findFirst({
        where: { userId, linkedinUrl: leadUrl },
    });
    if (!lead) {
        lead = await prisma.lead.create({
            data: {
                id: 'lead-' + Date.now() + '-' + Math.floor(Math.random()*1e4),
                userId,
                linkedinUrl: leadUrl,
                firstName: 'Shiva',
                lastName: 'Singh',
                updatedAt: new Date(),
            },
        });
        console.log(`[campaign] created lead ${lead.id}`);
    } else {
        console.log(`[campaign] reusing lead ${lead.id}`);
    }

    const workflowNodes = [
        { node: 'profile-visit' },
        { node: 'send-message', aiEnabled: true, tone: 'professional', cta: 'connect' },
    ];

    const campaign = await prisma.campaign.create({
        data: {
            id: 'cmp-' + Date.now() + '-' + Math.floor(Math.random()*1e4),
            userId,
            name,
            workflowJson: { nodes: workflowNodes } as any,
            status,
            objective: 'Connect with prospects',
            toneOverride: 'professional',
            cta: 'connect',
        },
    });
    console.log(`[campaign] created campaign ${campaign.id} status=${status}`);

    await prisma.campaignLead.create({
        data: {
            id: 'cl-' + Date.now() + '-' + Math.floor(Math.random()*1e4),
            campaignId: campaign.id,
            leadId: lead.id,
            isCompleted: false,
        },
    });
    console.log(`[campaign] attached lead → campaign`);

    await prisma.$disconnect();
}

main().catch(e => { console.error(e); process.exit(1); });
