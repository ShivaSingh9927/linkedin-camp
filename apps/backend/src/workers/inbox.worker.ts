import { Worker, Job, Queue } from 'bullmq';
import { prisma } from '@repo/db';
import { chromium } from 'playwright-extra';
const stealth = require('puppeteer-extra-plugin-stealth')();
import Redis from 'ioredis';

chromium.use(stealth);

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';
const redisConnection = REDIS_URL ? new Redis(REDIS_URL, { maxRetriesPerRequest: null }) : null;

export const inboxQueue = redisConnection ? new Queue('inbox-sync', { connection: redisConnection as any }) : null;

const wait = (ms: number) => new Promise(res => setTimeout(res, ms));
const randomRange = (min: number, max: number) => Math.floor(Math.random() * (max - min + 1) + min);

async function safeGoto(page: any, url: string, retries = 3) {
    for (let i = 0; i < retries; i++) {
        try {
            console.log(`[INBOX-WORKER] Navigating (${i + 1}/${retries}) → ${url}`);
            await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
            return true;
        } catch (err: any) {
            console.warn(`[INBOX-WORKER] Retry ${i + 1} failed: ${err.message}`);
            if (i === retries - 1) throw err;
            await wait(3000);
        }
    }
}

async function blockResources(page: any) {
    await page.route('**/*', (route: any) => {
        const type = route.request().resourceType();
        const url = route.request().url();
        if (
            ['image', 'media', 'font'].includes(type) ||
            url.includes('analytics') ||
            url.includes('ads') ||
            url.includes('tracking') ||
            url.includes('doubleclick')
        ) {
            return route.abort();
        }
        return route.continue();
    });
}

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

    let browser: any;
    let context: any;

    try {
        // Build browser context — same strategy as working campaign nodes
        let userAgentStr = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36';
        let viewportSettings = { width: 1440, height: 900 };

        // Fingerprint from DB
        if (user.linkedinFingerprint) {
            try {
                const fp = typeof user.linkedinFingerprint === 'string'
                    ? JSON.parse(user.linkedinFingerprint)
                    : user.linkedinFingerprint;
                if (fp.userAgent) userAgentStr = fp.userAgent;
                if (fp.screen?.width && fp.screen?.height) {
                    viewportSettings = { width: fp.screen.width, height: fp.screen.height };
                }
            } catch {}
        }

        const launchOptions: any = {
            headless: true,
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-blink-features=AutomationControlled',
                '--start-maximized',
                '--disable-gpu',
                '--disable-dev-shm-usage',
            ],
        };

        const contextOptions: any = {
            userAgent: userAgentStr,
            viewport: viewportSettings,
            locale: 'en-IN',
            timezoneId: 'Asia/Kolkata',
        };

        // Proxy — dedicated ISP (Oxylabs) fallback
        if (user.proxy) {
            contextOptions.proxy = {
                server: `http://${user.proxy.proxyHost}:${user.proxy.proxyPort}`,
                username: user.proxy.proxyUsername || undefined,
                password: user.proxy.proxyPassword || undefined,
            };
        } else {
            contextOptions.proxy = {
                server: 'http://disp.oxylabs.io:8001',
                username: 'user-shivasingh_clgdY',
                password: 'Iamironman_3',
            };
        }

        browser = await chromium.launch(launchOptions);
        context = await browser.newContext(contextOptions);

        // Inject cookies from DB
        if (user.linkedinCookie) {
            try {
                const cookies = JSON.parse(user.linkedinCookie);
                if (Array.isArray(cookies)) {
                    const sanitized = cookies.map((c: any) => ({
                        ...c,
                        expires: c.expires ? Math.round(Number(c.expires)) : Math.round(Date.now() / 1000) + 86400 * 30,
                    }));
                    await context.addCookies(sanitized);
                }
            } catch {}
        }

        // Inject localStorage from DB
        if (user.linkedinLocalStorage) {
            try {
                const lsData = JSON.parse(user.linkedinLocalStorage);
                await context.addInitScript((data: any) => {
                    const parsed = JSON.parse(data);
                    for (const [k, v] of Object.entries(parsed)) {
                        window.localStorage.setItem(k, v as string);
                    }
                }, JSON.stringify(lsData));
            } catch {}
        }

        const page = context.pages()[0] || await context.newPage();
        await blockResources(page);

        // 1. Warmup — visit feed
        console.log(`[INBOX-WORKER] Warming up...`);
        await safeGoto(page, 'https://www.linkedin.com/feed/');
        await wait(randomRange(5000, 8000));

        // Session validation
        const feedUrl = page.url();
        if (feedUrl.includes('authwall') || feedUrl.includes('login') || feedUrl.includes('checkpoint')) {
            console.error(`[INBOX-WORKER] Session invalid. Redirected to: ${feedUrl}`);
            await prisma.notification.create({
                data: {
                    userId,
                    title: 'Inbox Sync Failed',
                    body: 'LinkedIn session expired. Please re-sync your session.',
                    type: 'ERROR',
                }
            }).catch(() => {});
            return;
        }

        // 2. Navigate to inbox
        console.log(`[INBOX-WORKER] Navigating to inbox...`);
        await safeGoto(page, 'https://www.linkedin.com/messaging/');
        await wait(randomRange(4000, 6000));

        // Wait for conversation list
        try {
            await page.waitForSelector('.msg-conversation-listitem', { timeout: 15000 });
            console.log(`[INBOX-WORKER] Conversation list rendered.`);
        } catch {
            console.log(`[INBOX-WORKER] Timed out waiting for conversation list.`);
        }

        // Scroll the conversation list to load more
        const leftPane = page.locator('.msg-conversations-container__list, ul.msg-conversations-container__conversations-list').first();
        if (await leftPane.isVisible({ timeout: 5000 }).catch(() => false)) {
            await leftPane.click({ force: true }).catch(() => {});
            await wait(1000);
            for (let i = 0; i < 4; i++) {
                await page.keyboard.press('PageDown');
                await wait(randomRange(800, 1500));
            }
        }

        // 3. Scan threads
        const threadItems = page.locator('.msg-conversation-listitem');
        const threadCount = await threadItems.count();
        const syncLimit = Math.min(threadCount, 5);

        console.log(`[INBOX-WORKER] Found ${threadCount} threads. Syncing top ${syncLimit}...`);

        for (let i = 0; i < syncLimit; i++) {
            const currentItem = threadItems.nth(i);

            // Extract participant name
            const nameLoc = currentItem.locator('.msg-conversation-listitem__participant-names, .msg-conversation-card__participant-names').first();
            let participantName = 'Unknown';
            if (await nameLoc.isVisible({ timeout: 3000 }).catch(() => false)) {
                const rawName = await nameLoc.innerText();
                participantName = rawName.split('\n')[0].trim();
            }

            console.log(`[INBOX-WORKER] Loading thread ${i + 1}/${syncLimit} with ${participantName}...`);

            await currentItem.click({ force: true });
            await wait(randomRange(4000, 6000));

            // Scroll up to load message history
            const messageListContainer = page.locator('.msg-s-message-list-container, .msg-s-message-list').first();
            if (await messageListContainer.isVisible({ timeout: 5000 }).catch(() => false)) {
                await messageListContainer.click({ force: true }).catch(() => {});
                for (let j = 0; j < 3; j++) {
                    await page.keyboard.press('PageUp');
                    await wait(randomRange(1200, 2000));
                }
            }

            // Parse message bubbles
            const chatHistory: Array<{ sender: string; text: string; direction: 'SENT' | 'RECEIVED' }> = await page.evaluate(() => {
                const msgs: any[] = [];
                const eventNodes = Array.from(document.querySelectorAll('.msg-s-message-list__event, li.msg-s-message-list__event'));

                for (const eventNode of eventNodes) {
                    const bodyNode = eventNode.querySelector('.msg-s-event-listitem__body, .msg-s-event__content');
                    if (!bodyNode) continue;

                    const text = (bodyNode as HTMLElement).innerText.trim();
                    if (text.length === 0) continue;

                    let sender = 'Unknown';
                    let direction: 'SENT' | 'RECEIVED' = 'RECEIVED';

                    // Strategy 1: aria-label "Options for..." pattern
                    const optionEl = eventNode.querySelector('[aria-label*="Options for"]');
                    if (optionEl) {
                        const ariaLabel = optionEl.getAttribute('aria-label');
                        if (ariaLabel?.includes('your message')) {
                            sender = 'You';
                            direction = 'SENT';
                        } else {
                            const match = ariaLabel?.match(/message from (.*?):/);
                            if (match && match[1]) sender = match[1].trim();
                        }
                    }

                    // Strategy 2: Visual indicator fallback
                    if (sender === 'Unknown') {
                        const sendingIndicator = eventNode.querySelector('.msg-s-event-with-indicator__sending-indicator');
                        if (sendingIndicator || eventNode.classList.contains('msg-s-event-listitem--message-bubble-outgoing')) {
                            sender = 'You';
                            direction = 'SENT';
                        }
                    }

                    msgs.push({ sender, text, direction });
                }
                return msgs;
            });

            console.log(`[INBOX-WORKER] Extracted ${chatHistory.length} messages from ${participantName}.`);

            // 4. Save to DB — match lead by name
            const lead = await prisma.lead.findFirst({
                where: {
                    userId,
                    OR: [
                        { firstName: { contains: participantName.split(' ')[0], mode: 'insensitive' } },
                        { firstName: { contains: participantName, mode: 'insensitive' } },
                    ]
                }
            });

            if (lead) {
                let hasNewReply = false;
                for (const msg of chatHistory) {
                    // Dedup — check if message already exists
                    const exists = await prisma.message.findFirst({
                        where: { leadId: lead.id, content: msg.text, direction: msg.direction }
                    });
                    if (!exists) {
                        await prisma.message.create({
                            data: {
                                userId,
                                leadId: lead.id,
                                direction: msg.direction,
                                content: msg.text,
                                source: 'LINKEDIN_SYNC',
                                sentAt: new Date(),
                            }
                        });
                        if (msg.direction === 'RECEIVED') hasNewReply = true;
                    }
                }

                // Update lead status if there's a new reply
                if (hasNewReply) {
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
                            body: `${participantName} messaged you back.`,
                            type: 'REPLY',
                            meta: { leadId: lead.id }
                        }
                    });
                    console.log(`[INBOX-WORKER] Lead ${participantName} marked as REPLIED.`);
                }
            } else {
                console.log(`[INBOX-WORKER] No matching lead found for "${participantName}". Skipping DB save.`);
            }
        }

        console.log(`[INBOX-WORKER] Inbox sync complete. Synced ${syncLimit} threads.`);

    } catch (err: any) {
        console.error(`[INBOX-WORKER] Error:`, err.message);
    } finally {
        if (context) await context.close().catch(() => {});
        if (browser) await browser.close().catch(() => {});
    }
};

export const initInboxWorker = () => {
    if (!redisConnection) {
        console.warn('[INBOX-WORKER] No Redis connection. Worker not started.');
        return;
    }

    const worker = new Worker('inbox-sync', async (job: Job) => {
        await syncInbox(job.data.userId);
    }, { connection: redisConnection as any, concurrency: 1 });

    worker.on('completed', (job) => {
        console.log(`[INBOX-WORKER] Job ${job?.id} completed.`);
    });

    worker.on('failed', (job, err) => {
        console.error(`[INBOX-WORKER] Job ${job?.id} failed:`, err.message);
    });

    console.log('[INBOX-WORKER] Worker started. Listening on queue: inbox-sync');
    return worker;
};
