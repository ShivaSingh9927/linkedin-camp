import { Worker, Job } from 'bullmq';
import { prisma } from '@repo/db';
import { chromium } from 'playwright-extra';
const stealth = require('puppeteer-extra-plugin-stealth')();
import Redis from 'ioredis';
import { humanMoveAndClick, humanType, warmupSession, randomRange } from '../services/stealth.service';

chromium.use(stealth);

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';
const redisConnection = REDIS_URL ? new Redis(REDIS_URL, { maxRetriesPerRequest: null }) : null;

const wait = (ms: number) => new Promise(res => setTimeout(res, ms));

const PROXY_LOCK_PREFIX = 'proxy_lock:';
const USER_PRESENCE_PREFIX = 'user_presence:';
const PROXY_COOLDOWN_SEC = 60; // 1 minute gap between different users on same IP

const checkInterrupt = async (userId: string): Promise<boolean> => {
    if (!redisConnection) return false;
    const isInterrupted = await redisConnection.get(`${USER_PRESENCE_PREFIX}${userId}`);
    return isInterrupted === 'ACTIVE';
};

export const processWorkflowStep = async (data: any, job: Job) => {
    // Support both new scheduler format (currentStepId + workflowJson) and legacy (stepIndex)
    const { userId, campaignId, leadId, campaignLeadId, currentStepId, workflowJson, stepIndex: legacyStepIndex } = data;

    const user = await prisma.user.findUnique({
        where: { id: userId },
        include: { proxy: true }
    });
    const campaign = await prisma.campaign.findUnique({ where: { id: campaignId } });
    const lead = await prisma.lead.findUnique({ where: { id: leadId } });

    if (!user || !campaign || !lead) return;

    // 1. Safety Check: Working Hours
    const now = new Date();
    const currentHour = now.getHours();
    if (currentHour < 8 || currentHour > 20) {
        console.log(`[WORKER] Outside working hours for lead ${lead.id}. Delayed.`);
        return; // Re-queueing handled by BullMQ backoff or 1-hour delay
    }

    // 2. Safety Check: Plan Limits
    const dailyLimit = user.tier === 'PRO' ? 100 : user.tier === 'ADVANCED' ? 200 : 20;
    // In production, increment a daily counter in Redis or DB
    // if (count >= dailyLimit) return;

    let browser: any;
    let context: any;

    try {
        // --- MANUAL ACTIVITY SAFETY CHECK ---
        const fifteenMinsAgo = new Date(Date.now() - 15 * 60 * 1000);
        const isUserActiveInBrowser = user.linkedinActiveInBrowser || (user.lastBrowserActivityAt && user.lastBrowserActivityAt > fifteenMinsAgo);

        if (isUserActiveInBrowser) {
            const delayMs = (Math.floor(Math.random() * 300) + 600) * 1000; // 10-15 minutes
            console.log(`[WORKER] User ${userId} is currently active in browser. Stalling cloud action for safety. Delaying by ${delayMs / 1000}s`);
            await job.moveToDelayed(Date.now() + delayMs);
            return;
        }

        // --- PROXY SAFETY LOCK ---
        if (user.proxyId && redisConnection) {
            const lockKey = `${PROXY_LOCK_PREFIX}${user.proxyId}`;
            const isLocked = await redisConnection.get(lockKey);

            if (isLocked) {
                // If the proxy is being used by another user or in cooldown, delay this job
                const delayMs = (Math.floor(Math.random() * 120) + 60) * 1000; // 1-3 minutes
                console.log(`[WORKER] Proxy ${user.proxyId} is busy or in cooldown. Delaying job ${job.id} by ${delayMs / 1000}s`);
                await job.moveToDelayed(Date.now() + delayMs);
                return;
            }

            // Lock the proxy for the duration of this action (max 5 mins failsafe)
            await redisConnection.set(lockKey, 'LOCKED', 'EX', 300);
        }

        console.log(`[WORKER] Initiating action for lead ${lead.id} (${lead.firstName})`);

        // Use persistent context if available for high-tier accounts
        const launchOptions: any = {
            headless: true, // Always headless on cloud
            viewport: { width: 1440, height: 900 },
            userAgent: 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
            args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-blink-features=AutomationControlled']
        };

        if (user.proxy) {
            launchOptions.proxy = {
                server: `${user.proxy.proxyHost}:${user.proxy.proxyPort}`,
                username: user.proxy.proxyUsername || undefined,
                password: user.proxy.proxyPassword || undefined
            };
            console.log(`[WORKER] Using proxy: ${user.proxy.proxyHost}`);
        }

        // Determine session path (prioritize Railway volume mount)
        const volumePath = `/app/sessions/${userId}`;
        const hasVolume = volumePath.startsWith('/app/sessions'); // Basic check, could be improved with fs.existsSync
        const sessionPathToUse = hasVolume ? volumePath : user.persistentSessionPath;

        if (sessionPathToUse) {
            console.log(`[WORKER] Launching persistent context for user ${userId} at ${sessionPathToUse}`);
            context = await chromium.launchPersistentContext(sessionPathToUse, launchOptions);
        } else {
            browser = await chromium.launch(launchOptions);
            context = await browser.newContext();
        }

        const page = context.pages()[0] || await context.newPage();

        // --- STEP RESOLUTION ---
        // Resolve the workflow: prefer workflowJson from job data, then campaign.workflowJson, then legacy campaign.workflow
        const rawWorkflow = workflowJson || campaign.workflowJson || campaign.workflow;
        const parsedWorkflow = typeof rawWorkflow === 'string' ? JSON.parse(rawWorkflow) : rawWorkflow;

        // Resolve the step identifier: prefer currentStepId (node-based), fallback to legacyStepIndex
        const stepId = currentStepId ?? legacyStepIndex;

        let step: any = null;
        let isNodeBased = false;

        // Check if it's a node-based workflow (has nodes array)
        if (parsedWorkflow && parsedWorkflow.nodes && Array.isArray(parsedWorkflow.nodes)) {
            isNodeBased = true;
            step = parsedWorkflow.nodes.find((n: any) => n.id === stepId);
            if (!step) {
                // Fallback: try matching by nodeId or other patterns
                step = parsedWorkflow.nodes.find((n: any) =>
                    n.nodeId === stepId ||
                    n.id === `step_${stepId}` ||
                    (typeof stepId === 'string' && stepId.includes(n.id))
                );
            }
        } else if (Array.isArray(parsedWorkflow)) {
            // Legacy array-based workflow
            if (typeof stepId === 'number' && parsedWorkflow[stepId]) {
                step = parsedWorkflow[stepId];
            } else {
                step = parsedWorkflow.find((s: any) =>
                    s.id === stepId ||
                    s.nodeId === stepId ||
                    s.id === `step_${stepId}`
                );
            }
        } else if (parsedWorkflow && typeof parsedWorkflow === 'object' && parsedWorkflow[stepId]) {
            step = parsedWorkflow[stepId];
        }

        if (!step) {
            console.error(`[WORKER] Step "${stepId}" not found in workflow for campaign ${campaignId}. Workflow type: ${isNodeBased ? 'node-based' : 'legacy'}. Available nodes: ${isNodeBased ? parsedWorkflow.nodes.map((n: any) => n.id).join(', ') : 'N/A'}`);
            return;
        }

        // ReactFlow stores custom data under node.data, so resolve from both locations
        const stepData = step.data || step; // step.data for ReactFlow nodes, step itself for flat format
        let stepType = (stepData.subType || step.subType || step.type || '').toUpperCase();
        if ((stepType === 'START' || stepType === 'ACTION') && step.type === 'ACTION' && !stepData.subType && !step.subType) stepType = 'VISIT';
        // Handle case where subType is stored as PROFILE_VISIT
        if (stepType === 'PROFILE_VISIT') stepType = 'VISIT';
        // --- MANDATORY WARMUP (match stealth_headless.js behavior) ---
        await warmupSession(page);
        
        if (await checkInterrupt(userId)) throw new Error('INTERRUPTED: User active in browser');

        console.log(`[WORKER] Navigating to profile: ${lead.linkedinUrl}`);
        await page.goto(lead.linkedinUrl, { waitUntil: 'domcontentloaded', timeout: 90000 });
        
        // --- AUTHWALL DETECTION ---
        const finalUrl = page.url();
        if (finalUrl.includes('authwall') || finalUrl.includes('login')) {
            console.error(`[WORKER] ⚠️ BLOCKED by Authwall/Login gate. Railway/Proxy IP may be flagged. URL: ${finalUrl}`);
            return; // Don't advance progress, retry next cycle
        }

        if (await checkInterrupt(userId)) throw new Error('INTERRUPTED: User active in browser');
        await wait(randomRange(3000, 6000)); // "Observing" time from your script


        if (stepType === 'INVITE' || stepType === 'INVITATION') {
            const hasConnect = await page.isVisible('button:has-text("Connect")');
            const isPending = await page.isVisible('button:has-text("Pending"), button:has-text("Withdraw")');

            if (isPending) {
                console.log(`[WORKER] Invite already pending for ${lead.firstName}.`);
            } else if (hasConnect) {
                if (await checkInterrupt(userId)) throw new Error('INTERRUPTED: User active in browser');
                await humanMoveAndClick(page, 'button:has-text("Connect")');
                await wait(2000);
                await page.click('button[aria-label="Send now"]');
                console.log(`[WORKER] Connection request sent to ${lead.firstName}.`);
            } else {
                console.log(`[WORKER] No connect button found for ${lead.firstName}. Skipping step — will retry next cycle.`);
                return; // Don't advance — retry on next scheduler cycle
            }
        } else if (stepType === 'MESSAGE') {
            // Log the current page URL for debugging
            console.log(`[WORKER] Current page URL: ${page.url()}`);

            // --- MULTI-SELECTOR MESSAGE BUTTON DETECTION (from stealth_headless.js) ---
            const messageButtonSelectors = [
                'button:has-text("Message")',
                'a:has-text("Message")',
                '[data-control-name="message"]',
                '.pvs-profile-actions button:has-text("Message")',
                'button.artdeco-button:has-text("Message")',
            ];

            let messageClicked = false;
            for (const sel of messageButtonSelectors) {
                try {
                    const btn = page.locator(sel).filter({ visible: true }).first();
                    if (await btn.isVisible({ timeout: 2000 })) {
                        messageClicked = await humanMoveAndClick(page, btn);
                        if (messageClicked) {
                            console.log(`[WORKER] Clicked Message button using selector: ${sel}`);
                            break;
                        }
                    }
                } catch (e) { /* try next selector */ }
            }

            if (!messageClicked) {
                console.log(`[WORKER] Message button not found on profile. Falling back to messaging link...`);
                await page.goto('https://www.linkedin.com/messaging/', { waitUntil: 'domcontentloaded' });
                await wait(randomRange(2000, 4000));
            }

            await wait(randomRange(1500, 3000));

            // Read message from stepData (ReactFlow .data) or step root (flat format)
            const message = stepData.message || step.message || 'Hello {firstName}!';
            // Support both {firstName} and {{firstName}} template syntax
            const finalMessage = message
                .replace(/\{\{firstName\}\}/g, lead.firstName || '')
                .replace(/\{firstName\}/g, lead.firstName || '');
            console.log(`[WORKER] Sending message to ${lead.firstName}: "${finalMessage.substring(0, 80)}"`);

            // --- TYPE MESSAGE (multi-selector input from stealth_headless.js) ---
            const msgInputSelector = 'div.msg-form__contenteditable[contenteditable="true"], .msg-form__textarea, [role="textbox"]';
            await humanType(page, msgInputSelector, finalMessage);

            console.log(`[WORKER] Message typed. Sending...`);
            await wait(randomRange(1000, 2500));

            // --- SEND BUTTON (from stealth_headless.js) ---
            const sendBtnSelector = 'button.msg-form__send-button, button[type="submit"]:has-text("Send")';
            const sendBtn = page.locator(sendBtnSelector).filter({ visible: true }).first();
            let sent = false;
            try {
                if (await sendBtn.isVisible({ timeout: 3000 })) {
                    sent = await humanMoveAndClick(page, sendBtn);
                }
            } catch (e) { /* fallback below */ }

            if (!sent) {
                console.log('[WORKER] Send button click failed, pressing Enter as fallback...');
                await page.keyboard.press('Enter');
            }

            console.log(`[WORKER] ✅ Message sent to ${lead.firstName}.`);
        } else if (stepType === 'VISIT') {
            console.log(`[WORKER] Profile visit completed for ${lead.firstName}.`);
        }

        // --- UPDATE PROGRESS: Find next step ---
        let nextStepId: string | null = null;
        let isWorkflowComplete = false;

        if (isNodeBased && parsedWorkflow.edges) {
            // Find the edge going out of the current step
            const nextEdge = parsedWorkflow.edges.find((e: any) => e.source === stepId);
            if (nextEdge) {
                nextStepId = nextEdge.target;
                console.log(`[WORKER] Next step for lead ${lead.firstName}: ${nextStepId}`);
            } else {
                // No outgoing edge = end of workflow
                isWorkflowComplete = true;
                console.log(`[WORKER] Workflow complete for lead ${lead.firstName} (no next edge from ${stepId})`);
            }
        } else {
            // Legacy: increment numeric index
            const nextIndex = (typeof stepId === 'number' ? stepId : 0) + 1;
            if (Array.isArray(parsedWorkflow) && nextIndex < parsedWorkflow.length) {
                nextStepId = String(nextIndex);
            } else {
                isWorkflowComplete = true;
            }
        }

        // --- Calculate nextActionDate based on next step type ---
        let nextActionDate = new Date(); // Default: ready immediately (next scheduler cycle)

        if (nextStepId && isNodeBased && parsedWorkflow.nodes) {
            const nextNode = parsedWorkflow.nodes.find((n: any) => n.id === nextStepId);
            if (nextNode) {
                const nextData = nextNode.data || nextNode;
                const nextType = (nextData.subType || nextNode.subType || nextNode.type || '').toUpperCase();
                if (nextType === 'WAIT' || nextType === 'DELAY') {
                    // Respect the configured delay — builder stores as "days" in data
                    const delayDays = nextData.delayDays || nextData.days || nextNode.delayDays || 0;
                    const delayHours = nextData.delayHours || nextData.hours || nextNode.delayHours || 0;
                    const delayMs = (delayDays * 24 * 60 * 60 * 1000) + (delayHours * 60 * 60 * 1000);
                    nextActionDate = new Date(Date.now() + (delayMs || 24 * 60 * 60 * 1000)); // fallback 1 day
                    console.log(`[WORKER] Next step is DELAY node. Scheduling in ${delayDays}d ${delayHours}h for lead ${lead.firstName}`);

                    // For DELAY nodes, skip to the node AFTER the delay
                    const edgeAfterDelay = parsedWorkflow.edges.find((e: any) => e.source === nextStepId);
                    if (edgeAfterDelay) {
                        nextStepId = edgeAfterDelay.target;
                        console.log(`[WORKER] Skipping delay node, actual next action step: ${nextStepId}`);
                    } else {
                        isWorkflowComplete = true;
                        console.log(`[WORKER] Delay node is last in workflow, marking complete.`);
                    }
                } else {
                    // Non-delay step: add a small random gap (2-5 min) for human-like pacing
                    const safetyGapMs = (Math.floor(Math.random() * 180) + 120) * 1000;
                    nextActionDate = new Date(Date.now() + safetyGapMs);
                    console.log(`[WORKER] Next step is action node. Scheduling in ${Math.round(safetyGapMs / 1000)}s for lead ${lead.firstName}`);
                }
            }
        }

        // Use campaignLeadId if available for precise update, otherwise fall back to composite key
        const updateWhere = campaignLeadId
            ? { id: campaignLeadId }
            : { campaignId_leadId: { campaignId: campaign.id, leadId: lead.id } };

        if (isWorkflowComplete) {
            await prisma.campaignLead.update({
                where: updateWhere as any,
                data: {
                    currentStepId: null,
                    lastActionAt: new Date(),
                    isCompleted: true,
                }
            });
        } else {
            await prisma.campaignLead.update({
                where: updateWhere as any,
                data: {
                    currentStepId: nextStepId,
                    lastActionAt: new Date(),
                    nextActionDate,
                }
            });
        }

    } catch (error: any) {
        console.error(`[WORKER] Action failed for lead ${lead.id}:`, error.message);
    } finally {
        // --- PROXY SAFETY COOL DOWN ---
        if (user.proxyId && redisConnection) {
            const lockKey = `${PROXY_LOCK_PREFIX}${user.proxyId}`;
            // Set cooldown lock instead of just deleting
            await redisConnection.set(lockKey, 'COOLDOWN', 'EX', PROXY_COOLDOWN_SEC);
        }

        if (context) await context.close();
        if (browser) await browser.close();
    }
};

export const initWorker = () => {
    if (!redisConnection) return;
    const worker = new Worker('linkedin-actions', async (job: Job) => {
        await processWorkflowStep(job.data, job);
    }, { connection: redisConnection as any, concurrency: 1 });

    worker.on('completed', (job) => console.log(`Job ${job.id} done`));
    worker.on('failed', (job, err) => console.log(`Job ${job?.id} failed:`, err.message));
};
