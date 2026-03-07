import { chromium } from 'playwright';
import { prisma } from '../server';
import { ActionType } from '@repo/types';
import { triggerWebhook } from '../services/webhook.service';

export const syncInbox = async (userId: string) => {
    console.log(`[Inbox Sync] Starting sync for user ${userId}`);
    const user = await prisma.user.findUnique({
        where: { id: userId },
        include: { proxy: true }
    });
    if (!user?.linkedinCookie) {
        console.log(`[Inbox Sync] No cookies for user ${userId}, skipping.`);
        return;
    }

    let browser;
    try {
        await prisma.user.update({
            where: { id: userId },
            data: { cloudWorkerActive: true, lastCloudActionAt: new Date() }
        });

        const launchOptions: any = { headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox'] };
        if (user.proxy) {
            launchOptions.proxy = {
                server: `http://${user.proxy.proxyHost}:${user.proxy.proxyPort}`,
                username: user.proxy.proxyUsername || undefined,
                password: user.proxy.proxyPassword || undefined
            };
        }

        browser = await chromium.launch(launchOptions);
        const context = await browser.newContext();

        // 1. Proxy Bandwidth & Server RAM Optimizer
        await context.route('**/*', (route) => {
            const type = route.request().resourceType();
            if (['image', 'media', 'font', 'stylesheet'].includes(type) || route.request().url().includes('google-analytics')) {
                route.abort();
            } else {
                route.continue();
            }
        });

        let cookies;
        try {
            cookies = JSON.parse(user.linkedinCookie);
        } catch (e) {
            cookies = [{
                name: 'li_at',
                value: user.linkedinCookie,
                domain: '.linkedin.com',
                path: '/',
                secure: true,
                httpOnly: true,
                sameSite: 'None'
            }];
        }
        await context.addCookies(Array.isArray(cookies) ? cookies : [cookies]);

        const page = await context.newPage();
        await page.goto('https://www.linkedin.com/messaging/', { waitUntil: 'networkidle' });

        // Wait for conversations to load
        try {
            await page.waitForSelector('.msg-conversations-container__conversations-list', { timeout: 10000 });
        } catch (e) {
            console.log('[Inbox Sync] Messaging list not found, maybe no messages or layout changed.');
            await browser.close();
            return;
        }

        const conversations = await page.$$eval('.msg-conversation-listitem', (items) => {
            return items.slice(0, 15).map(item => {
                const name = item.querySelector('.msg-conversation-listitem__participant-names')?.textContent?.trim();
                const snippet = item.querySelector('.msg-conversation-listitem__message-snippet')?.textContent?.trim();
                const isUnread = !!item.querySelector('.msg-conversation-card__unread-count');

                // LinkedIn often hides "You:" in the snippet if the other person replied.
                // We assume if it doesn't start with "You:", it might be a reply.
                const isReceived = snippet && !snippet.startsWith('You:');

                return { name, snippet, isUnread, isReceived };
            });
        });

        console.log(`[Inbox Sync] Found ${conversations.length} threads.`);

        for (const conv of conversations) {
            if (conv.name && conv.isReceived) {
                // Find lead by name
                const nameParts = conv.name.split(' ');
                const firstName = nameParts[0];
                const lastName = nameParts.length > 1 ? nameParts.slice(1).join(' ') : '';

                const lead = await prisma.lead.findFirst({
                    where: {
                        userId,
                        firstName: { contains: firstName, mode: 'insensitive' },
                        ...(lastName ? { lastName: { contains: lastName, mode: 'insensitive' } } : {})
                    }
                });

                if (lead) {
                    console.log(`[Inbox Sync] Matched lead: ${lead.firstName} ${lead.lastName} (ID: ${lead.id})`);
                    // 1. Log the message if new
                    const latestMessage = await prisma.message.findFirst({
                        where: { leadId: lead.id, userId },
                        orderBy: { sentAt: 'desc' }
                    });

                    // simple check: if snippet is different from latest stored message
                    if (!latestMessage || latestMessage.content !== conv.snippet) {
                        console.log(`[Inbox Sync] New message detected for ${lead.firstName}`);

                        await prisma.message.create({
                            data: {
                                userId,
                                leadId: lead.id,
                                direction: conv.isReceived ? 'RECEIVED' : 'SENT',
                                content: conv.snippet || '[No Content]',
                                source: 'LINKEDIN_SYNC',
                                sentAt: new Date()
                            }
                        });

                        // 2. Update status to REPLIED if received
                        if (conv.isReceived && lead.status !== 'REPLIED') {
                            await prisma.lead.update({
                                where: { id: lead.id },
                                data: { status: 'REPLIED' }
                            });

                            // 3. Smart Reply Detection: Halt Active Campaigns for this Lead
                            const haltedCampaigns = await prisma.campaignLead.updateMany({
                                where: { leadId: lead.id, isCompleted: false },
                                data: { isCompleted: true }
                            });

                            if (haltedCampaigns.count > 0) {
                                console.log(`[Inbox Sync] Smart Reply! Halted ${haltedCampaigns.count} active campaigns for ${lead.firstName}.`);
                            }

                            // Trigger integration webhook
                            await triggerWebhook(userId, 'lead.replied', {
                                leadId: lead.id,
                                firstName: lead.firstName,
                                lastName: lead.lastName,
                                email: lead.email,
                                linkedinUrl: lead.linkedinUrl,
                                message: conv.snippet || '[No Content]'
                            });

                            // 4. Create Notification
                            await prisma.notification.create({
                                data: {
                                    userId,
                                    type: 'new_reply',
                                    title: `New reply from ${lead.firstName}`,
                                    body: conv.snippet || 'Check your LinkedIn inbox for details.',
                                    meta: { leadId: lead.id } as any
                                }
                            });
                        }
                    }
                } else {
                    console.log(`[Inbox Sync] Skipping conversation with "${conv.name}" - Lead not found in database.`);
                }
            }
        }

    } catch (error: any) {
        console.error('[Inbox Sync] Error:', error.message);
    } finally {
        if (browser) await browser.close();
        await prisma.user.update({
            where: { id: userId },
            data: { cloudWorkerActive: false, lastCloudActionAt: new Date() }
        });
    }
};
