/**
 * test-message-campaign-run.ts
 *
 * Test: profile-visit → send-message
 * User: shivasingh9927@gmail.com
 * Lead: https://www.linkedin.com/in/shiva-singh-genai-llm/
 *
 * Usage (inside backend container):
 *   DATABASE_URL="postgresql://shiva:password123@db:5432/linkedin_camp" \
 *   npx ts-node /tmp/test-message-campaign-run.ts
 */

import { runCampaign } from '../campaign-engine';
import { CampaignConfig } from '../campaign-engine/types';
import { prisma } from '@repo/db';

const USER_EMAIL = 'shivasingh9927@gmail.com';
const TARGET_LINKEDIN_URL = 'https://www.linkedin.com/in/shiva-singh-genai-llm/';

const TEST_CONFIG: CampaignConfig = {
    flow: [
        { node: 'profile-visit' },
        { node: 'send-message', text: 'Hi {{name}}, great to connect! Would love to chat about AI.', requireConnection: false, aiEnabled: true },
    ],
    objective: 'Professional networking and knowledge sharing',
    cta: 'connect',
    toneOverride: 'friendly and casual',
    persona: 'Software engineer interested in AI/ML',
    valueProp: 'Collaborating on AI projects and sharing industry insights',
};

async function main() {
    console.log('[TEST] Looking up user:', USER_EMAIL);

    const user = await prisma.user.findUnique({
        where: { email: USER_EMAIL },
    });

    if (!user) {
        console.error('❌ User not found:', USER_EMAIL);
        process.exit(1);
    }

    console.log(`[TEST] User ID: ${user.id}`);

    if (!user.linkedinCookie) {
        console.error('❌ No linkedinCookie on user. Sync the extension first.');
        process.exit(1);
    }

    // Parse session from DB
    let parsedCookies = null;
    let parsedUserAgent = null;
    let parsedLocalStorage = null;

    try {
        const raw = JSON.parse(user.linkedinCookie);
        parsedCookies = Array.isArray(raw) ? raw.map((c: any) => ({
            ...c,
            expires: c.expires != null ? Math.round(Number(c.expires)) : Math.round(Date.now() / 1000) + 86400 * 30,
            sameSite: c.sameSite === 'no_restriction' ? 'None' : (c.sameSite === 'unspecified' ? 'Lax' : c.sameSite),
        })) : raw;
    } catch (e: any) {
        console.error('❌ Cookie parse error:', e.message);
        process.exit(1);
    }

    try {
        if (user.linkedinFingerprint) {
            const fp = typeof user.linkedinFingerprint === 'string'
                ? JSON.parse(user.linkedinFingerprint) : user.linkedinFingerprint;
            parsedUserAgent = fp?.userAgent || null;
        }
    } catch {}

    try {
        if (user.linkedinLocalStorage) {
            parsedLocalStorage = typeof user.linkedinLocalStorage === 'string'
                ? JSON.parse(user.linkedinLocalStorage) : user.linkedinLocalStorage;
        }
    } catch {}

    console.log(`[TEST] Session loaded — ${parsedCookies?.length || 0} cookies, UA: ${parsedUserAgent?.slice(0, 50)}...`);

    // Find the specific lead by LinkedIn URL
    const lead = await prisma.lead.findFirst({
        where: {
            userId: user.id,
            linkedinUrl: TARGET_LINKEDIN_URL,
        },
    });

    if (!lead) {
        console.error(`❌ No lead found with URL: ${TARGET_LINKEDIN_URL}`);
        process.exit(1);
    }

    console.log(`[TEST] Using lead: ${lead.firstName} ${lead.lastName || ''} — ${lead.linkedinUrl}`);
    console.log(`[TEST] Lead ID: ${lead.id}`);

    // Create a temporary campaign
    const campaign = await prisma.campaign.create({
        data: {
            userId: user.id,
            name: `TEST_MSG_${Date.now()}`,
            status: 'DRAFT',
            workflowJson: TEST_CONFIG as any,
        },
    });

    console.log(`[TEST] Campaign created: ${campaign.id}`);

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
        },
    });

    // Inject session context into config
    TEST_CONFIG.sessionContext = {
        cookies: parsedCookies,
        userAgent: parsedUserAgent,
        localStorage: parsedLocalStorage,
        proxy: {
            server: 'http://82.41.252.111:46222',
            username: 'xBVyYdUpx84nWx7',
            password: 'dwwTxtvv5a10RXn',
        },
    };

    console.log(`\n[TEST] Running: profile-visit → send-message\n`);
    console.log('='.repeat(50));

    const summary = await runCampaign(user.id, campaign.id, TEST_CONFIG);

    console.log('='.repeat(50));
    console.log(`\n[TEST] SUMMARY`);
    console.log(`  Total: ${summary.totalLeads} | Succeeded: ${summary.succeeded} | Failed: ${summary.failed}\n`);

    for (const lr of summary.leadResults) {
        const icon = lr.status === 'completed' ? '✅' : '❌';
        console.log(`${icon} ${lr.leadName} (${lr.leadId})`);
        for (const n of lr.nodesExecuted) {
            const nIcon = n.status === 'success' ? '✅' : '❌';
            console.log(`    ${nIcon} ${n.node}${n.error ? ' — ' + n.error : ''}`);
            if (n.output) console.log(`       ${JSON.stringify(n.output)}`);
        }
    }

    // Cleanup
    await prisma.campaign.update({
        where: { id: campaign.id },
        data: { status: 'COMPLETED' },
    });

    console.log('\n[TEST] Done. Campaign marked COMPLETED.');
    process.exit(0);
}

main().catch((err) => {
    console.error('[TEST] Fatal:', err);
    process.exit(1);
});
