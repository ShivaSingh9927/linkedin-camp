/**
 * test-message-file-session.ts
 * Test using file-based session instead of DB cookies
 */
import { runCampaign } from '../campaign-engine';
import { CampaignConfig } from '../campaign-engine/types';
import { prisma } from '@repo/db';
import * as fs from 'fs';
import * as path from 'path';

const USER_EMAIL = 'shivasingh9927@gmail.com';
const TARGET_LINKEDIN_URL = 'https://www.linkedin.com/in/shiva-singh-genai-llm/';

async function main() {
    console.log('[TEST] Looking up user:', USER_EMAIL);

    const user = await prisma.user.findUnique({ where: { email: USER_EMAIL } });
    if (!user) { console.error('User not found'); process.exit(1); }
    console.log(`[TEST] User ID: ${user.id}`);

    // Load session from FILES (not DB)
    const sessionDir = `/app/sessions/${user.id}`;
    console.log(`[TEST] Loading session from files: ${sessionDir}`);

    let cookies: any[] = [];
    let userAgent: string | null = null;
    let localStorage: Record<string, string> = {};

    try {
        cookies = JSON.parse(fs.readFileSync(path.join(sessionDir, 'cookies.json'), 'utf-8'));
        console.log(`[TEST] Loaded ${cookies.length} cookies from file`);
    } catch (e: any) {
        console.error('❌ cookies.json not found:', e.message);
        process.exit(1);
    }

    try {
        const fp = JSON.parse(fs.readFileSync(path.join(sessionDir, 'fingerprint.json'), 'utf-8'));
        userAgent = fp.userAgent;
        console.log(`[TEST] UA: ${userAgent?.substring(0, 60)}...`);
    } catch {}

    try {
        const lsPath = path.join(sessionDir, 'localStorage.json');
        if (fs.existsSync(lsPath)) {
            localStorage = JSON.parse(fs.readFileSync(lsPath, 'utf-8'));
            console.log(`[TEST] Loaded ${Object.keys(localStorage).length} localStorage keys`);
        }
    } catch {}

    // Find the lead
    const lead = await prisma.lead.findFirst({
        where: { userId: user.id, linkedinUrl: TARGET_LINKEDIN_URL },
    });
    if (!lead) { console.error('Lead not found'); process.exit(1); }
    console.log(`[TEST] Lead: ${lead.firstName} ${lead.lastName}`);

    // Create campaign
    const TEST_CONFIG: CampaignConfig = {
        flow: [
            { node: 'profile-visit' },
            { node: 'send-message', requireConnection: false, aiEnabled: true },
        ],
        objective: 'Professional networking and knowledge sharing',
        cta: 'connect',
        toneOverride: 'friendly and casual',
        persona: 'Software engineer interested in AI/ML',
        valueProp: 'Collaborating on AI projects and sharing industry insights',
    };

    const campaign = await prisma.campaign.create({
        data: {
            userId: user.id,
            name: `TEST_FILE_SESSION_${Date.now()}`,
            status: 'DRAFT',
            workflowJson: TEST_CONFIG as any,
        },
    });
    console.log(`[TEST] Campaign: ${campaign.id}`);

    await prisma.campaignLead.upsert({
        where: { campaignId_leadId: { campaignId: campaign.id, leadId: lead.id } },
        create: { campaignId: campaign.id, leadId: lead.id, status: 'PENDING' },
        update: { isCompleted: false, currentStepId: null },
    });

    // Inject FILE-BASED session (not DB cookies)
    TEST_CONFIG.sessionContext = {
        cookies,
        userAgent,
        localStorage,
        proxy: {
            server: 'http://82.41.252.111:46222',
            username: 'xBVyYdUpx84nWx7',
            password: 'dwwTxtvv5a10RXn',
        },
    };

    console.log(`\n[TEST] Running: profile-visit → send-message (FILE SESSION)\n`);
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

    await prisma.campaign.update({ where: { id: campaign.id }, data: { status: 'COMPLETED' } });
    console.log('\n[TEST] Done.');
    process.exit(0);
}

main().catch((err) => { console.error('[TEST] Fatal:', err); process.exit(1); });
