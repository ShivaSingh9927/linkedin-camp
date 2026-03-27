import cron from 'node-cron';
import { prisma } from '@repo/db';
import { Queue } from 'bullmq';
import Redis from 'ioredis';
import { syncInbox, inboxQueue } from '../workers/inbox.worker';
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

  // 1. Campaign Step Scheduler (Every 1 minute)
  cron.schedule('*/1 * * * *', async () => {
    console.log('Running campaign scheduler heartbeat...');

    try {
      // Fetch users who are actively running campaigns
      const activeUsers = await prisma.user.findMany({
        where: { campaigns: { some: { status: 'ACTIVE' } } },
        select: { 
          id: true, 
          linkedinCookie: true,
          persistentSessionPath: true, // ADDED
          linkedinActiveInBrowser: true,
          lastBrowserActivityAt: true
        }
      });

      let totalPushed = 0;

      // Round Robin: Process up to 5 pending leads per user per cycle
      console.log(`[Scheduler] Found ${activeUsers.length} users with ACTIVE campaigns.`);
      for (const user of activeUsers) {
        // NEW: Check Redis presence first (fastest, expires in 60s)
        const redisPresence = redisConnection ? await redisConnection.get(`user_presence:${user.id}`) : null;
        
        const now = new Date().getTime();
        const twoMins = 2 * 60 * 1000;
        const lastActivity = user.lastBrowserActivityAt ? new Date(user.lastBrowserActivityAt).getTime() : 0;
        
        // Skip only if Redis says ACTIVE OR DB activity is very recent (< 2 mins)
        const isExtensionActive = redisPresence === 'ACTIVE' || (user.linkedinActiveInBrowser && (now - lastActivity < twoMins));

        if (isExtensionActive) {
          console.log(`[Scheduler] User ${user.id} is active on extension (laptop). Skipping cloud scheduler for safety.`);
          continue;
        }

        // Check for ANY form of session
        if (!user.linkedinCookie && !user.persistentSessionPath) {
          console.log(`[Scheduler] User ${user.id} has no LinkedIn session (cookie or persistent). Skipping.`);
          continue; 
        }

        const userPendingTasks = await prisma.campaignLead.findMany({
          where: {
            campaign: { userId: user.id, status: 'ACTIVE' },
            nextActionDate: { lte: new Date() },
            isCompleted: false,
          },
          include: {
            campaign: true,
            lead: true,
          },
          take: 5, // Process max 5 tasks per user per 5 mins to ensure fairness
        });

        console.log(`[Scheduler] User ${user.id}: Found ${userPendingTasks.length} pending tasks.`);

        for (const task of userPendingTasks) {
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

          // Generate a unique deduplication id so we don't double queue the same step
          const jobId = `task_${task.id}_step_${task.currentStepId}`;

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
              jobId,
              removeOnComplete: true,
              priority: jobPriority,
            }
          );
          totalPushed++;
        }
      }

      if (totalPushed > 0) {
        console.log(`Pushed ${totalPushed} tasks to the execution queue across ${activeUsers.length} active users.`);
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
        if (inboxQueue) {
          await inboxQueue.add('inbox-sync', { userId: user.id }, { removeOnComplete: true });
        } else {
          // Fallback if queue not ready (though it should be)
          await syncInbox(user.id);
        }
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
