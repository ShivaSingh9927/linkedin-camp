import { PrismaClient } from '@prisma/client';
import { processWorkflowStep } from '../workers/linkedin.worker';
import Redis from 'ioredis';

const prisma = new PrismaClient();
const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';
const redisConnection = new Redis(REDIS_URL);
const PROXY_LOCK_PREFIX = 'proxy_lock:';

async function main() {
    console.log('🚀 INITIALIZING DIRECT-CLOUD NO-PROXY TEST (MASTER MIRROR)');
    const userId = '09cae3b3-585e-4b0d-bdb1-f7be855725e1';
    
    // 🔓 WE WILL USE THE PROXY FOR THIS TEST
    console.log('🛡️ USING ASSIGNED PROXY TO BYPASS AUTH-GATE...');
    await redisConnection.del(`${PROXY_LOCK_PREFIX}*`);
    await prisma.user.update({
        where: { id: userId },
        data: { linkedinActiveInBrowser: false }
    });
    // 1. Ensure a fresh test campaign exists
    let campaign = await prisma.campaign.findFirst({
        where: { userId, name: 'DEBUG_NO_PROXY_TEST' }
    });

    if (!campaign) {
        campaign = await prisma.campaign.create({
            data: {
                userId,
                name: 'DEBUG_NO_PROXY_TEST',
                workflowJson: JSON.stringify({
                    nodes: [
                        { id: 'start', type: 'START', data: {} },
                        { id: 'msg_node', type: 'ACTION', data: { subType: 'MESSAGE', message: 'Hello {firstName}! This is a Direct-Cloud Master Mirror test without proxy.' } }
                    ],
                    edges: [
                        { id: 'e1', source: 'start', target: 'msg_node' }
                    ]
                })
            }
        });
    }

    // 2. Ensure lead is enrolled
    const leadId = 'b0ea94f9-029f-456d-9bff-de1523684715'; // Shiva Singh lead
    let campaignLead = await prisma.campaignLead.findUnique({
        where: { campaignId_leadId: { campaignId: campaign.id, leadId } }
    });

    if (!campaignLead) {
        console.log('Enroll new lead...');
        // @ts-ignore
        campaignLead = await prisma.campaignLead.create({
            data: {
                campaignId: campaign.id,
                leadId,
                currentStepId: 'msg_node'
            }
        });
    } else {
        console.log('Update existing lead enrollment...');
        // @ts-ignore
        await prisma.campaignLead.update({
            where: { id: campaignLead.id },
            data: { currentStepId: 'msg_node' }
        });
    }

    console.log(`✅ NO-PROXY TEST CAMPAIGN READY. ID: ${campaign.id}`);
    console.log('🤖 TRIGGERING DIRECT-CLOUD WORKER LOGIC...');

    try {
        await processWorkflowStep({
            userId,
            campaignId: campaign.id,
            leadId,
            campaignLeadId: campaignLead.id,
            currentStepId: 'msg_node'
        }, { 
            id: 'test_no_proxy_job',
            moveToDelayed: async () => { console.log('Job moved to delayed.'); }
        } as any);
        
        console.log('✨ WORKER LOGIC FINISHED.');
    } catch (e: any) {
        console.error('❌ WORKER CRASHED:', e.message);
    } finally {
        await prisma.$disconnect();
        process.exit(0);
    }
}

main().catch(console.error);
