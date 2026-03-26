import { Worker, Job } from 'bullmq';
import { prisma } from '@repo/db';
import { chromium } from 'playwright-extra';
const stealth = require('puppeteer-extra-plugin-stealth')();
import Redis from 'ioredis';

chromium.use(stealth);

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';
const redisConnection = REDIS_URL ? new Redis(REDIS_URL, { maxRetriesPerRequest: null }) : null;

export const syncInbox = async (userId: string) => {
    const user = await prisma.user.findUnique({
        where: { id: userId }
    });

    if (!user || !user.linkedinCookie) {
        console.error(`[INBOX-WORKER] No LinkedIn session for user ${userId}`);
        return;
    }

    console.log(`[INBOX-WORKER] Syncing inbox for user ${userId}...`);

    const sessionPath = `/app/sessions/${userId}`;
    let context;
    let browser;

    try {
        const launchOptions: any = {
            headless: true,
            args: ['--no-sandbox', '--disable-setuid-sandbox']
        };

        // Use the purely in-memory context fallback to avoid SingletonLock issues
        console.log(`[INBOX-WORKER] Launching standard browser for user ${userId} to avoid SingletonLock`);
        
        launchOptions.locale = 'en-IN';
        launchOptions.timezoneId = 'Asia/Kolkata';

        browser = await chromium.launch(launchOptions);
        context = await browser.newContext(launchOptions);
        
        // --- INJECT COOKIES/STORAGE FOR SESSION PARITY ---
        if (user.linkedinCookie) {
            try {
                const cookies = JSON.parse(user.linkedinCookie);
                if (Array.isArray(cookies)) {
                    await context.addCookies(cookies);
                } else {
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
                console.error('[INBOX-WORKER] Error parsing cookies from DB:', e);
            }
        }
        
        if (user.linkedinLocalStorage) {
            try {
                const localStorageData = JSON.parse(user.linkedinLocalStorage);
                await context.addInitScript((storage: any) => {
                    for (const key in storage) {
                        window.localStorage.setItem(key, storage[key]);
                    }
                }, localStorageData);
            } catch (e) {
                console.error('[INBOX-WORKER] Error injecting LocalStorage:', e);
            }
        }

        const page = await context.newPage();
        await page.goto('https://www.linkedin.com/messaging/', { waitUntil: 'networkidle' });

        // Basic message extraction logic
        const conversations = await page.$$eval('.msg-conversations-container__convo-item', (items: any[]) => {
            return items.slice(0, 10).map(item => {
                const name = item.querySelector('.msg-conversation-card__participant-names')?.innerText.trim();
                const lastMsg = item.querySelector('.msg-conversation-card__message-snippet-body')?.innerText.trim();
                const link = item.querySelector('a')?.href;
                return { name, lastMsg, link };
            });
        });

        console.log(`[INBOX-WORKER] Found ${conversations.length} recent conversations.`);

        for (const convo of conversations) {
            // Find lead in database
            const lead = await prisma.lead.findFirst({
                where: {
                    userId: userId,
                    OR: [
                        { firstName: { contains: convo.name?.split(' ')[0] || '' } },
                        { lastName: { contains: convo.name?.split(' ')[1] || convo.name || '' } }
                    ]
                }
            });

            if (lead) {
                // If the user has replied, mark the lead status appropriately
                // This is a naive check - in a real app we'd compare dates and message owners
                if (convo.lastMsg && !convo.lastMsg.includes('You sent')) {
                    console.log(`[INBOX-WORKER] Detected reply from lead: ${lead.firstName} ${lead.lastName}`);

                    // Update campaign lead status to REPLIED
                    await prisma.campaignLead.updateMany({
                        where: { leadId: lead.id, isCompleted: false },
                        data: { status: 'REPLIED' }
                    });

                    await prisma.lead.update({
                        where: { id: lead.id },
                        data: { status: 'REPLIED' }
                    });

                    // Trigger "Reply" notification (Mock logic)
                    await prisma.notification.create({
                        data: {
                            userId: userId,
                            title: 'New Reply Received',
                            body: `${convo.name} just messaged you on LinkedIn.`,
                            type: 'REPLY',
                            meta: { leadId: lead.id, snippet: convo.lastMsg }
                        }
                    });
                }
            }
        }

        console.log(`[INBOX-WORKER] Inbox sync completed for user ${userId}`);

    } catch (error: any) {
        console.error(`[INBOX-WORKER] Error syncing inbox for ${userId}:`, error.message);
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
