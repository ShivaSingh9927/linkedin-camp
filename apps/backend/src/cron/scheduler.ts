import cron from 'node-cron';
import { prisma } from '@repo/db';
import { Queue } from 'bullmq';
import Redis from 'ioredis';
import { syncInbox, inboxQueue } from '../workers/inbox.worker';
import { withdrawOldInvites } from '../workers/withdraw.worker';
import { sessionValidator } from '../services/session-validator.service';

let redisConnection: any;
let actionQueue: any;

try {
  redisConnection = new Redis(process.env.REDIS_URL || 'redis://localhost:6379', { maxRetriesPerRequest: null });
  redisConnection.on('error', (err: any) => console.log('Redis Scheduler Error:', err.message));
  actionQueue = new Queue('campaign-actions', { connection: redisConnection as any });
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
      // Fetch users who have active campaigns by checking the Campaign table directly
      const activeCampaigns = await prisma.campaign.findMany({
        where: { status: 'ACTIVE' },
        select: { userId: true }
      });
      
      const userIds = [...new Set(activeCampaigns.map(c => c.userId))];
      
      const activeUsers = await prisma.user.findMany({
        where: { id: { in: userIds } },
        select: { 
          id: true, 
          linkedinCookie: true,
          persistentSessionPath: true,
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
const isUserActive = redisPresence === 'ACTIVE' || (now - lastActivity < twoMins);
        
        if (isUserActive) {
          console.log(`[Scheduler] User ${user.id} is active (browser). Skipping cloud scheduler for safety.`);
          continue;
        }

        const quickStatus = await sessionValidator.quickCheck(user.id);
        if (quickStatus.sessionInvalid) {
          console.log(`[Scheduler] User ${user.id} session is marked invalid. Skipping.`);
          continue;
        }

        // Check for ANY form of session
        if (!user.linkedinCookie && !user.persistentSessionPath) {
          console.log(`[Scheduler] User ${user.id} has no LinkedIn session (cookie or persistent). Skipping.`);
          continue; 
        }

        // Get user's active campaigns
        const userCampaigns = await prisma.campaign.findMany({
          where: { userId: user.id, status: 'ACTIVE' }
        });
        
        const campaignIds = userCampaigns.map(c => c.id);
        
        if (campaignIds.length === 0) continue;

        const userPendingTasks = await prisma.campaignLead.findMany({
          where: {
            campaignId: { in: campaignIds },
            nextActionDate: { lte: new Date() },
            isCompleted: false,
          },
          take: 5,
        });

        console.log(`[Scheduler] User ${user.id}: Found ${userPendingTasks.length} pending tasks.`);

        for (const task of userPendingTasks) {
          // Fetch campaign separately
          const campaign = await prisma.campaign.findUnique({
            where: { id: task.campaignId },
            select: { userId: true, workflowJson: true }
          });
          
          if (!campaign) continue;
          
          let jobPriority = 5;

          // Parse workflow to determine if this step is a MESSAGE
          try {
            const parsedWorkflow = typeof campaign.workflowJson === 'string'
              ? JSON.parse(campaign.workflowJson)
              : campaign.workflowJson;

            const currentNode = parsedWorkflow?.nodes?.find((n: any) => n.id === task.currentStepId);
            if (currentNode && currentNode.subType === 'MESSAGE') {
              jobPriority = 2;
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
              userId: campaign.userId,
              leadId: task.leadId,
              campaignId: task.campaignId,
              currentStepId: task.currentStepId,
              workflowJson: campaign.workflowJson,
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

  // 2. Inbox Sync Scheduler (Every 6 hours)
  cron.schedule('0 */6 * * *', async () => {
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

  // 4. Onboarding Reminder Scheduler (Every 12 hours)
  cron.schedule('0 0,12 * * *', async () => {
    console.log('[Scheduler] Running onboarding reminder check...');
    try {
      const { mailService } = await import('../services/mail.service');
      
      const twelveHoursAgo = new Date(Date.now() - 12 * 60 * 60 * 1000);
      
      const abandonedUsers = await prisma.user.findMany({
        where: {
          registrationStep: { not: 'COMPLETED' },
          lastOnboardingEmailAt: null,
          createdAt: { lte: twelveHoursAgo }
        }
      });

      console.log(`[Scheduler] Found ${abandonedUsers.length} abandoned signups.`);

      for (const user of abandonedUsers) {
        try {
          await mailService.sendOnboardingReminder(user.email, user.firstName || 'there');
          
          // Mark as sent so we never nudge again
          await prisma.user.update({
            where: { id: user.id },
            data: { lastOnboardingEmailAt: new Date() }
          });
        } catch (mailError) {
          console.error(`[Scheduler] Failed to send reminder to ${user.email}:`, mailError);
        }
      }
    } catch (error) {
      console.error('[Scheduler] Onboarding reminder process failed:', error);
    }
  });

  // 5. Delayed Leads Retry Scheduler (Every 5 minutes)
  // Handles leads that were paused due to delay node and need to retry
  cron.schedule('*/5 * * * *', async () => {
    console.log('[Scheduler] Running delayed leads retry check...');
    
    try {
      const now = new Date();
      
      const delayedLeads = await prisma.campaignLeadProgress.findMany({
        where: {
          needsRetry: true,
          nextRetryAt: { lte: now },
          completedAt: null
        },
        take: 10,
        orderBy: { nextRetryAt: 'asc' }
      });

      console.log(`[Scheduler] Found ${delayedLeads.length} leads ready for retry.`);

      for (const progress of delayedLeads) {
        try {
          const campaign = await prisma.campaign.findUnique({
            where: { id: progress.campaignId },
            select: { 
              id: true, 
              userId: true, 
              workflowJson: true,
              status: true
            }
          });

          if (!campaign || campaign.status !== 'ACTIVE') {
            console.log(`[Scheduler] Campaign ${progress.campaignId} not active, skipping.`);
            continue;
          }

          const lead = await prisma.lead.findUnique({
            where: { id: progress.leadId }
          });

          if (!lead) {
            console.log(`[Scheduler] Lead ${progress.leadId} not found, skipping.`);
            continue;
          }

          console.log(`[Scheduler] Queueing retry for lead ${lead.firstName} in campaign ${campaign.id}`);

          const jobId = `retry_${progress.id}`;

          if (actionQueue) {
            await actionQueue.add(
              'execute-delayed-lead',
              {
                campaignLeadProgressId: progress.id,
                campaignId: campaign.id,
                userId: campaign.userId,
                leadId: progress.leadId,
                currentNodeIndex: progress.currentNodeIndex,
                workflowJson: campaign.workflowJson,
              },
              {
                jobId,
                removeOnComplete: true,
                priority: 3,
              }
            );
          }
        } catch (err) {
          console.error(`[Scheduler] Failed to queue delayed lead ${progress.id}:`, err);
        }
      }
    } catch (error) {
      console.error('[Scheduler] Delayed leads retry check failed:', error);
    }
  });
};
