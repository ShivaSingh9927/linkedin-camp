import cron from 'node-cron';
import { PrismaClient } from '@prisma/client';
import { Queue } from 'bullmq';
import Redis from 'ioredis';

const prisma = new PrismaClient();

// Connect to your Redis instance
const redisConnection = new Redis(process.env.REDIS_URL);

// Initialize the BullMQ queue
const actionQueue = new Queue('linkedin-actions', { connection: redisConnection });

/**
 * The Heartbeat: Runs every 5 minutes
 */
cron.schedule('*/5 * * * *', async () => {
  console.log('Running campaign scheduler heartbeat...');

  try {
    // 1. Find all CampaignLeads due for an action
    const pendingTasks = await prisma.campaignLead.findMany({
      where: {
        nextActionDate: { lte: new Date() },
        isCompleted: false,
        campaign: { status: 'ACTIVE' },
      },
      // Include necessary relational data for the worker
      include: {
        campaign: true,
        lead: true,
      },
      take: 1000, // Batch limit to prevent memory crashes on huge databases
    });

    if (pendingTasks.length === 0) return;

    // 2. Iterate and push to the Redis Queue
    for (const task of pendingTasks) {
      
      // OPTIONAL BUT RECOMMENDED: Check user's daily limits here before queuing
      
      await actionQueue.add(
        'execute-workflow-step',
        {
          campaignLeadId: task.id,
          userId: task.campaign.userId,
          leadId: task.leadId,
          campaignId: task.campaignId,
          currentStepId: task.currentStepId,
          workflowJson: task.campaign.workflowJson, // Pass the DAG so the worker knows what to do
        },
        {
          // CRITICAL: Use jobId for deduplication. 
          // If the cron runs again before the worker finishes this job, 
          // BullMQ will ignore the duplicate because the ID already exists in the queue.
          jobId: `task_${task.id}_step_${task.currentStepId}`,
          removeOnComplete: true,
        }
      );
    }

    console.log(`Pushed ${pendingTasks.length} tasks to the execution queue.`);

  } catch (error) {
    console.error('Scheduler failed:', error);
  }
});