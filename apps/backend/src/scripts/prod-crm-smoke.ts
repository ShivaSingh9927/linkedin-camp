// CRM-sync E2E smoke test: encrypt+store the HubSpot/Pipedrive tokens on
// the target user, enrich the existing shiva lead with minimum fields the
// CRM APIs need (name + email), and invoke syncLeadToCRMs directly. Bypasses
// the webhook so the test output is synchronous and easy to read.
//
// ENV:
//   QUSER_ID       — Qampi user that should own the tokens + lead
//   QHUBSPOT_TOKEN — raw HubSpot PAT (will be encrypted on the way in)
//   QPIPEDRIVE_TOKEN — raw Pipedrive API token
//   QLEAD_FIRST    — lead first name (default "Shiva")
//   QLEAD_LAST     — lead last name (default "Singh")
//   QLEAD_EMAIL    — lead email (default qampi-crm-test+<userId>@example.com)
//   QLEAD_COMPANY  — lead company (default "Qampi Test")
//   QLEAD_URL      — LinkedIn URL to find lead by (default shiva-singh-genai-llm)

import { PrismaClient } from '@repo/db';
import { encrypt } from '../utils/crypto';
import { syncLeadToCRMs } from '../services/crmService';

const prisma = new PrismaClient();

async function main() {
    const userId    = process.env.QUSER_ID!;
    const hsRaw     = process.env.QHUBSPOT_TOKEN;
    const pdRaw     = process.env.QPIPEDRIVE_TOKEN;
    const firstName = process.env.QLEAD_FIRST   || 'Shiva';
    const lastName  = process.env.QLEAD_LAST    || 'Singh';
    const email     = process.env.QLEAD_EMAIL   || `qampi-crm-test+${userId}@example.com`;
    const company   = process.env.QLEAD_COMPANY || 'Qampi Test';
    const leadUrl   = process.env.QLEAD_URL     || 'https://www.linkedin.com/in/shiva-singh-genai-llm/';

    if (!userId) { console.error('QUSER_ID required'); process.exit(2); }
    if (!hsRaw && !pdRaw) { console.error('Provide at least QHUBSPOT_TOKEN or QPIPEDRIVE_TOKEN'); process.exit(2); }

    console.log(`[crm-smoke] target user=${userId}`);
    console.log(`[crm-smoke] tokens: hubspot=${hsRaw ? 'yes' : 'no'} pipedrive=${pdRaw ? 'yes' : 'no'}`);

    // 1. Encrypt + persist the tokens
    const data: any = {};
    if (hsRaw) data.hubspotToken   = encrypt(hsRaw);
    if (pdRaw) data.pipedriveToken = encrypt(pdRaw);
    await prisma.user.update({ where: { id: userId }, data });
    console.log(`[crm-smoke] tokens encrypted + stored on User row`);

    // 2. Enrich the test lead — CRM APIs need at least a name/email
    let lead = await prisma.lead.findFirst({ where: { userId, linkedinUrl: leadUrl } });
    if (!lead) {
        lead = await prisma.lead.create({
            data: {
                id: 'lead-crm-' + Date.now(),
                userId, linkedinUrl: leadUrl,
                firstName, lastName, email, company,
                jobTitle: 'GenAI / LLM Engineer',
                location: 'Bengaluru',
                updatedAt: new Date(),
            },
        });
        console.log(`[crm-smoke] created lead ${lead.id}`);
    } else {
        lead = await prisma.lead.update({
            where: { id: lead.id },
            data: { firstName, lastName, email, company, jobTitle: 'GenAI / LLM Engineer', location: 'Bengaluru' },
        });
        console.log(`[crm-smoke] enriched lead ${lead.id} (firstName=${firstName} email=${email})`);
    }

    // 3. Trigger the sync — synchronous, returns per-provider results
    console.log(`[crm-smoke] calling syncLeadToCRMs...`);
    const results = await syncLeadToCRMs(userId, lead.id);

    console.log(`\n=== CRM-SMOKE SUMMARY ===`);
    for (const r of results) {
        if (r.success) {
            console.log(`✓ ${r.provider.toUpperCase()}: contact created`);
        } else {
            console.log(`✗ ${r.provider.toUpperCase()}: ${r.error}`);
        }
    }
    if (results.length === 0) console.log('(no providers ran — no tokens found)');

    await prisma.$disconnect();
    process.exit(results.every(r => r.success) ? 0 : 1);
}

main().catch(e => { console.error(e); process.exit(1); });
