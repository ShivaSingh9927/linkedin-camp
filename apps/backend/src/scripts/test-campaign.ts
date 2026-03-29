/**
 * test-campaign.ts
 *
 * Local test script to run a campaign flow without the worker/queue.
 *
 * Usage:
 *   cd apps/backend
 *   npx ts-node src/scripts/test-campaign.ts
 *
 * Before running, set these env vars:
 *   DATABASE_URL=your_postgres_url
 *   TEST_USER_ID=your_user_id
 *
 * The script uses the first lead it finds for the user, or you can hardcode a profile URL below.
 */

import { runCampaign } from '../campaign-engine';
import { CampaignConfig } from '../campaign-engine/types';
import { prisma } from '@repo/db';

// ---- CONFIGURE YOUR TEST HERE ----

const HARDCODED_PROFILE_URL = 'https://www.linkedin.com/in/shiva-singh-genai-llm/';

const TEST_CAMPAIGN_CONFIG: CampaignConfig = {
    flow: [
        { node: 'profile-visit' },
        { node: 'connect' },
        { node: 'like-nth-post', n: 1 },
        { node: 'comment-nth-post', n: 1, text: 'Great insights at {{company}}, {{name}}!' },
        { node: 'send-message', text: 'Hey {{name}}, loved your work at {{company}}!', requireConnection: false },
    ],
};

// To test with a delay node, uncomment this instead:
// const TEST_CAMPAIGN_CONFIG: CampaignConfig = {
//     flow: [
//         { node: 'profile-visit' },
//         { node: 'connect' },
//         { node: 'delay', hours: 0.01 }, // ~36 seconds for quick test
//         { node: 'like-nth-post', n: 1 },
//         { node: 'comment-nth-post', n: 1, text: 'Nice post {{name}}!' },
//         { node: 'send-message', text: 'Hey {{name}}!', requireConnection: false },
//     ],
// };

// ---- END CONFIG ----

async function main() {
    const userId = process.env.TEST_USER_ID;

    if (!userId) {
        console.error('❌ Set TEST_USER_ID env var');
        process.exit(1);
    }

    console.log(`[TEST] Using user: ${userId}`);

    // Create a temporary campaign in DB (status = DRAFT so worker won't pick it up)
    const campaign = await prisma.campaign.create({
        data: {
            userId,
            name: `TEST_CAMPAIGN_${Date.now()}`,
            status: 'DRAFT',
            workflowJson: TEST_CAMPAIGN_CONFIG as any,
        },
    });

    console.log(`[TEST] Created test campaign: ${campaign.id}`);

    // Find or create a lead
    let lead = await prisma.lead.findFirst({
        where: { userId, linkedinUrl: HARDCODED_PROFILE_URL },
    });

    if (!lead) {
        lead = await prisma.lead.create({
            data: {
                userId,
                linkedinUrl: HARDCODED_PROFILE_URL,
                firstName: 'Test',
                status: 'IMPORTED',
            },
        });
        console.log(`[TEST] Created test lead: ${lead.id}`);
    } else {
        console.log(`[TEST] Found existing lead: ${lead.id}`);
    }

    // Link lead to campaign
    await prisma.campaignLead.upsert({
        where: { campaignId_leadId: { campaignId: campaign.id, leadId: lead.id } },
        create: {
            campaignId: campaign.id,
            leadId: lead.id,
            status: 'PENDING',
        },
        update: {
            isCompleted: false,
            currentStepId: null,
            personalization: undefined,
        },
    });

    console.log(`[TEST] Lead linked to campaign.`);
    console.log(`[TEST] Starting campaign execution...\n`);

    // Run the campaign
    const summary = await runCampaign(userId, campaign.id, TEST_CAMPAIGN_CONFIG);

    // Print detailed per-lead output
    console.log('\n[TEST] DETAILED NODE OUTPUTS:\n');
    for (const lr of summary.leadResults) {
        console.log(`Lead: ${lr.leadName} (${lr.leadId})`);
        console.log(`Status: ${lr.status}`);
        console.log('Nodes:');
        for (const n of lr.nodesExecuted) {
            console.log(`  ${n.status === 'success' ? '✅' : '❌'} ${n.node}`);
            if (n.output) console.log(`     output: ${JSON.stringify(n.output, null, 2).split('\n').join('\n     ')}`);
            if (n.error) console.log(`     error: ${n.error}`);
        }
        console.log('');
    }

    // Cleanup: mark campaign as completed so it doesn't linger
    await prisma.campaign.update({
        where: { id: campaign.id },
        data: { status: 'COMPLETED' },
    });

    console.log('[TEST] Done. Test campaign marked COMPLETED.');
    process.exit(0);
}

main().catch((err) => {
    console.error('[TEST] Fatal error:', err);
    process.exit(1);
});
