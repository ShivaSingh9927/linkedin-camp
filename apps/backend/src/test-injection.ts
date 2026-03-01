import Redis from 'ioredis';
import { Queue } from 'bullmq';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const redisConnection = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');
const queue = new Queue('linkedin-actions', { connection: redisConnection as any });

async function test() {
    console.log('Fetching real data from DB...');
    const user = await prisma.user.findFirst();
    const lead = await prisma.lead.findFirst();

    if (!user || !lead) {
        console.error('Missing user or lead in DB. Run demo generator first.');
        process.exit(1);
    }

    // Ensure lead has some data for variables
    await prisma.lead.update({
        where: { id: lead.id },
        data: {
            firstName: 'Shiva',
            company: 'Neysa'
        }
    });

    // We also need a CampaignLead entry
    const workflow = {
        nodes: [
            {
                id: '1',
                type: 'ACTION',
                subType: 'MESSAGE',
                data: {
                    message: 'Hello {firstName} from {company}! Testing variable injection.',
                    label: 'Send Message'
                }
            }
        ],
        edges: []
    };

    const campaign = await prisma.campaign.findFirst({ where: { userId: user.id } }) ||
        await prisma.campaign.create({
            data: {
                name: 'Test Campaign',
                userId: user.id,
                workflowJson: workflow
            }
        });

    const campaignLead = await prisma.campaignLead.findFirst({
        where: { campaignId: campaign.id, leadId: lead.id }
    }) || await prisma.campaignLead.create({
        data: {
            campaignId: campaign.id,
            leadId: lead.id,
            currentStepId: '1'
        }
    });

    const jobData = {
        campaignLeadId: campaignLead.id,
        userId: user.id,
        leadId: lead.id,
        currentStepId: '1',
        workflowJson: workflow
    };

    console.log(`Adding test job for User: ${user.email}, Lead: ${lead.firstName}`);
    await queue.add('test-action', jobData);
    console.log('Job added. Check backend logs for [MOCK MODE] output.');

    await prisma.$disconnect();
    process.exit(0);
}

test().catch(err => {
    console.error(err);
    process.exit(1);
});
