import { prisma } from './apps/backend/src/server';
import { processWorkflowStep } from './apps/backend/src/workers/linkedin.worker';
import { ActionType } from '@repo/types';

const testCampaignEngine = async () => {
    console.log('--- Campaign Execution Engine Verification ---');

    const userId = 'test-user-' + Date.now();
    const leadId = 'test-lead-' + Date.now();
    const campaignId = 'test-campaign-' + Date.now();

    try {
        // 1. Setup Test Data
        console.log('[1] Setting up user, lead, and campaign...');
        await prisma.user.create({
            data: {
                id: userId,
                email: `test-${Date.now()}@test.com`,
                passwordHash: 'test-hash'
            }
        });

        await prisma.lead.create({
            data: {
                id: leadId,
                userId: userId,
                firstName: 'Test',
                lastName: 'Lead',
                linkedinUrl: 'https://linkedin.com/in/test-lead',
                status: 'UNCONNECTED'
            }
        });

        const workflowJson = {
            nodes: [
                { id: 'start', type: 'ACTION', subType: 'INVITE', data: { label: 'Connect with Note', message: 'Hi {firstName}' } },
                { id: 'delay', type: 'DELAY', data: { label: 'Wait 1h', hours: '1' } },
                { id: 'check', type: 'CONDITION', subType: 'IF_CONNECTED', data: { label: 'Is Connected?' } },
                { id: 'msg', type: 'ACTION', subType: 'MESSAGE', data: { label: 'Send Message', message: 'Thanks for connecting!' } }
            ],
            edges: [
                { id: 'e1', source: 'start', target: 'delay' },
                { id: 'e2', source: 'delay', target: 'check' },
                { id: 'e3', source: 'check', target: 'msg', sourceHandle: 'yes' }
            ]
        };

        await prisma.campaign.create({
            data: {
                id: campaignId,
                userId: userId,
                name: 'Test Workflow Engine',
                status: 'ACTIVE',
                workflowJson: workflowJson
            }
        });

        const campaignLead = await prisma.campaignLead.create({
            data: {
                campaignId: campaignId,
                leadId: leadId,
                currentStepId: 'start',
                nextActionDate: new Date()
            }
        });

        const clId = campaignLead.id;

        // 2. Simulate Step 1: INVITE
        console.log('\n[Step 1] Executing INVITE...');
        process.env.MOCK_PLAYWRIGHT = 'true';
        await processWorkflowStep({
            campaignLeadId: clId,
            userId,
            leadId,
            campaignId,
            currentStepId: 'start',
            workflowJson
        });

        let updatedCL = await prisma.campaignLead.findUnique({ where: { id: clId } });
        let updatedLead = await prisma.lead.findUnique({ where: { id: leadId } });
        console.log('Result -> Lead Status:', updatedLead?.status); // Should be INVITE_PENDING
        console.log('Result -> Next Step:', updatedCL?.currentStepId); // Should be 'delay'

        // 3. Simulate Step 2: DELAY
        console.log('\n[Step 2] Executing DELAY...');
        const now = Date.now();
        await processWorkflowStep({
            campaignLeadId: clId,
            userId,
            leadId,
            campaignId,
            currentStepId: 'delay',
            workflowJson
        });

        updatedCL = await prisma.campaignLead.findUnique({ where: { id: clId } });
        console.log('Result -> Next Step:', updatedCL?.currentStepId); // Should be 'check'
        const diffHours = (updatedCL!.nextActionDate.getTime() - now) / (1000 * 60 * 60);
        console.log('Result -> Delay (hours):', diffHours.toFixed(2));

        // 4. Simulate Step 3: CONDITION (False case)
        console.log('\n[Step 3] Executing CONDITION (Expected False)...');
        await processWorkflowStep({
            campaignLeadId: clId,
            userId,
            leadId,
            campaignId,
            currentStepId: 'check',
            workflowJson
        });

        updatedCL = await prisma.campaignLead.findUnique({ where: { id: clId } });
        console.log('Result -> Is Completed (since no "no" branch):', updatedCL?.isCompleted);

        // 5. Simulate Step 3: CONDITION (True case)
        console.log('\n[Step 4] Executing CONDITION (Expected True)...');
        await prisma.lead.update({ where: { id: leadId }, data: { status: 'CONNECTED' } });
        await prisma.campaignLead.update({
            where: { id: clId },
            data: { isCompleted: false, currentStepId: 'check' }
        });

        await processWorkflowStep({
            campaignLeadId: clId,
            userId,
            leadId,
            campaignId,
            currentStepId: 'check',
            workflowJson
        });

        updatedCL = await prisma.campaignLead.findUnique({ where: { id: clId } });
        console.log('Result -> Next Step:', updatedCL?.currentStepId); // Should be 'msg'

        // 6. Final Step: MESSAGE
        console.log('\n[Step 5] Executing MESSAGE...');
        await processWorkflowStep({
            campaignLeadId: clId,
            userId,
            leadId,
            campaignId,
            currentStepId: 'msg',
            workflowJson
        });

        updatedCL = await prisma.campaignLead.findUnique({ where: { id: clId } });
        console.log('Result -> Final Completion:', updatedCL?.isCompleted);

        const campaign = await prisma.campaign.findUnique({ where: { id: campaignId } });
        console.log('Result -> Campaign Status:', campaign?.status); // Should be COMPLETED

    } catch (e) {
        console.error('Test Failed:', e);
    } finally {
        // Cleanup would go here
        console.log('\n--- Test Verification Complete ---');
    }
};

testCampaignEngine();
