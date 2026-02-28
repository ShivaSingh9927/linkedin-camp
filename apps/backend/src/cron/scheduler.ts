import cron from 'node-cron';
import { prisma } from '../server';
import { Queue } from 'bullmq';
import Redis from 'ioredis';

const redisConnection = new Redis(process.env.REDIS_URL || 'redis://localhost:6379', { maxRetriesPerRequest: null });
const actionQueue = new Queue('linkedin-actions', { connection: redisConnection as any });

export const initScheduler = () => {
  cron.schedule('*/5 * * * *', async () => {
    console.log('Running campaign scheduler heartbeat...');

    try {
      const pendingTasks = await prisma.campaignLead.findMany({
        where: {
          nextActionDate: { lte: new Date() },
          isCompleted: false,
          campaign: { status: 'ACTIVE' },
        },
        include: {
          campaign: true,
          lead: true,
        },
        take: 100, // Small batch for safety
      });

      for (const task of pendingTasks) {
        await actionQueue.add(
          'execute-workflow-step',
          {
            campaignLeadId: task.id,
            userId: task.campaign.userId,
            leadId: task.leadId,
            campaignId: task.campaignId,
            currentStepId: task.currentStepId,
            workflowJson: task.campaign.workflowJson,
          },
          {
            jobId: `task_${task.id}_step_${task.currentStepId}`,
            removeOnComplete: true,
          }
        );
      }

      if (pendingTasks.length > 0) {
        console.log(`Pushed ${pendingTasks.length} tasks to the execution queue.`);
      }
    } catch (error) {
      console.error('Scheduler heartbeat failed:', error);
    }
  });
};
