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

    // 1. Safety Check: Working Hours (Temporarily disabled for testing)
    // const options = { timeZone: 'Asia/Kolkata', hour: 'numeric', hour12: false } as const;
    // const currentHour = parseInt(new Intl.DateTimeFormat('en-US', options).format(new Date()), 10);
    // if (currentHour < 8 || currentHour > 20) {
    //     console.log(`[WORKER] Outside working hours (Hour: ${currentHour} IST) for lead ${lead.id}. Delayed.`);
    //     return; // Re-queueing handled by BullMQ backoff or 1-hour delay
    // }

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

        // Separated Options to match phase2.js structure
        const launchOptions: any = {
            headless: false,
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-blink-features=AutomationControlled',
                '--start-maximized',
                '--disable-web-security'
            ]
        };

        const contextOptions: any = {
            userAgent: userAgentStr,
            viewport: null, // Allow browser to define
            locale: 'en-IN',
            timezoneId: 'Asia/Kolkata'
        };

        if (activeProxy) {
            contextOptions.proxy = {
                server: `http://${activeProxy.proxyHost}:${activeProxy.proxyPort}`,
                username: activeProxy.proxyUsername || undefined,
                password: activeProxy.proxyPassword || undefined
            };
            console.log(`[WORKER] Using DB proxy: ${activeProxy.proxyHost}`);
        } else {
            // Dedicated ISP Proxy fallback to avoid LinkedIn ban
            contextOptions.proxy = {
                server: 'http://disp.oxylabs.io:8001',
                username: 'user-shivasingh_clgdY',
                password: 'Iamironman_3'
            };
            console.log(`[WORKER] Using dedicated ISP proxy (Oxylabs) to avoid ban`);
        }

        // We strictly mimic phase2.js: standard launch + fresh context + injection
        console.log(`[WORKER] Launching standard browser for ${userId} (Mirroring phase2.js behavior)`);
        browser = await chromium.launch(launchOptions);
        context = await browser.newContext(contextOptions);

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

        // --- RESOURCE BLOCKING (Mirroring phase2.js Performance) ---
        await page.route('**/*', (route: any) => {
            const type = route.request().resourceType();
            const url = route.request().url();
            if (['image', 'media', 'font'].includes(type) || url.includes('analytics') || url.includes('ads')) {
                return route.abort();
            }
            return route.continue();
        });

        console.log(`[WORKER] 🧬 IN-MEMORY CONTEXT MODE: Fresh session seeded from DB.`);

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

        // --- DIRECT PROFILE NAVIGATION (Phase 2 pattern — no /feed/ warmup) ---
        // Phase 2 test script works because it goes directly to the target page.
        // Navigating to /feed/ first causes LinkedIn to rotate session tokens
        // in a new browser context, which invalidates the session.
        console.log(`[WORKER] Navigating directly to lead profile: ${lead.linkedinUrl}`);
        await page.goto(lead.linkedinUrl, {
            waitUntil: 'domcontentloaded',
            timeout: 60000
        });
        await wait(randomRange(8000, 15000));

        // --- SESSION VALIDATION on the profile page ---
        const finalUrl = page.url();
        const isAuthWall = finalUrl.includes('authwall') || finalUrl.includes('login') || finalUrl.includes('checkpoint');

        if (isAuthWall) {
            console.log(`[WORKER] ⚠️ Session invalid. URL: ${finalUrl}`);

            // Capture evidence for debug
            // const screenshotPath = `/tmp/worker_fail_${userId}_${Date.now()}.png`;
            // await page.screenshot({ path: screenshotPath, fullPage: true }).catch(() => { });

            // PAUSE THE CAMPAIGN
            if (campaignId) {
                try {
                    await prisma.campaign.update({
                        where: { id: campaignId },
                        data: { status: 'PAUSED' }
                    });
                    console.log(`[WORKER] ⏸️ Campaign ${campaignId} PAUSED due to invalid session for user ${userId}.`);
                } catch (e) {
                    console.error('[WORKER] Error updating campaign status:', e);
                }
            }

            // Send notification to user
            await prisma.notification.create({
                data: {
                    userId,
                    title: 'LinkedIn Session Expired',
                    body: 'Your LinkedIn session has expired. The campaign has been paused. Please re-sync to resume.',
                    type: 'ERROR'
                }
            });
            return;
        }

        console.log(`[WORKER] ✅ Profile loaded successfully: ${page.url()}`);
        await wait(randomRange(4000, 8000)); // "Observing" time from Phase 2 script


        if (stepType === 'INVITE' || stepType === 'INVITATION') {
            const hasConnect = await page.isVisible('button:has-text("Connect")');
            const isPending = await page.isVisible('button:has-text("Pending"), button:has-text("Withdraw")');
            const isConnected = await page.isVisible('button:has-text("Message")');

            if (isPending) {
                console.log(`[WORKER] Invite already pending for ${lead.firstName}.`);
                await prisma.lead.update({
                    where: { id: lead.id },
                    data: { status: 'PENDING' }
                });
            } else if (isConnected) {
                console.log(`[WORKER] Lead ${lead.firstName} is already a connection. Skipping invite.`);
                await prisma.lead.update({
                    where: { id: lead.id },
                    data: { status: 'CONNECTED' }
                });
                // Progress to next step immediately (no need to wait)
            } else if (hasConnect) {
                // if (await checkInterrupt(userId)) throw new Error('INTERRUPTED: User active in browser');
                await humanMoveAndClick(page, 'button:has-text("Connect")');
                await wait(2000);
                await page.click('button[aria-label="Send now"]');
                console.log(`[WORKER] Connection request sent to ${lead.firstName}.`);

                await prisma.lead.update({
                    where: { id: lead.id },
                    data: {
                        status: 'PENDING',
                        tags: { push: 'bot:invite_sent' }
                    }
                });
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

                console.log('[WORKER] Opening messaging directly via compose URL (Mirror Phase 2 Strategy)...');
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
                    } catch (e) { }
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
                                await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => { });
                                await wait(3000);
                                break;
                            }
                        }
                    } catch (e) {
                        console.log(`[WORKER] Skipping selector: ${sel}`);
                    }
                }

                if (!messageClicked) {
                    // await page.screenshot({ path: '/app/error_profile.png' });
                    console.log(`[WORKER] Message button not found.`);
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
                // await page.screenshot({ path: '/app/error_modal.png' });
                console.error(`[WORKER] ❌ FAILED: Message box did not appear after click.`);
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

            // --- POST-SEND VERIFICATION (Robust) ---
            await wait(3000);
            const afterUrl = page.url();
            const boxRemaining = await page.locator(msgInputSelector).first().isVisible();

            // Success Case 1: Thread UI detected (Transitioned from /compose/)
            // Success Case 2: Pop-up box closed (Standard Message Button mode)
            if (afterUrl.includes('/thread/') || !boxRemaining) {
                console.log(`[WORKER] ✅ SUCCESS: Message sent. URL transitioned to: ${afterUrl}`);
                await prisma.lead.update({
                    where: { id: lead.id },
                    data: {
                        status: 'CONNECTED',
                        tags: { push: 'bot:messaged' }
                    }
                });
            } else {
                // In full-page "Compose" mode, the input box might remain visible but empty.
                // We'll trust the send click but save a screenshot for debug investigation.
                console.log(`[WORKER] Tentative success. Box still visible. URL: ${afterUrl}`);
                // const endScreenshot = `/tmp/send_final_${userId}_${Date.now()}.png`;
                // await page.screenshot({ path: endScreenshot }).catch(() => { });

                await prisma.lead.update({
                    where: { id: lead.id },
                    data: { status: 'CONNECTED' } // Assume connected if we reached message box
                });
            }
        } else if (stepType === 'VISIT') {
            console.log(`[WORKER] Initiating Enrichment Visit for ${lead.firstName}...`);
            await page.mouse.wheel(0, 800);
            await wait(2000);

            let updateData: any = {};

            // 1. ABOUT INFO ENRICHMENT
            if (stepData.enrichAbout) {
                console.log(`[WORKER] Extracting About info...`);
                try {
                    const aboutSection = page.locator('section:has(div[id="about"]), section:has(h2:has-text("About"))').first();
                    if (await aboutSection.isVisible()) {
                        const moreBtn = aboutSection.locator('button[data-testid="expandable-text-button"]').first();
                        if (await moreBtn.isVisible()) {
                            await moreBtn.evaluate((el: any) => el.click());
                            await wait(1000);
                        }
                        const aboutBox = aboutSection.locator('[data-testid="expandable-text-box"]').first();
                        if (await aboutBox.isVisible()) {
                            updateData.aboutInfo = await aboutBox.evaluate((el: any) => (el as HTMLElement).innerText);
                        }
                    }
                } catch (e) { }
            }

            // 2. COMPANY & JOB TITLE ENRICHMENT
            if (stepData.enrichCompany) {
                console.log(`[WORKER] Extracting Experience (Company/Job)...`);
                try {
                    // Force load experience section
                    for (let i = 0; i < 4; i++) {
                        await page.keyboard.press('PageDown');
                        await wait(600);
                    }
                    const extracted = await page.evaluate(() => {
                        const textNodes = Array.from(document.querySelectorAll('span[aria-hidden="true"], h2 span, h2'));
                        const expNode = textNodes.find(node => (node as any).innerText?.trim() === 'Experience');
                        if (!expNode) return null;
                        const expSection = expNode.closest('section');
                        if (!expSection) return null;

                        const firstLogoImg = expSection.querySelector('a[href*="/company/"] img');
                        const companyName = firstLogoImg?.getAttribute('alt')?.replace(/logo$/i, '').trim() || "Unknown";
                        const firstCompanyLink = expSection.querySelector('a[href*="/company/"]');
                        const companyUrl = firstCompanyLink ? (firstCompanyLink as HTMLAnchorElement).href.split('?')[0] : null;

                        const firstJobItem = expSection.querySelector('ul > li') || expSection.querySelector('.pvs-list__paged-list-item');
                        if (!firstJobItem) return { companyName, companyUrl };

                        const details = (firstJobItem as HTMLElement).innerText.split('\n').map(l => l.trim()).filter(l => l.length > 0);
                        let jobTitle = details[0] || "Unknown";
                        if (companyName !== "Unknown" && details[0]?.toLowerCase().includes(companyName.toLowerCase())) {
                            jobTitle = details.length > 3 ? details[3] : details[0];
                        }
                        return { companyName, jobTitle, companyUrl };
                    });
                    if (extracted) {
                        if (extracted.companyName && extracted.companyName !== "Unknown") updateData.company = extracted.companyName;
                        if (extracted.jobTitle && extracted.jobTitle !== "Unknown") updateData.jobTitle = extracted.jobTitle;
                    }
                } catch (e) { }
            }

            // 3. CONTACT INFO ENRICHMENT
            if (stepData.enrichContact) {
                console.log(`[WORKER] Checking connection degree...`);
                const is1stDegree = await page.evaluate(() => {
                    const text = document.querySelector('.pv-top-card, .pv-text-details__right-panel')?.textContent || '';
                    return text.includes('1st');
                });

                if (!is1stDegree) {
                    console.log(`[WORKER] Not a 1st degree connection. Skipping deep contact extraction.`);
                } else {
                    console.log(`[WORKER] Attempting Contact Info extraction for 1st degree...`);
                    try {
                        const contactBtn = page.locator('a[href*="/overlay/contact-info/"]').first();
                        if (await contactBtn.isVisible()) {
                            await contactBtn.evaluate((el: any) => el.click());
                            await wait(2000);
                            const contactData = await page.evaluate(() => {
                                const data: any = { email: null, phone: null };
                                const labels = Array.from(document.querySelectorAll('div[data-component-type="LazyColumn"] p:first-child'));
                                for (let label of labels) {
                                    const labelText = (label as HTMLElement).innerText?.trim();
                                    const valueNode = label.nextElementSibling;
                                    if (valueNode) {
                                        if (labelText === 'Email') data.email = (valueNode as HTMLElement).innerText?.trim();
                                        else if (labelText === 'Phone') {
                                            const firstSpan = valueNode.querySelector('span');
                                            data.phone = firstSpan ? (firstSpan as HTMLElement).innerText?.trim() : (valueNode as HTMLElement).innerText?.trim();
                                        }
                                    }
                                }
                                return data;
                            });
                            if (contactData.email) updateData.email = contactData.email;
                            await page.keyboard.press('Escape');
                        }
                    } catch (e) { }
                }
            }

            // 4. LATEST POST ENRICHMENT
            if (stepData.enrichPosts) {
                console.log(`[WORKER] Navigating to Posts for extraction...`);
                const activityUrl = lead.linkedinUrl.replace(/\/$/, '') + '/recent-activity/shares/';
                try {
                    await page.goto(activityUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
                    await wait(3000);
                    const postData = await page.evaluate(() => {
                        const wrapper = document.querySelector('div[data-urn*="urn:li:activity"], div[data-urn*="urn:li:ugcPost"], div[data-urn*="urn:li:share"]');
                        if (!wrapper) return null;
                        const urn = wrapper.getAttribute('data-urn');
                        const content = (wrapper as HTMLElement).innerText.substring(0, 1000);
                        return { url: `https://www.linkedin.com/feed/update/${urn}/`, content };
                    });
                    if (postData) {
                        updateData.latestPost = postData.content;
                        updateData.latestPostUrl = postData.url;
                    }
                    // Navigate back to profile (safety)
                    await page.goto(lead.linkedinUrl, { waitUntil: 'domcontentloaded' });
                } catch (e) { }
            }

            if (Object.keys(updateData).length > 0) {
                await prisma.lead.update({
                    where: { id: lead.id },
                    data: updateData
                });
                console.log(`[WORKER] Enrichment SUCCESS for ${lead.firstName}. Fields updated: ${Object.keys(updateData).join(', ')}`);
            }

            console.log(`[WORKER] Profile visit completed for ${lead.firstName}.`);
        } else if (stepType === 'LIKE_POST' || stepType === 'COMMENT_POST') {
            // DEBUG: Log cookie info before starting
            const debugCookies = await context.cookies();
            const liAtCookie = debugCookies.find((c: any) => c.name === 'li_at');
            console.log(`[WORKER] 🔍 DEBUG: Total cookies in context: ${debugCookies.length}`);
            console.log(`[WORKER] 🔍 DEBUG: li_at present: ${!!liAtCookie}, domain: ${liAtCookie?.domain}, value length: ${liAtCookie?.value?.length || 0}`);

            // 1. WARMUP (Mirroring phase2 test script)
            console.log(`[WORKER] 🔥 Warming up...`);
            await page.goto('https://www.linkedin.com/feed/', { waitUntil: 'domcontentloaded', timeout: 60000 }).catch(() => {});
            await wait(randomRange(3000, 5000));

            // DEBUG: Screenshot after warmup to see if feed loads
            try {
                // const warmupPath = path.join(baseSessionDir, userId, `debug_warmup_${Date.now()}.png`);
                // await page.screenshot({ path: warmupPath, fullPage: false });
            } catch {}

            // 2. PROFILE VISIT
            console.log(`[WORKER] 👤 Opening profile: ${lead.linkedinUrl}`);
            await page.goto(lead.linkedinUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });
            await wait(4000);

            // DEBUG: Screenshot after profile visit
            try {
                // const profilePath = path.join(baseSessionDir, userId, `debug_profile_${Date.now()}.png`);
                // await page.screenshot({ path: profilePath, fullPage: false });
            } catch {}

            // 3. NAVIGATE TO ACTIVITY — retry up to 3 times with page reload
            const cleanUrl = lead.linkedinUrl.split('?')[0].replace(/\/$/, '');
            const activityUrl = cleanUrl + '/recent-activity/shares/';
            console.log(`[WORKER] 🧭 Navigating to user's "Shares" feed...`);

            const findPostLink = async (): Promise<string | null> => {
                // METHOD 1: Universal data-urn wrapper
                const postWrappers = Array.from(document.querySelectorAll('div[data-urn*="urn:li:activity"], div[data-urn*="urn:li:ugcPost"], div[data-urn*="urn:li:share"]'));
                if (postWrappers.length > 0) {
                    const urn = postWrappers[0].getAttribute('data-urn');
                    return `https://www.linkedin.com/feed/update/${urn}/`;
                }
                // METHOD 2: Fallback anchor tag search
                const links = Array.from(document.querySelectorAll('a[href*="/feed/update/urn:li:"]'));
                const uniqueLinks: string[] = [];
                for (let link of links) {
                    if (!(link as HTMLAnchorElement).href.includes('?commentUrn=')) {
                        const cleanLink = (link as HTMLAnchorElement).href.split('?')[0];
                        if (!uniqueLinks.includes(cleanLink)) uniqueLinks.push(cleanLink);
                    }
                }
                if (uniqueLinks.length > 0) return uniqueLinks[0];
                return null;
            };

            let postLink: string | null = null;

            for (let attempt = 1; attempt <= 3; attempt++) {
                await page.goto(activityUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });
                await wait(3000); // Let page settle before screenshot

                // DEBUG: Screenshot and URL log at every attempt
                try {
                    // const actPath = path.join(baseSessionDir, userId, `debug_activity_attempt${attempt}_${Date.now()}.png`);
                    // await page.screenshot({ path: actPath, fullPage: false });
                    // const currentUrl = page.url();
                    // const pageTitle = await page.title().catch(() => 'unknown');
                } catch {}

                // Wait for post wrapper elements to appear in the DOM (LinkedIn loads them via JS)
                try {
                    await page.waitForSelector(
                        'div[data-urn*="urn:li:activity"], div[data-urn*="urn:li:ugcPost"], div[data-urn*="urn:li:share"], a[href*="/feed/update/urn:li:"]',
                        { timeout: 15000 }
                    );
                    console.log(`[WORKER] ✅ Post elements appeared in DOM (attempt ${attempt}).`);
                } catch {
                    console.log(`[WORKER] ⏳ Post elements not found on attempt ${attempt}, scrolling to trigger lazy load...`);
                }

                // Scroll to trigger any lazy-loaded content
                for (let i = 0; i < 5; i++) {
                    await page.mouse.wheel(0, 800);
                    await wait(1500);
                }

                postLink = await page.evaluate(findPostLink);
                if (postLink) break;

                // Save debug screenshot on failure
                try {
                    // const debugPath = path.join(baseSessionDir, userId, `debug_activity_${Date.now()}.png`);
                    // await page.screenshot({ path: debugPath, fullPage: false });
                } catch {}

                if (attempt < 3) {
                    console.log(`[WORKER] 🔄 Reloading activity page (attempt ${attempt + 1}/3)...`);
                    await wait(randomRange(3000, 5000));
                }
            }

            if (postLink) {
                console.log(`[WORKER] Found post! Navigating to: ${postLink}`);
                await page.goto(postLink, { waitUntil: 'domcontentloaded', timeout: 60000 });
                await wait(5000);

                if (stepType === 'LIKE_POST') {
                    const likeBtn = page.locator('button:has(span:text-is("Like"))').first();
                    if (await likeBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
                        const isPressed = await likeBtn.getAttribute('aria-pressed');
                        if (isPressed !== 'true') {
                            await likeBtn.evaluate((el: any) => el.click());
                            console.log(`[WORKER] ✅ Liked post for ${lead.firstName}`);
                        } else {
                            console.log(`[WORKER] ⚠️ Post is already liked for ${lead.firstName}`);
                        }
                    } else {
                        console.log(`[WORKER] ⚠️ Like button not visible for ${lead.firstName}`);
                    }
                } else if (stepType === 'COMMENT_POST') {
                    const commentSelector = 'div[role="textbox"][aria-label*="Add a comment"], div[data-placeholder="Add a comment…"]';
                    const commentBox = page.locator(commentSelector).first();
                    if (await commentBox.isVisible({ timeout: 5000 }).catch(() => false)) {
                        await commentBox.scrollIntoViewIfNeeded();
                        await commentBox.click();
                        await wait(1000);

                        const content = stepData.message || 'Great insights! 🚀';
                        const finalContent = content.replace(/\{firstName\}/g, lead.firstName || '').replace(/\{\{firstName\}\}/g, lead.firstName || '');

                        await commentBox.type(finalContent, { delay: 40 });
                        await wait(1500);

                        const submitBtn = page.locator('button.comments-comment-box__submit-button, button.artdeco-button--primary:has-text("Comment"), button.artdeco-button--primary:has-text("Post")').first();

                        if (await submitBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
                            const disabled = await submitBtn.getAttribute('disabled');
                            if (disabled !== null) {
                                await page.keyboard.press('Space');
                                await page.keyboard.press('Backspace');
                                await wait(1000);
                            }
                            await submitBtn.click({ force: true });
                            console.log(`[WORKER] ✅ Commented on post for ${lead.firstName}`);
                            await wait(4000);
                        } else {
                            console.log(`[WORKER] ⚠️ Submit button not found after typing.`);
                        }
                    } else {
                        console.log(`[WORKER] ⚠️ Comment box not visible.`);
                    }
                }
            } else {
                console.log(`[WORKER] ⚠️ Could not find any post after 3 attempts. The user might not have posts.`);
            }
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
                    // Non-delay step: add a small random gap (10-15 sec) for human-like pacing
                    const safetyGapMs = (Math.floor(Math.random() * 6) + 10) * 1000;
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
