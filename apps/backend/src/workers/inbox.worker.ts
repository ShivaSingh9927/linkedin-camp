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

    let browser;
    try {
        browser = await chromium.launch({
            headless: true,
            args: ['--no-sandbox', '--disable-setuid-sandbox']
        });

        // Set cookies manually for the worker session
        const context = await browser.newContext();

        // Robust parsing: handle if the user pasted the full "li_at=..." string
        const rawCookie = user.linkedinCookie || '';
        const cookieValue = rawCookie.includes('li_at=')
            ? rawCookie.split('li_at=')[1].split(';')[0].trim()
            : rawCookie.replace(/^"|"$/g, '').trim();

        console.log(`[INBOX-WORKER] Injecting li_at cookie (Length: ${cookieValue.length})`);

        await context.addCookies([{
            name: 'li_at',
            value: cookieValue,
            domain: '.linkedin.com',
            path: '/',
            expires: Math.floor(Date.now() / 1000) + 3600 * 24 * 365,
            httpOnly: true,
            secure: true,
            sameSite: 'None'
        }]);

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
        if (browser) await browser.close();
    }
};

export const initInboxWorker = () => {
    if (!redisConnection) return;
    const worker = new Worker('inbox-sync', async (job: Job) => {
        await syncInbox(job.data.userId);
    }, { connection: redisConnection as any });

    worker.on('completed', (job) => console.log(`Inbox sync ${job.id} done`));
};
