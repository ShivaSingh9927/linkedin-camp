import { prisma } from '@repo/db';

async function testSchedulerFairness() {
    console.log('🧪 Starting Scheduler Fairness & Concurrency Test...\n');

    // 1. Create 3 Dummy Users with Cookies
    const users = [];
    for (let i = 1; i <= 3; i++) {
        const user = await prisma.user.create({
            data: {
                email: `fairness-tester-${i}-${Date.now()}@example.com`,
                tier: 'FREE',
                linkedinCookie: 'mock_cookie_data_for_user_' + i
            }
        });
        users.push(user);
        console.log(`✅ Created Test User ${i} [${user.email}]`);
    }

    // 2. Create a Campaign and 10 Leads for each User
    const campaigns = [];
    for (let idx = 0; idx < users.length; idx++) {
        const user = users[idx];

        // Workflow defines a Trigger -> Invite (Delay 0 to run instantly)
        const campaign = await prisma.campaign.create({
            data: {
                userId: user.id,
                name: `Test Multi-threading Campaign ${idx + 1}`,
                status: 'ACTIVE',
                workflowJson: {
                    nodes: [
                        { id: 'step-1', type: 'TRIGGER' },
                        { id: 'step-2', type: 'ACTION', subType: 'PROFILE_VISIT' }
                    ],
                    edges: [
                        { source: 'step-1', target: 'step-2' }
                    ]
                }
            }
        });
        campaigns.push(campaign);

        // Create 10 Leads for this User
        const leads = [];
        for (let j = 1; j <= 10; j++) {
            const lead = await prisma.lead.create({
                data: {
                    userId: user.id,
                    firstName: `DummyUser${idx + 1}`,
                    lastName: `Lead${j}`,
                    linkedinUrl: `https://linkedin.com/in/dummy-user-${idx + 1}-lead-${j}`
                }
            });
            leads.push(lead);

            // Inject them directly into CampaignLead table, setting nextActionDate to now
            await prisma.campaignLead.create({
                data: {
                    campaignId: campaign.id,
                    leadId: lead.id,
                    currentStepId: 'step-2',
                    nextActionDate: new Date(Date.now() - 10000), // 10 seconds ago to ensure it's picked up
                    isCompleted: false
                }
            });
        }
        console.log(`✅ Assigned 10 pending tasks to User ${idx + 1}'s Campaign.`);
    }

    console.log('\n🚀 ALL USERS AND LEADS SEEDED.');
    console.log('------------------------------------------------------');
    console.log('To observe fairness, leave the backend running: `npm run dev --workspace=apps/backend`');
    console.log('You should see the scheduler push exactly 5 tasks per user (15 total) on its next 5-minute heartbeat.');
    console.log('Then you can delete the test data automatically by pressing Ctrl+C if you ran this interactively, or wait for the script to clean itself up if you uncomment the cleanup lines in the script.');
    console.log('------------------------------------------------------\n');

    // We won't auto-delete right away so you can actually watch them execute.
    // If you want to clean them up, you could uncomment the lines below:

    /*
    console.log('\n🧹 Cleaning up test data...');
    for (const u of users) {
        await prisma.lead.deleteMany({ where: { userId: u.id } });
        await prisma.campaign.deleteMany({ where: { userId: u.id } });
        await prisma.user.delete({ where: { id: u.id } });
    }
    console.log('✅ Cleanup complete.');
    */
}

testSchedulerFairness()
    .catch(e => {
        console.error('❌ Test failed:', e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
