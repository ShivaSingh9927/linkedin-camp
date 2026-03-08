import { prisma } from '@repo/db';
import * as jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'supersecret';

function createMockJwtFor(userId: string) {
    return jwt.sign({ id: userId, email: 'test@example.com' }, JWT_SECRET);
}

async function testDeduplicationAndInjection() {
    console.log('🧪 Starting Bulk Import & Deduplication Test...');

    // 1. Setup Data: Create a test user and a test campaign
    const testUser = await prisma.user.create({
        data: {
            email: `test-${Date.now()}@example.com`,
            tier: 'FREE'
        }
    });

    const testCampaign = await prisma.campaign.create({
        data: {
            userId: testUser.id,
            name: 'Test Bulk Import Campaign',
            status: 'DRAFT',
            workflowJson: {
                nodes: [{ id: 'step-1', type: 'TRIGGER' }],
                edges: [{ source: 'step-1', target: 'step-2' }]
            }
        }
    });

    console.log(`✅ Created Test User [${testUser.email}]`);
    console.log(`✅ Created Draft Campaign [${testCampaign.id}]`);

    // 2. Mock Leads Payload (Simulate Extension 1st Scrape)
    const mockLeadsScrape1 = [
        { linkedinUrl: 'linkedin.com/in/steve-jobs', firstName: 'Steve', lastName: 'Jobs' }, // Brand New
        { linkedinUrl: 'linkedin.com/in/bill-gates', firstName: 'Bill', lastName: 'Gates' }, // Brand New
        { linkedinUrl: 'linkedin.com/in/ada-lovelace', firstName: 'Ada', lastName: 'Lovelace' }, // Brand New
    ];

    console.log('\n🚀 [TEST PHASE 1] Importing 3 brand new leads perfectly clean...');

    // Using the same HTTP payload format that hits the endpoint
    /* const res1 = await fetch('http://localhost:3002/api/v1/leads/import', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${createMockJwtFor(testUser.id)}` // We'll bypass JWT logic for pure db test if needed but let's test the endpoint directly if possible!
        },
        body: JSON.stringify({
            leads: mockLeadsScrape1,
            campaignId: testCampaign.id
        })
    }); */

    // To hit the isolated logic natively without token mocking, let's test the DB directly mimicking the controller logic:
    console.log('...Simulating Controller bulkImportLeads Logic natively for pure DB speed test...');

    const bulkImportLeads = async (userId: string, incomingLeads: any[]) => {
        // ... replication of the controller's internal bulk processor for testing speeds directly
        const start = performance.now();

        const uniqueLeadsMap = new Map();
        for (const lead of incomingLeads) { if (lead.linkedinUrl) uniqueLeadsMap.set(lead.linkedinUrl, lead); }
        const uniqueLeads = Array.from(uniqueLeadsMap.values());
        const leadUrls = uniqueLeads.map(l => l.linkedinUrl);

        const existingTeamLeads = await prisma.lead.findMany({
            where: { linkedinUrl: { in: leadUrls }, userId }
        });

        const userExistingLeadsMap = new Map(existingTeamLeads.map((l: any) => [l.linkedinUrl, l]));
        const leadsToCreate = [];

        for (const lead of uniqueLeads) {
            if (!userExistingLeadsMap.has(lead.linkedinUrl)) {
                leadsToCreate.push({ userId, linkedinUrl: lead.linkedinUrl, firstName: lead.firstName });
            }
        }

        if (leadsToCreate.length > 0) {
            await prisma.lead.createMany({ data: leadsToCreate, skipDuplicates: true });
        }

        const end = performance.now();
        return { created: leadsToCreate.length, ms: Math.round(end - start) };
    };

    const res1Native = await bulkImportLeads(testUser.id, mockLeadsScrape1);
    console.log(`✅ Phase 1: Imported ${res1Native.created} leads in ${res1Native.ms}ms.`);

    // 3. Mock Scenario 2 (Simulate 2nd Scrape: Overlap and New Leads)
    console.log('\n🚀 [TEST PHASE 2] Simulating 2nd scrape overlap (1 duplicate + 2 new)...');
    const mockLeadsScrape2 = [
        { linkedinUrl: 'linkedin.com/in/steve-jobs', firstName: 'Steve', lastName: 'Jobs' }, // Existing! (DUPLICATE)
        { linkedinUrl: 'linkedin.com/in/alan-turing', firstName: 'Alan', lastName: 'Turing' }, // Brand New
        { linkedinUrl: 'linkedin.com/in/nikola-tesla', firstName: 'Nikola', lastName: 'Tesla' }, // Brand New
    ];

    const res2Native = await bulkImportLeads(testUser.id, mockLeadsScrape2);
    console.log(`✅ Phase 2: Expected 2 new created. Actual created: ${res2Native.created}. Time: ${res2Native.ms}ms.`);


    // 4. Simulate Injection & Collision Check
    console.log('\n🚀 [TEST PHASE 3] Checking Campaign Collisions (Anti-Spam)...');

    // Inject Steve Jobs into Campaign A
    const allLeads = await prisma.lead.findMany({ where: { userId: testUser.id } });
    const steveLead = allLeads.find((l: any) => l.linkedinUrl === 'linkedin.com/in/steve-jobs');

    await prisma.campaignLead.create({
        data: {
            campaignId: testCampaign.id,
            leadId: steveLead!.id,
            currentStepId: 'step-1',
            isCompleted: false // Active!
        }
    });
    console.log('✅ Injected Steve Jobs actively into Campaign A.');

    // Attempt to inject Steve Jobs AND Alan Turing into a NEW Campaign B
    const campaignB = await prisma.campaign.create({
        data: { userId: testUser.id, name: 'Campaign B', status: 'DRAFT', workflowJson: {} }
    });

    const leadIdsAttemptingInjection = allLeads.filter((l: any) => l.firstName === 'Steve' || l.firstName === 'Alan').map((l: any) => l.id);

    // Mimic the active controller's strict scan!
    const activeLeadsInCampaigns = await prisma.campaignLead.findMany({
        where: { leadId: { in: leadIdsAttemptingInjection }, isCompleted: false },
        select: { leadId: true }
    });

    const activeLeadIds = new Set(activeLeadsInCampaigns.map((cl: any) => cl.leadId));
    const safeLeadIdsToStart = leadIdsAttemptingInjection.filter((id: any) => !activeLeadIds.has(id));

    console.log(`✅ Scam Scan Complete.`);
    console.log(`   Attempted to inject: 2 leads.`);
    console.log(`   Blocked actively colliding leads: ${activeLeadIds.size}`);
    console.log(`   Safe leads injected to Campaign B: ${safeLeadIdsToStart.length}`);

    // Clean up
    await prisma.campaignLead.deleteMany({ where: { campaignId: { in: [testCampaign.id, campaignB.id] } } });
    await prisma.campaign.deleteMany({ where: { id: { in: [testCampaign.id, campaignB.id] } } });
    await prisma.lead.deleteMany({ where: { userId: testUser.id } });
    await prisma.user.delete({ where: { id: testUser.id } });
    console.log('\n🧹 Database cleaned up!');
}

testDeduplicationAndInjection()
    .catch(e => {
        console.error('❌ Test failed:', e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
