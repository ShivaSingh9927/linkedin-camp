import cron from 'node-cron';
import { prisma } from '@repo/db';
import { Queue } from 'bullmq';
import Redis from 'ioredis';
import { enqueueInboxSync } from '../workers/inbox.worker';
import { withdrawOldInvites } from '../workers/withdraw.worker';
import { sessionValidator } from '../services/session-validator.service';
import { getStepType } from '../campaign-engine/workflow-graph';

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
          lastBrowserActivityAt: true,
          accountHealth: true
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

        // Account-health gate. The engine already refuses to launch on a
        // non-HEALTHY account — but by then we've enqueued a job, taken the
        // per-account Redis lock, and loaded the user + campaign + leads +
        // session, all to do nothing. On a 1-minute heartbeat that repeats 1440
        // times a day per stuck user.
        //
        // This matters most when `accountHealth` and `sessionInvalid` disagree,
        // which is exactly what a re-login used to cause (bug #4: the login
        // cleared sessionInvalid but left accountHealth at NEEDS_LOGIN, so this
        // loop spun forever). #4 is fixed, but OTP_REQUIRED / RESTRICTED are
        // deliberately NOT auto-healed — so they can still diverge, and this is
        // the right layer to stop it. Don't hand out work the engine will refuse.
        if (user.accountHealth && user.accountHealth !== 'HEALTHY') {
          console.log(`[Scheduler] User ${user.id} accountHealth=${user.accountHealth}. Skipping (needs user action).`);
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

        // Index the campaigns we already fetched so the per-task loop below can
        // resolve workflow/userId in memory instead of a findUnique per task
        // (that N+1 was ~55% of the scheduler loop time at 1000+ users).
        const campaignById = new Map(userCampaigns.map(c => [c.id, c]));

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
          // Resolve from the already-fetched campaigns (no per-task DB round-trip)
          const campaign = campaignById.get(task.campaignId);

          if (!campaign) continue;
          
          let jobPriority = 5;

          // Parse workflow to determine if this step is a MESSAGE
          try {
            const parsedWorkflow = typeof campaign.workflowJson === 'string'
              ? JSON.parse(campaign.workflowJson)
              : campaign.workflowJson;

            const currentNode = parsedWorkflow?.nodes?.find((n: any) => n.id === task.currentStepId);
            if (currentNode && getStepType(currentNode) === 'MESSAGE') {
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

  // 2. Inbox Sync Scheduler (Once daily at 4:00 AM).
  // Kept deliberately light per product decision: a single daily sweep plus the
  // per-campaign trigger (see campaign-worker) is enough to keep the Qampi inbox
  // current without loading the worker box. We pre-filter cheaply here — skip
  // users whose browser is active or whose session is already known-invalid —
  // so we don't even launch a headless Chromium for accounts that can't sync.
  // The worker itself still takes the per-account lock as the real guard.
  cron.schedule('0 4 * * *', async () => {
    console.log('Running daily inbox sync sweep...');
    try {
      // Gate on accountHealth as well as sessionInvalid. Those two flags can
      // disagree (a half-finished login used to clear one and not the other),
      // and when they do, filtering on sessionInvalid alone sends this sweep to
      // drive a dead account — which just launches a browser into an authwall
      // every night. accountHealth is the authoritative signal.
      const usersWithCookies = await prisma.user.findMany({
        where: {
          linkedinCookie: { not: null },
          sessionInvalid: false,
          accountHealth: 'HEALTHY',
        },
        select: { id: true, lastBrowserActivityAt: true }
      });

      const now = Date.now();
      const twoMins = 2 * 60 * 1000;
      let enqueued = 0;

      for (const user of usersWithCookies) {
        const redisPresence = redisConnection ? await redisConnection.get(`user_presence:${user.id}`) : null;
        const lastActivity = user.lastBrowserActivityAt ? new Date(user.lastBrowserActivityAt).getTime() : 0;
        if (redisPresence === 'ACTIVE' || (now - lastActivity < twoMins)) {
          // User is on LinkedIn in their own browser — don't drive the account.
          continue;
        }

        // force: this is the authoritative daily run, bypass the debounce.
        const ok = await enqueueInboxSync(user.id, { force: true });
        if (ok) enqueued++;
      }

      console.log(`[Scheduler] Daily inbox sweep enqueued ${enqueued}/${usersWithCookies.length} users.`);
    } catch (error) {
      console.error('Daily inbox sync failed:', error);
    }
  });

  // 3. Auto-Withdraw Invitations — DISABLED by default since 2026-08-08.
  //
  // This job was destroying LinkedIn sessions every night. withdrawOldInvites
  // launched Chromium with the user's real cookies but NO proxy (a dead
  // `if ((user as any).proxy)` behind a @ts-ignore — the relation was never
  // loaded and is named `Proxy` anyway), so LinkedIn saw each account jump from
  // its pinned ISP egress to the Hetzner datacenter IP, with a random user agent
  // on top. Sessions died within hours, every night, for weeks.
  //
  // It also never actually worked: 11/11 runs on 2026-08-08 logged "No sent
  // invitations found or layout changed" and withdrew nothing — the unproxied
  // browser was landing on an authwall, not the invitations page.
  //
  // withdrawOldInvites is now fixed (routes through launchAuthenticatedContext),
  // but stays off until a night of observation confirms sessions survive.
  // Re-enable with ENABLE_AUTO_WITHDRAW=true.
  if (process.env.ENABLE_AUTO_WITHDRAW === 'true') {
    cron.schedule('0 2 * * *', async () => {
      console.log('Running daily invitation auto-withdraw sync...');
      try {
        // Same health gates the 4am inbox sweep uses. Driving an account whose
        // session is already dead can only produce authwall hits from an
        // automated browser — no upside, and it looks exactly like scraping.
        const usersWithCookies = await prisma.user.findMany({
          where: {
            linkedinCookie: { not: null },
            sessionInvalid: false,
            accountHealth: 'HEALTHY',
          },
          select: { id: true, lastBrowserActivityAt: true }
        });

        const now = Date.now();
        const twoMins = 2 * 60 * 1000;

        for (const user of usersWithCookies) {
          // Don't drive the account while the user is on LinkedIn themselves.
          const redisPresence = redisConnection ? await redisConnection.get(`user_presence:${user.id}`) : null;
          const lastActivity = user.lastBrowserActivityAt ? new Date(user.lastBrowserActivityAt).getTime() : 0;
          if (redisPresence === 'ACTIVE' || (now - lastActivity < twoMins)) continue;

          // Sequentially withdraw to avoid system overload
          await withdrawOldInvites(user.id, 30);
        }
      } catch (error) {
        console.error('Auto-withdraw sync failed:', error);
      }
    });
  } else {
    console.log('[Scheduler] Auto-withdraw cron DISABLED (set ENABLE_AUTO_WITHDRAW=true to re-enable).');
  }

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
      
      // DEFERRED is the canonical "waiting for cron" state. We still match
      // `needsRetry` for rows that predate the lifecycle migration on prod;
      // the backfill SQL flips legacy needsRetry=true rows to DEFERRED, so
      // both clauses converge on the same set going forward.
      const delayedLeads = await prisma.campaignLeadProgress.findMany({
        where: {
          status: 'DEFERRED',
          nextRetryAt: { lte: now },
        },
        take: 10,
        orderBy: { nextRetryAt: 'asc' }
      });

      console.log(`[Scheduler] Found ${delayedLeads.length} leads ready for retry.`);

      // Enqueue the parent campaign ONCE per sweep, not once per matured lead.
      // runCampaign resumes every lead from its own currentNodeIndex (and
      // batch-checks acceptance internally), so a single campaign run drains
      // all of that campaign's matured leads. A stable jobId dedupes against a
      // run already queued/in-flight.
      const seenCampaigns = new Set<string>();
      for (const progress of delayedLeads) {
        if (seenCampaigns.has(progress.campaignId)) continue;
        seenCampaigns.add(progress.campaignId);
        try {
          const campaign = await prisma.campaign.findUnique({
            where: { id: progress.campaignId },
            // Capitalized `User` — the generated client uses the schema's
            // relation name; the lowercase form silently yields undefined in
            // prod (see docs on the casing drift).
            select: { id: true, userId: true, status: true, User: { select: { accountHealth: true } } },
          });

          if (!campaign || campaign.status !== 'ACTIVE') {
            console.log(`[Scheduler] Campaign ${progress.campaignId} not active, skipping.`);
            continue;
          }

          // Same account-health gate as the 1-minute heartbeat — don't resume a
          // campaign the engine is going to refuse. Matured leads stay DEFERRED
          // and get picked up on the sweep after the user recovers.
          const health = campaign.User?.accountHealth;
          if (health && health !== 'HEALTHY') {
            console.log(`[Scheduler] Campaign ${campaign.id} owner accountHealth=${health}. Skipping resume.`);
            continue;
          }

          console.log(`[Scheduler] Queueing resume for campaign ${campaign.id}`);

          if (actionQueue) {
            await actionQueue.add(
              'execute-delayed-lead',
              { campaignId: campaign.id, userId: campaign.userId },
              {
                jobId: `resume-campaign-${campaign.id}`,
                removeOnComplete: true,
                priority: 3,
              }
            );
          }
        } catch (err) {
          console.error(`[Scheduler] Failed to queue campaign ${progress.campaignId}:`, err);
        }
      }
    } catch (error) {
      console.error('[Scheduler] Delayed leads retry check failed:', error);
    }
  });
};
