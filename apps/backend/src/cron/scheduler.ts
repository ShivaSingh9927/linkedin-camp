import cron from 'node-cron';
import { prisma } from '../server';
import { Queue } from 'bullmq';
import Redis from 'ioredis';
import { syncInbox } from '../workers/inbox.worker';
import { withdrawOldInvites } from '../workers/withdraw.worker';

let redisConnection: any;
let actionQueue: any;

try {
  redisConnection = new Redis(process.env.REDIS_URL || 'redis://localhost:6379', { maxRetriesPerRequest: null });
  redisConnection.on('error', (err: any) => console.log('Redis Scheduler Error:', err.message));
  actionQueue = new Queue('linkedin-actions', { connection: redisConnection as any });
} catch (e) {
  console.error('Failed to init Redis in scheduler:', e);
}

export const initScheduler = () => {
  if (!actionQueue) {
    console.warn('Scheduler skipped initialization due to no Redis connection.');
    return;
  }

  // 1. Campaign Step Scheduler (Every 5 mins)
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
        let jobPriority = 5; // Default low priority for Invites / visits

        // Parse workflow to determine if this step is a MESSAGE
        try {
            const parsedWorkflow = typeof task.campaign.workflowJson === 'string' 
                ? JSON.parse(task.campaign.workflowJson) 
                : task.campaign.workflowJson;
                
            const currentNode = parsedWorkflow?.nodes?.find((n: any) => n.id === task.currentStepId);
            if (currentNode && currentNode.subType === 'MESSAGE') {
                jobPriority = 2; // Campaign messages get Priority 2
            }
        } catch (e) {
            console.error('Failed to parse workflow for priority detection', e);
        }

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
            priority: jobPriority
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

  // 2. Inbox Sync Scheduler (Every 15 mins)
  cron.schedule('*/15 * * * *', async () => {
    console.log('Running global inbox sync...');
    try {
      const usersWithCookies = await prisma.user.findMany({
        where: { linkedinCookie: { not: null } },
        select: { id: true }
      });

      for (const user of usersWithCookies) {
        // Run sync sequentially to avoid parallel browser instances overload
        await syncInbox(user.id);
      }
    } catch (error) {
      console.error('Global inbox sync failed:', error);
    }
  });

  // 3. Auto-Withdraw Invitations (Run Daily at 2:00 AM)
  cron.schedule('0 2 * * *', async () => {
    console.log('Running daily invitation auto-withdraw sync...');
    try {
      const usersWithCookies = await prisma.user.findMany({
        where: { linkedinCookie: { not: null } },
        select: { id: true }
      });

      for (const user of usersWithCookies) {
        // Sequentially withdraw to avoid system overload
        await withdrawOldInvites(user.id, 30);
      }
    } catch (error) {
      console.error('Auto-withdraw sync failed:', error);
    }
  });

};
