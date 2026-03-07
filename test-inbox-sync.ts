import { prisma } from './apps/backend/src/server';
import { processWorkflowStep } from './apps/backend/src/workers/linkedin.worker';

const testInboxCondition = async () => {
    console.log('--- Inbox Sync & Condition Verification ---');

    const userId = 'test-user-sync-' + Date.now();
    const leadId = 'test-lead-sync-' + Date.now();
    const campaignId = 'test-campaign-sync-' + Date.now();

    try {
        // 1. Setup
        await prisma.user.create({
            data: { id: userId, email: `sync-${Date.now()}@test.com`, passwordHash: 'hash' }
        });

        await prisma.lead.create({
            data: {
                id: leadId,
                userId,
                firstName: 'Reply',
                lastName: 'Test',
                status: 'CONNECTED',
                linkedinUrl: 'https://linkedin.com/in/reply-test'
            }
        });

        const workflowJson = {
            nodes: [
                { id: 'start', type: 'ACTION', subType: 'MESSAGE', data: { message: 'Ping' } },
                { id: 'check', type: 'CONDITION', subType: 'IF_REPLIED', data: { label: 'Did they reply?' } },
                { id: 'yes-node', type: 'ACTION', subType: 'MESSAGE', data: { message: 'Great!' } },
                { id: 'no-node', type: 'ACTION', subType: 'MESSAGE', data: { message: 'Still waiting...' } }
            ],
            edges: [
                { id: 'e1', source: 'start', target: 'check' },
                { id: 'e2', source: 'check', target: 'yes-node', sourceHandle: 'yes' },
                { id: 'e3', source: 'check', target: 'no-node', sourceHandle: 'no' }
            ]
        };

        const cl = await prisma.campaignLead.create({
            data: {
                campaignId: (await prisma.campaign.create({
                    data: { id: campaignId, userId, name: 'Sync Test', workflowJson }
                })).id,
                leadId,
                currentStepId: 'check',
                nextActionDate: new Date()
            }
        });

        // 2. Test Case 1: No reply yet
        console.log('\n[Case 1] No reply (Status: CONNECTED)...');
        await processWorkflowStep({
            campaignLeadId: cl.id,
            userId,
            leadId,
            campaignId,
            currentStepId: 'check',
            workflowJson
        });

        let updatedCL = await prisma.campaignLead.findUnique({ where: { id: cl.id } });
        console.log('Result -> Next Step:', updatedCL?.currentStepId); // Should be 'no-node'

        // 3. Test Case 2: Replied
        console.log('\n[Case 2] Replied (Status: REPLIED)...');
        await prisma.lead.update({ where: { id: leadId }, data: { status: 'REPLIED' } });
        await prisma.campaignLead.update({
            where: { id: cl.id },
            data: { currentStepId: 'check', isCompleted: false }
        });

        await processWorkflowStep({
            campaignLeadId: cl.id,
            userId,
            leadId,
            campaignId,
            currentStepId: 'check',
            workflowJson
        });

        updatedCL = await prisma.campaignLead.findUnique({ where: { id: cl.id } });
        console.log('Result -> Next Step:', updatedCL?.currentStepId); // Should be 'yes-node'

    } catch (e) {
        console.error('Sync Test Failed:', e);
    }
};

testInboxCondition();
