import { PrismaClient } from '@prisma/client';
import { Queue } from 'bullmq';
import Redis from 'ioredis';

const prisma = new PrismaClient();
const redisConnection = new Redis(process.env.REDIS_URL || 'redis://localhost:6379', { maxRetriesPerRequest: null });
const actionsQueue = new Queue('linkedin-actions', { connection: redisConnection as any });

async function main() {
    console.log("Testing AI Personalization flow...");

    const user = await prisma.user.findFirst();
    if (!user) {
        console.error("No user found");
        return;
    }

    const lead = await prisma.lead.findFirst();
    if (!lead) {
        console.error("No lead found");
        return;
    }

    // Ensure lead has data for AI
    await prisma.lead.update({
        where: { id: lead.id },
        data: {
            firstName: lead.firstName || 'Alex',
            company: lead.company || 'Antigravity AI',
            jobTitle: lead.jobTitle || 'Lead Engineer'
        }
    });

    // Create a campaign with AI_PERSONALIZE -> MESSAGE
    const workflow = {
        nodes: [
            { id: 'n1', type: 'TRIGGER', data: {} },
            { id: 'n2', type: 'ACTION', subType: 'AI_PERSONALIZE', data: { label: 'Generate Icebreaker' } },
            { id: 'n3', type: 'ACTION', subType: 'MESSAGE', data: { label: 'Send AI Message', message: 'Hello {firstName}, {icebreaker}. Just wanted to reach out from Neysa.' } }
        ],
        edges: [
            { id: 'e1', source: 'n1', target: 'n2' },
            { id: 'e2', source: 'n2', target: 'n3' }
        ]
    };

    const campaign = await prisma.campaign.create({
        data: {
            userId: user.id,
            name: "AI Personalization Test",
            workflowJson: workflow as any,
            status: 'ACTIVE'
        }
    });

    const campaignLead = await prisma.campaignLead.create({
        data: {
            campaignId: campaign.id,
            leadId: lead.id,
            currentStepId: 'n2', // Start at AI step
            nextActionDate: new Date(),
        }
    });

    console.log(`Adding AI job for lead ${lead.firstName}...`);
    await actionsQueue.add('ai-test-job', {
        campaignLeadId: campaignLead.id,
        userId: user.id,
        leadId: lead.id,
        currentStepId: 'n2',
        workflowJson: workflow
    });

    console.log("Job added. Run 'npm run dev' to see the worker process it.");
    console.log("Note: If you don't have OPENAI_API_KEY, it will use the fallback message.");

    process.exit(0);
}

main().catch(console.error);
