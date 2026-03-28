import { Worker, Job, Queue } from 'bullmq';
import { prisma } from '@repo/db';
import { chromium } from 'playwright-extra';
const stealth = require('puppeteer-extra-plugin-stealth')();
import Redis from 'ioredis';
import * as fs from 'fs';
import * as path from 'path';

chromium.use(stealth);

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';
const redisConnection = REDIS_URL ? new Redis(REDIS_URL, { maxRetriesPerRequest: null }) : null;

export const inboxQueue = redisConnection ? new Queue('inbox-sync', { connection: redisConnection as any }) : null;

export const syncInbox = async (userId: string) => {
    const user = await prisma.user.findUnique({
        where: { id: userId },
        include: { proxy: true }
    });

    if (!user || !user.linkedinCookie) {
        console.error(`[INBOX-WORKER] No LinkedIn session for user ${userId}`);
        return;
    }

    console.log(`[INBOX-WORKER] Syncing inbox for user ${userId}...`);

    let context: any;
    let browser: any;

    try {
        // --- SESSION PATH (mirrors campaign worker) ---
        const isCloud = process.env.RAILWAY_ENVIRONMENT || process.env.NODE_ENV === 'production';
        const baseSessionDir = isCloud ? '/app/sessions' : path.join(process.cwd(), 'sessions');
        const sessionPathToUse = user.persistentSessionPath || path.join(baseSessionDir, userId);

        // --- LOAD FINGERPRINT: file first, then DB fallback ---
        let userAgentStr = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36';
        let viewportSettings: any = { width: 1440, height: 900 };

        let fpData: any = null;
        try {
            const fingerprintPath = path.join(sessionPathToUse, 'fingerprint.json');
            if (fs.existsSync(fingerprintPath)) {
                fpData = JSON.parse(fs.readFileSync(fingerprintPath, 'utf-8'));
                console.log(`[INBOX-WORKER] Loaded fingerprint from file`);
            }
        } catch (e) {}

        // DB fallback if file doesn't exist
        if (!fpData && user.linkedinFingerprint) {
            try {
                fpData = JSON.parse(user.linkedinFingerprint);
                console.log(`[INBOX-WORKER] Loaded fingerprint from DB`);
            } catch (e) {}
        }

        if (fpData) {
            if (fpData.userAgent) {
                userAgentStr = fpData.userAgent;
                console.log(`[INBOX-WORKER] Fingerprint UA: ${userAgentStr.substring(0, 60)}...`);
            }
            if (fpData.screen && fpData.screen.width && fpData.screen.height) {
                viewportSettings = { width: fpData.screen.width, height: fpData.screen.height };
            }
        }

        // --- EXACT SYNC-VERIFY CLONE: launch + newContext + inject ---
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
            viewport: null,
            locale: 'en-IN',
            timezoneId: 'Asia/Kolkata'
        };

        if (user.proxy) {
            contextOptions.proxy = {
                server: `http://${user.proxy.proxyHost}:${user.proxy.proxyPort}`,
                username: user.proxy.proxyUsername || undefined,
                password: user.proxy.proxyPassword || undefined
            };
            console.log(`[INBOX-WORKER] Using DB proxy: ${user.proxy.proxyHost}`);
        } else {
            contextOptions.proxy = {
                server: 'http://disp.oxylabs.io:8001',
                username: 'user-shivasingh_clgdY',
                password: 'Iamironman_3'
            };
            console.log(`[INBOX-WORKER] Using Oxylabs ISP proxy fallback`);
        }

        console.log(`[INBOX-WORKER] Launching in-memory context (SYNC-VERIFY clone)`);
        browser = await chromium.launch(launchOptions);
        context = await browser.newContext(contextOptions);
        const page = context.pages()[0] || await context.newPage();

        // --- INJECT COOKIES (exact SYNC-VERIFY pattern) ---
        if (user.linkedinCookie) {
            try {
                const cookies = JSON.parse(user.linkedinCookie);
                console.log(`[INBOX-WORKER] Injecting ${Array.isArray(cookies) ? cookies.length : 1} cookies`);
                await context.addCookies(cookies);
            } catch (e) {
                // Fallback for plain li_at string
                console.log(`[INBOX-WORKER] Injecting li_at cookie string`);
                await context.addCookies([{
                    name: 'li_at',
                    value: user.linkedinCookie,
                    domain: '.linkedin.com',
                    path: '/',
                    secure: true,
                    httpOnly: true
                }]);
            }
        }

        // --- INJECT LOCALSTORAGE (exact SYNC-VERIFY pattern) ---
        if (user.linkedinLocalStorage) {
            try {
                const localStorageData = JSON.parse(user.linkedinLocalStorage);
                await context.addInitScript((data: any) => {
                    const parsed = JSON.parse(data);
                    for (const [k, v] of Object.entries(parsed)) {
                        window.localStorage.setItem(k, v as string);
                    }
                }, JSON.stringify(localStorageData));
                console.log(`[INBOX-WORKER] Injected localStorage identity`);
            } catch (e) {
                console.warn('[INBOX-WORKER] Failed to inject localStorage:', e);
            }
        }

        // Block heavy assets
        await page.route('**/*', (route: any) => {
            const type = route.request().resourceType();
            if (['image', 'media', 'font'].includes(type)) return route.abort();
            return route.continue();
        });

        // --- WARMUP on feed first (exact SYNC-VERIFY pattern) ---
        console.log(`[INBOX-WORKER] 🔥 Warming up on Feed...`);
        await page.goto('https://www.linkedin.com/feed/', { waitUntil: 'domcontentloaded', timeout: 60000 });
        await page.waitForTimeout(5000);

        const feedUrl = page.url();
        const isFeed = feedUrl.includes('/feed') || await page.isVisible('.global-nav').catch(() => false);
        console.log(`[INBOX-WORKER] Feed URL: ${feedUrl} | isFeed: ${isFeed}`);

        if (!isFeed) {
            console.error(`[INBOX-WORKER] ❌ Session expired at feed warmup. URL: ${feedUrl}`);
            return;
        }
        console.log(`[INBOX-WORKER] ✅ Feed warmup successful`);

        // --- NAVIGATE TO MESSAGING ---
        console.log(`[INBOX-WORKER] 📬 Navigating to LinkedIn Inbox...`);
        await page.goto('https://www.linkedin.com/messaging/', { waitUntil: 'domcontentloaded', timeout: 60000 });
        await page.waitForTimeout(4000);

        const currentUrl = page.url();
        console.log(`[INBOX-WORKER] Messaging URL: ${currentUrl}`);
        if (currentUrl.includes('login') || currentUrl.includes('authwall')) {
            console.error(`[INBOX-WORKER] ❌ Session expired at messaging. URL: ${currentUrl}`);
            return;
        }

        try {
            await page.waitForSelector('.msg-conversation-listitem, .msg-conversation-card', { timeout: 15000 });
            console.log(`[INBOX-WORKER] ✅ Conversation list rendered.`);
        } catch (e) {
            console.warn(`[INBOX-WORKER] ⚠️ Conversation list timed out. Taking screenshot...`);
            await page.screenshot({ path: '/app/inbox_debug.png' });
        }

        // 1. SCAN THREADS
        const threadItems = page.locator('.msg-conversation-listitem, .msg-conversation-card');
        const threadCount = await threadItems.count();
        console.log(`[INBOX-WORKER] Found ${threadCount} threads in left pane.`);

        const syncLimit = Math.min(threadCount, 5); // Sync top 5 active conversations
        
        for (let i = 0; i < syncLimit; i++) {
            const currentItem = threadItems.nth(i);
            
            // Extract participant name from left pane
            const nameLoc = currentItem.locator('.msg-conversation-listitem__participant-names, .msg-conversation-card__participant-names').first();
            let participantName = "Unknown";
            if (await nameLoc.isVisible()) {
                const rawName = await nameLoc.innerText();
                participantName = rawName.split('\n')[0].trim();
            }

            console.log(`[INBOX-WORKER] 💬 Loading thread ${i + 1}/${syncLimit}: ${participantName}`);
            await currentItem.click({ force: true });
            await new Promise(r => setTimeout(r, 3000));

            const threadUrl = page.url();

            // 2. PARSE MESSAGES
            const chatHistory = await page.evaluate(() => {
                const msgs = [];
                const eventNodes = Array.from(document.querySelectorAll('.msg-s-message-list__event, li.msg-s-message-list__event'));

                for (let eventNode of eventNodes) {
                    const bodyNode = eventNode.querySelector('.msg-s-event-listitem__body, .msg-s-event__content');
                    if (!bodyNode) continue;

                    const text = (bodyNode as HTMLElement).innerText.trim();
                    if (!text) continue;

                    let senderType: 'SENT' | 'RECEIVED' = 'RECEIVED';
                    
                    // Robust sender check using aria-labels
                    const optionEl = eventNode.querySelector('[aria-label*="Options for"]');
                    if (optionEl) {
                        const ariaLabel = optionEl.getAttribute('aria-label') || '';
                        if (ariaLabel.includes('your message')) {
                            senderType = 'SENT';
                        }
                    } else if (eventNode.querySelector('.msg-s-event-with-indicator__sending-indicator')) {
                        senderType = 'SENT';
                    }

                    msgs.push({ text, direction: senderType });
                }
                return msgs;
            });

            console.log(`[INBOX-WORKER] Extracted ${chatHistory.length} messages for ${participantName}`);

            // 3. MATCH LEAD & SAVE
            // Try matching by threadUrl (if we stored it before) or name
            let lead = await prisma.lead.findFirst({
                where: {
                    userId: userId,
                    OR: [
                        { firstName: { contains: participantName.split(' ')[0] || '' }, lastName: { contains: participantName.split(' ')[1] || '' } },
                        { firstName: { contains: participantName } }
                    ]
                }
            });

            if (lead) {
                let hasNewReply = false;

                for (const msg of chatHistory) {
                    // Deduplicate by content check (simple version)
                    const existing = await prisma.message.findFirst({
                        where: {
                            leadId: lead.id,
                            content: msg.text,
                            direction: msg.direction
                        }
                    });

                    if (!existing) {
                        await prisma.message.create({
                            data: {
                                userId,
                                leadId: lead.id,
                                direction: msg.direction,
                                content: msg.text,
                                source: 'LINKEDIN_SYNC',
                                sentAt: new Date()
                            }
                        });

                        if (msg.direction === 'RECEIVED') hasNewReply = true;
                    }
                }

                if (hasNewReply) {
                    console.log(`[INBOX-WORKER] 🔔 New reply detected from ${participantName}`);
                    
                    await prisma.lead.update({
                        where: { id: lead.id },
                        data: { status: 'REPLIED' }
                    });

                    await prisma.campaignLead.updateMany({
                        where: { leadId: lead.id, isCompleted: false },
                        data: { status: 'REPLIED' }
                    });

                    await prisma.notification.create({
                        data: {
                            userId,
                            title: 'New Reply Received',
                            body: `${participantName} messaged you on LinkedIn.`,
                            type: 'REPLY',
                            meta: { leadId: lead.id }
                        }
                    });
                }
            }
        }

        console.log(`[INBOX-WORKER] Inbox sync completed for user ${userId}`);

    } finally {
        if (context) await context.close().catch(() => {});
        if (browser) await browser.close().catch(() => {});
    }
};

export const initInboxWorker = () => {
    if (!redisConnection) return;
    const worker = new Worker('inbox-sync', async (job: Job) => {
        await syncInbox(job.data.userId);
    }, { connection: redisConnection as any });

    worker.on('completed', (job) => console.log(`Inbox sync ${job.id} done`));
};
