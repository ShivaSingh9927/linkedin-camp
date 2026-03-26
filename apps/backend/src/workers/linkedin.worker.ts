import { Worker, Job } from 'bullmq';
import { prisma } from '@repo/db';
import { chromium } from 'playwright-extra';
const stealth = require('puppeteer-extra-plugin-stealth')();
import Redis from 'ioredis';
import * as fs from 'fs';
import * as path from 'path';
import { humanMoveAndClick, humanType, warmupSession, randomRange } from '../services/stealth.service';
import { getOrAssignProxy } from '../services/proxy.service';

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
    let activeProxy: any = user.proxy;

    try {
        // --- MANUAL ACTIVITY SAFETY CHECK ---
        const safetyWindowMins = 2;
        const safetyTimeAgo = new Date(Date.now() - safetyWindowMins * 60 * 1000);

        // Check if user is active in extension OR had activity in last 2 minutes
        const isUserActiveInBrowser = user.linkedinActiveInBrowser && (user.lastBrowserActivityAt && user.lastBrowserActivityAt > safetyTimeAgo);

        if (isUserActiveInBrowser) {
            console.log(`[WORKER] Safety: User ${userId} is active in browser. Skipping cloud task this turn. Redo in next sync circle.`);
            return;
        }

        // --- ENSURE PROXY ASSIGNMENT ---
        if (!activeProxy) {
            console.log(`[WORKER] No proxy assigned for user ${userId}. Fetching from DB pool...`);
            activeProxy = await getOrAssignProxy(userId);
            if (!activeProxy) {
                console.warn(`[WORKER] Could not assign proxy for ${userId}. Relying on internal Oxylabs fallback.`);
            }
        }

        // --- PROXY SAFETY LOCK ---
        if (activeProxy && activeProxy.id && redisConnection) {
            const lockKey = `${PROXY_LOCK_PREFIX}${activeProxy.id}`;
            const isLocked = await redisConnection.get(lockKey);

            if (isLocked) {
                // If the proxy is being used by another user or in cooldown, delay this job
                const delayMs = (Math.floor(Math.random() * 120) + 60) * 1000; // 1-3 minutes
                console.log(`[WORKER] Proxy ${activeProxy.id} is busy or in cooldown. Delaying job ${job.id} by ${delayMs / 1000}s`);
                await job.moveToDelayed(Date.now() + delayMs);
                return;
            }

            // Lock the proxy for the duration of this action (max 5 mins failsafe)
            await redisConnection.set(lockKey, 'LOCKED', 'EX', 300);
        }

        console.log(`[WORKER] Initiating action for lead ${lead.id} (${lead.firstName})`);

        // Determine session path (prioritize Railway volume mount)
        const isCloud = process.env.RAILWAY_ENVIRONMENT || process.env.NODE_ENV === 'production';
        const baseSessionDir = isCloud ? '/app/sessions' : path.join(process.cwd(), 'sessions');
        const sessionPathToUse = user.persistentSessionPath || path.join(baseSessionDir, userId);

        let userAgentStr = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36';
        let viewportSettings = { width: 1440, height: 900 };

        try {
            const fingerprintPath = path.join(sessionPathToUse, 'fingerprint.json');
            if (fs.existsSync(fingerprintPath)) {
                const fpData = JSON.parse(fs.readFileSync(fingerprintPath, 'utf-8'));
                if (fpData.userAgent) {
                    userAgentStr = fpData.userAgent;
                    console.log(`[WORKER] Loaded custom User-Agent from fingerprint: ${userAgentStr.substring(0, 50)}...`);
                }
                if (fpData.screen && fpData.screen.width && fpData.screen.height) {
                    viewportSettings = { width: fpData.screen.width, height: fpData.screen.height };
                }
            }
        } catch (e) {
            console.error('[WORKER] Error reading fingerprint:', e);
        }

        // Use persistent context if available for high-tier accounts
        const launchOptions: any = {
            headless: false, // Switch to headed (requires XVFB) for maximum stealth
            viewport: viewportSettings,
            userAgent: userAgentStr,
            args: [
                '--no-sandbox', 
                '--disable-setuid-sandbox', 
                '--disable-blink-features=AutomationControlled',
                '--start-maximized',
                '--disable-web-security',
                '--disable-features=IsolateOrigins,site-per-process'
            ]
        };

        if (activeProxy) {
            launchOptions.proxy = {
                server: `${activeProxy.proxyHost}:${activeProxy.proxyPort}`,
                username: activeProxy.proxyUsername || undefined,
                password: activeProxy.proxyPassword || undefined
            };
            console.log(`[WORKER] Using DB proxy: ${activeProxy.proxyHost}`);
        } else {
            // Dedicated ISP Proxy fallback to avoid LinkedIn ban
            launchOptions.proxy = {
                server: 'http://disp.oxylabs.io:8001',
                username: 'user-shivasingh_clgdY',
                password: 'Iamironman_3'
            };
            console.log(`[WORKER] Using dedicated ISP proxy (Oxylabs) to avoid ban`);
        }

        // Apply locale/timezone from phase2 to match identity (or default to IN)
        launchOptions.locale = 'en-IN';
        launchOptions.timezoneId = 'Asia/Kolkata';
        launchOptions.viewport = null; // matching phase2 script

        if (user.persistentSessionPath && fs.existsSync(user.persistentSessionPath)) {
            console.log(`[WORKER] Launching persistent context for user ${userId} at ${sessionPathToUse}`);
            context = await chromium.launchPersistentContext(sessionPathToUse, launchOptions);
        } else {
            console.log(`[WORKER] Launching standard browser for ${userId} (no persistent context on server)`);
            browser = await chromium.launch(launchOptions);
            context = await browser.newContext(launchOptions);
        }
        
        // --- ALWAYS LOAD COOKIES FROM DB (Forces sync parity) ---
        if (user.linkedinCookie) {
            try {
                const domainToInject = user.proxy ? '.linkedin.com' : 'linkedin.com'; // Adjust based on proxy env
                const cookies = JSON.parse(user.linkedinCookie);
                
                // Basic sanity check: ensure we have an array
                if (Array.isArray(cookies)) {
                     console.log(`[WORKER] Forcing Injection of ${cookies.length} cookies from DB for user ${userId}`);
                     await context.addCookies(cookies);
                } else {
                     // Fallback for single li_at string
                     console.log(`[WORKER] Forcing Injection of li_at cookie for user ${userId}`);
                     await context.addCookies([{ 
                         name: 'li_at', 
                         value: user.linkedinCookie, 
                         domain: '.linkedin.com', 
                         path: '/',
                         secure: true, 
                         httpOnly: true, 
                         sameSite: 'Lax' 
                     }]);
                }
            } catch (e) {
                console.error('[WORKER] Error parsing cookies from DB:', e);
            }
        }

        // --- INJECT STORAGE IDENTITY ---
        // Even in persistent mode, we inject localStorage if available to ensure the Voyager headers/identity match the extension
        if (user.linkedinLocalStorage) {
            try {
                const localStorageData = JSON.parse(user.linkedinLocalStorage);
                console.log(`[WORKER] Injecting localStorage identity for user ${userId}`);
                await context.addInitScript((data: any) => {
                    const parsed = JSON.parse(data);
                    for (const [k, v] of Object.entries(parsed)) {
                        window.localStorage.setItem(k, v as string);
                    }
                }, JSON.stringify(localStorageData));
            } catch (e) {
                console.error('[WORKER] Error parsing localStorage from DB:', e);
            }
        }

        const page = context.pages()[0] || await context.newPage();

        // --- MASTER MIRROR MODE: Using fully synced persistent context folder ---
        console.log(`[WORKER] 🧬 PERSISTENT CONTEXT MODE: Mirror has landed. (Using full session directory)`);

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

        // --- MASTER STEALTH WARMUP (v2 Strategy) ---
        console.log('[WORKER] Step 1: Human Warmup (Feeding scrolling)...');
        try {
            await page.goto('https://www.linkedin.com/feed/', { waitUntil: 'domcontentloaded', timeout: 30000 });
            for (let i = 0; i < 2; i++) {
                await page.mouse.wheel(0, randomRange(300, 600));
                await wait(randomRange(1500, 3000));
            }
        } catch (e) {
            console.warn('[WORKER] Warmup delay, proceeding...');
        }

        // --- SESSION VALIDATION (ROBUST) ---
        const finalUrl = page.url();
        const isLoggedIn = await page.isVisible('.global-nav') || await page.isVisible('#global-nav');
        const isAuthWall = finalUrl.includes('authwall') || finalUrl.includes('login') || finalUrl.includes('checkpoint');

        if (isAuthWall || !isLoggedIn) {
            console.log(`[WORKER] ⚠️ Session invalid. URL: ${finalUrl}, LoggedInElement: ${isLoggedIn}`);
            
            // NOTE: We no longer auto-clear the session path here immediately.
            // A proxy timeout might trigger this page redirect. Let the user re-sync manually 
            // without destructively wiping the database state yet.

            // Send notification to user
            await prisma.notification.create({
                data: {
                    userId,
                    title: 'LinkedIn Session Expired',
                    body: 'Your LinkedIn session has expired. Please go to Settings and click Sync LinkedIn to re-authenticate.',
                    type: 'ERROR'
                }
            });
            return;
        }

        // --- PHASE 2: HUMAN-STYLE SEARCH NAVIGATION ---
        console.log('[WORKER] Phase 2: Human-style Search for Profile...');
        const searchInput = page.locator('input[placeholder="Search"], #global-nav-typeahead input, .search-global-typeahead__input').first();
        
        try {
            await searchInput.waitFor({ state: 'visible', timeout: 20000 });
            await wait(randomRange(1000, 3000));
            await searchInput.click();
            
            const profileSlug = lead.linkedinUrl.split('/in/')[1]?.replace('/', '') || lead.firstName + ' ' + lead.lastName;
            await humanType(page, searchInput, profileSlug);
            await wait(randomRange(1200, 2500));
            await page.keyboard.press('Enter');
        } catch (e) {
             console.log("[WORKER] ⚠️ Standard search bar selector failed. Trying fallback click...");
             await page.click('.search-global-typeahead__collapsed-search-button', { timeout: 5000 }).catch(() => {});
             await wait(2000);
             const profileSlug = lead.linkedinUrl.split('/in/')[1]?.replace('/', '') || lead.firstName + ' ' + lead.lastName;
             await humanType(page, searchInput, profileSlug);
             await page.keyboard.press('Enter');
        }

        console.log('✅ Search submitted. Waiting for results...');
        await wait(randomRange(6000, 10000));

        // Now move to the profile. This will now appear as a search-driven view in history.
        await page.goto(lead.linkedinUrl, { 
            waitUntil: 'domcontentloaded', 
            timeout: 60000 
        }); 
        await wait(randomRange(5000, 10000)); 

        console.log(`[WORKER] Profile loaded successfully: ${finalUrl}`);
        await wait(randomRange(4000, 8000)); // Increased profile "observing" time

        // if (await checkInterrupt(userId)) throw new Error('INTERRUPTED: User active in browser');
        await wait(randomRange(3000, 6000)); // "Observing" time from your script


        if (stepType === 'INVITE' || stepType === 'INVITATION') {
            const hasConnect = await page.isVisible('button:has-text("Connect")');
            const isPending = await page.isVisible('button:has-text("Pending"), button:has-text("Withdraw")');

            if (isPending) {
                console.log(`[WORKER] Invite already pending for ${lead.firstName}.`);
            } else if (hasConnect) {
                // if (await checkInterrupt(userId)) throw new Error('INTERRUPTED: User active in browser');
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

            // --- MULTI-SELECTOR MESSAGE BUTTON DETECTION ---
            const messageButtonSelectors = [
                '.pvs-profile-actions button:has-text("Message")', 
                'button.artdeco-button:has-text("Message")',
                'button:has-text("Message")',
                'a:has-text("Message")',
                '[data-control-name="message"]',
            ];

            const msgInputSelector = 'div.msg-form__contenteditable[contenteditable="true"], .msg-form__textarea, [role="textbox"]';
            
            // --- DIRECT COMPOSE URL EXTRACTION (Phase 2 Strategy) ---
            console.log('[WORKER] Extracting compose URL...');
            const composeUrl = await page.evaluate(() => {
                const link = document.querySelector('a[href*="/messaging/compose/?profileUrn"]');
                return link ? (link as HTMLAnchorElement).href : null;
            });

            if (composeUrl) {
                console.log(`[WORKER] ✅ Compose URL found: ${composeUrl}`);
                await wait(randomRange(2000, 4000));

                console.log('[WORKER] Opening messaging directly via compose URL...');
                await page.goto(composeUrl, { waitUntil: 'domcontentloaded' });
                await wait(randomRange(15000, 20000));
            } else {
                console.log('[WORKER] Compose URL not found in profile. Falling back to MESSAGE button approach...');
                // Always close existing chat bubbles to prevent typing to the wrong person
                const closeBtns = await page.locator('button.msg-overlay-bubble-header__control--close-btn').all();
                for (const btn of closeBtns) {
                    try {
                        await btn.click({ force: true });
                        await wait(500);
                    } catch (e) {}
                }

                let messageClicked = false;
                for (const sel of messageButtonSelectors) {
                    try {
                        const btn = page.locator(sel).filter({ visible: true }).first();
                        if (await btn.isVisible({ timeout: 12000 })) {
                            messageClicked = await humanMoveAndClick(page, btn);
                            if (messageClicked) {
                                console.log(`[WORKER] ✅ SUCCESS: Clicked Message button using selector: ${sel}`);
                                // Critical: wait for modal to load network data
                                await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
                                await wait(3000);
                                break;
                            }
                        }
                    } catch (e) { 
                        console.log(`[WORKER] Skipping selector: ${sel}`);
                    }
                }

                if (!messageClicked) {
                     await page.screenshot({ path: '/app/error_profile.png' });
                     console.log(`[WORKER] Message button not found. Saved screenshot to /app/error_profile.png`);
                     console.log(`[WORKER] Falling back to messaging link...`);
                     await page.goto('https://www.linkedin.com/messaging/', { waitUntil: 'domcontentloaded' });
                     await wait(randomRange(2000, 4000));
                }
            }

            await wait(randomRange(1500, 3000));
            
            // Ensure input is visible and focused
            const msgBox = page.locator(msgInputSelector).first();
            try {
                await msgBox.scrollIntoViewIfNeeded();
                await msgBox.waitFor({ state: 'visible', timeout: 15000 });
            } catch (e) {
                await page.screenshot({ path: '/app/error_modal.png' });
                console.error(`[WORKER] ❌ FAILED: Message box did not appear after click. Saved screenshot to /app/error_modal.png`);
                return;
            }

            // Read message from stepData (ReactFlow .data) or step root (flat format)
            const message = stepData.message || step.message || 'Hello {firstName}!';
            // Support both {firstName} and {{firstName}} template syntax
            const finalMessage = message
                .replace(/\{\{firstName\}\}/g, lead.firstName || '')
                .replace(/\{firstName\}/g, lead.firstName || '');
            console.log(`[WORKER] Sending message to ${lead.firstName}: "${finalMessage.substring(0, 80)}"`);

            const typed = await humanType(page, msgInputSelector, finalMessage);

            if (!typed) {
                console.warn(`[WORKER] ⚠️ FAILED: Could not type into message box for ${lead.firstName}. Current URL: ${page.url()}`);
                return; // Retry next cycle
            }

            // LinkedIn "Send" button fix: ensure the browser triggers input events
            await page.locator(msgInputSelector).first().evaluate((el: any) => {
                el.dispatchEvent(new Event('input', { bubbles: true }));
                el.dispatchEvent(new Event('change', { bubbles: true }));
            });

            console.log(`[WORKER] Message typed and events triggered. Final check before sending...`);
            await wait(randomRange(2500, 4000));

            // --- SEND BUTTON (Robust Multi-Phase) ---
            const sendBtnSelector = 'button.msg-form__send-button, button[type="submit"]:has-text("Send"), .msg-form__footer button:has-text("Send")';
            const sendBtn = page.locator(sendBtnSelector).filter({ visible: true }).first();
            
            let sent = false;
            try {
                if (await sendBtn.isVisible({ timeout: 10000 })) {
                    // Phase 1: Human Click
                    sent = await humanMoveAndClick(page, sendBtn);
                    await wait(2000);

                    // Phase 2: If box still there, Force Click (Ghost-Buster)
                    if (await page.locator(msgInputSelector).first().isVisible()) {
                         console.log('[WORKER] Message box still visible. Attempting Force Click...');
                         await sendBtn.click({ force: true });
                         await wait(2000);
                    }
                }
            } catch (e: any) { 
                console.warn(`[WORKER] Send sequence encountered issue: ${e.message}`);
            }

            // Phase 3: Final Fallback - Enter
            if (await page.locator(msgInputSelector).first().isVisible()) {
                console.log('[WORKER] Still visible. Final fallback: Enter...');
                await page.keyboard.press('Enter');
                await wait(3000);
            }

            // POST-SEND VERIFICATION
            const boxRemaining = await page.locator(msgInputSelector).first().isVisible();
            if (boxRemaining) {
                 console.error(`[WORKER] ❌ FAILED: Message box still visible after all attempts.`);
                 await page.screenshot({ path: `/app/error_send_${leadId}.png` });
                 return;
            } else {
                 console.log(`[WORKER] ✅ SUCCESS: Message sent to ${lead.firstName}.`);
            }
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
        let finalProxyId = user.proxyId;
        // if user.proxyId was null at start but activeProxy got assigned during the task, use it:
        if (!finalProxyId && activeProxy) {
            finalProxyId = activeProxy.id;
        }

        if (finalProxyId && redisConnection) {
            const lockKey = `${PROXY_LOCK_PREFIX}${finalProxyId}`;
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
