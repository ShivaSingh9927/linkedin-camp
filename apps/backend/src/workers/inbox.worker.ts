import { Worker, Job, Queue } from 'bullmq';
import { prisma } from '@repo/db';
import Redis from 'ioredis';
import { launchAuthenticatedContext } from '../campaign-engine/session-launch';
import { tryAcquireAccountLock, releaseAccountLock } from './campaign-worker';

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';
const redisConnection = REDIS_URL ? new Redis(REDIS_URL, { maxRetriesPerRequest: null }) : null;

export const inboxQueue = redisConnection ? new Queue('inbox-sync', { connection: redisConnection as any }) : null;

const wait = (ms: number) => new Promise(res => setTimeout(res, ms));
const randomRange = (min: number, max: number) => Math.floor(Math.random() * (max - min + 1) + min);

/**
 * Enqueue an inbox sync for a user, with an optional Redis-backed debounce so
 * the same user can't be re-synced more often than `debounceSec`. This is what
 * keeps the "after any campaign run" trigger from hammering the worker — a busy
 * campaign fires this on every run, but the debounce collapses it to at most
 * one sync per window. `force` (used by the daily cron) bypasses the debounce.
 */
export const enqueueInboxSync = async (
    userId: string,
    opts: { debounceSec?: number; force?: boolean } = {}
): Promise<boolean> => {
    if (!inboxQueue) return false;
    const { debounceSec = 0, force = false } = opts;

    if (!force && debounceSec > 0 && redisConnection) {
        // NX set returns null if the key already exists → recently enqueued, skip.
        const set = await redisConnection.set(`inbox_sync_recent:${userId}`, '1', 'EX', debounceSec, 'NX');
        if (set !== 'OK') {
            console.log(`[INBOX-WORKER] Debounced inbox sync for ${userId} (within ${debounceSec}s window).`);
            return false;
        }
    }

    await inboxQueue.add('inbox-sync', { userId }, { removeOnComplete: true, removeOnFail: true });
    return true;
};

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

export const syncInbox = async (userId: string) => {
    const user = await prisma.user.findUnique({ where: { id: userId } });

    if (!user || !user.linkedinCookie) {
        console.error(`[INBOX-WORKER] No LinkedIn session for user ${userId}`);
        return;
    }

    // Per-account lock — the SAME lock the campaign worker uses. LinkedIn bans
    // accounts that hit two endpoints from two IPs in the same second, so inbox
    // sync must never run while a campaign is driving this account. If the lock
    // is held, bail silently; the daily cron / next campaign trigger retries.
    const lockToken = `inbox-${userId}-${Date.now()}`;
    const acquired = await tryAcquireAccountLock(userId, lockToken);
    if (!acquired) {
        console.log(`[INBOX-WORKER] Account ${userId} busy (campaign running) — skipping inbox sync.`);
        return;
    }

    // DB safety flag mirrors the withdraw worker so the manual-sync / login
    // guards see the cloud worker as active for the duration.
    await prisma.user
        .update({ where: { id: userId }, data: { cloudWorkerActive: true, lastCloudActionAt: new Date() } })
        .catch(() => {});

    console.log(`[INBOX-WORKER] Syncing inbox for user ${userId}...`);

    let browser: any;
    let context: any;

    try {
        // SINGLE source of truth for the sticky-proxy invariant. This pins the
        // exact login egress IP at launch level (aborts if no proxy snapshot),
        // injects cookies + localStorage + fingerprint, and blocks heavy
        // resources — identical to the campaign engine, so behavior never drifts.
        const launch = await launchAuthenticatedContext(userId);
        if (!launch.ok) {
            console.error(`[INBOX-WORKER] Launch failed (${launch.failedAt}): ${launch.error}`);
            if (launch.failedAt === 'proxy-snapshot-missing') {
                await prisma.notification.create({
                    data: {
                        userId,
                        title: 'Inbox Sync Skipped',
                        body: 'No pinned LinkedIn proxy. Please re-sync your session.',
                        type: 'ERROR',
                    },
                }).catch(() => {});
            }
            return;
        }
        ({ browser, context } = launch);
        const page = launch.page;

        // 1. Warmup — visit feed, then validate the session is still live.
        console.log(`[INBOX-WORKER] Warming up...`);
        await safeGoto(page, 'https://www.linkedin.com/feed/');
        await wait(randomRange(5000, 8000));

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

        let totalNewReplies = 0;

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

            // One-shot DOM diagnostic — log the class list and aria-label of
            // the first two message events so we can see what LinkedIn is
            // actually rendering and tighten the selectors based on real data
            // instead of guesses. Stripped of message content for log volume.
            if (i === 0 && process.env.INBOX_DIAG === '1') {
                const diag = await page.evaluate(() => {
                    const nodes = Array.from(document.querySelectorAll('.msg-s-message-list__event, li.msg-s-message-list__event')).slice(0, 2);
                    return nodes.map((n: any) => ({
                        outerClass: n.className,
                        bubbleClass: n.querySelector('.msg-s-event-listitem__message-bubble')?.className || null,
                        nameElText: n.querySelector('.msg-s-message-group__name, .msg-s-event-listitem__name, .msg-s-event-listitem__link')?.textContent?.trim() || null,
                        ariaLabels: Array.from(n.querySelectorAll('[aria-label]')).slice(0, 3).map((e: any) => e.getAttribute('aria-label')),
                        meName: (document.querySelector('.global-nav__me-photo')?.getAttribute('alt') || document.querySelector('.global-nav__me .t-bold')?.textContent || '').trim(),
                    }));
                });
                console.log(`[INBOX-WORKER][DIAG] ${JSON.stringify(diag)}`);
            }

            // Parse message bubbles. LinkedIn keeps changing the outgoing-bubble
            // class name, so rely on multiple signals: (a) the logged-in user's
            // own name from the global nav, (b) any aria-label hint LinkedIn
            // exposes, (c) a wide set of bubble class variants, and finally
            // (d) sender-name inheritance across grouped messages (only the
            // first bubble in a group carries the sender's name).
            const chatHistory: Array<{ sender: string; text: string; direction: 'SENT' | 'RECEIVED' }> = await page.evaluate(() => {
                // Logged-in user's name from the global nav. The avatar's alt
                // attribute reads "Photo of <Name>" on most rollouts but on
                // some it's just the bare name — handle both.
                const meName = (() => {
                    const alt = (document.querySelector('.global-nav__me-photo')?.getAttribute('alt') || '').trim();
                    const stripped = alt.replace(/^Photo of\s+/i, '').trim();
                    if (stripped) return stripped;
                    const bold = (document.querySelector('.global-nav__me .t-bold')?.textContent || '').trim();
                    return bold;
                })().toLowerCase();

                // Extract the sender's name from a bubble's profile link. The
                // link's anchor text is literally "View {Name}'s profile"
                // (curly apostrophe). Returns null if no such link is present
                // (which happens for grouped subsequent bubbles).
                const senderFromBubble = (eventNode: Element): string | null => {
                    const linkText = (
                        eventNode.querySelector('.msg-s-event-listitem__link')?.textContent ||
                        eventNode.querySelector('a.msg-s-event-listitem__link')?.textContent ||
                        ''
                    ).trim();
                    const m = linkText.match(/View\s+(.+?)['’]s\s+profile/i);
                    if (m && m[1]) return m[1].trim();
                    // Some bubbles carry the bare sender name in a separate span.
                    const groupName = (eventNode.querySelector('.msg-s-message-group__name')?.textContent || '').trim();
                    return groupName || null;
                };

                const msgs: any[] = [];
                const eventNodes = Array.from(document.querySelectorAll('.msg-s-message-list__event, li.msg-s-message-list__event'));

                let lastSender = '';
                let lastDirection: 'SENT' | 'RECEIVED' = 'RECEIVED';

                for (const eventNode of eventNodes) {
                    const bodyNode = eventNode.querySelector('.msg-s-event-listitem__body, .msg-s-event__content');
                    if (!bodyNode) continue;
                    const text = (bodyNode as HTMLElement).innerText.trim();
                    if (text.length === 0) continue;

                    const bubbleSender = senderFromBubble(eventNode);
                    let sender = bubbleSender || lastSender;
                    let direction: 'SENT' | 'RECEIVED';

                    if (bubbleSender) {
                        // First message of a new group — match the bubble's
                        // named sender against meName. LinkedIn's profile link
                        // typically renders the first name only ("View Raja's
                        // profile") while the global-nav meName is the full
                        // name ("Raja Singh"), so we compare on either the
                        // first token of meName or substring containment in
                        // either direction.
                        const s = bubbleSender.toLowerCase();
                        const meFirst = meName.split(/\s+/)[0] || '';
                        const isMe = !!meName && (
                            s === meName ||
                            s === meFirst ||
                            (s.length >= 3 && meName.includes(s)) ||
                            (meFirst.length >= 3 && s.includes(meFirst))
                        );
                        direction = isMe ? 'SENT' : 'RECEIVED';
                    } else {
                        // Grouped subsequent bubble — same direction as the
                        // last named bubble. Defaults to RECEIVED only if the
                        // thread literally opens with no named bubble at all.
                        direction = lastDirection;
                    }

                    if (!sender) sender = direction === 'SENT' ? 'You' : 'Unknown';
                    lastDirection = direction;
                    lastSender = sender;
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
                // Order preservation: LinkedIn renders oldest→newest top to
                // bottom but exposes no reliable per-bubble timestamp we can
                // parse across locales. We assign a monotonically increasing
                // sentAt from a single base so newly-created rows sort in the
                // exact visual order. A new sync uses a fresh (later) base, so
                // replies appended since the last sync sort after older ones.
                const base = Date.now();
                const total = chatHistory.length;
                for (let m = 0; m < total; m++) {
                    const msg = chatHistory[m];
                    // Dedup on content+direction+lead. Once a row exists we
                    // never touch it again — campaign-engine writes are
                    // authoritative for SENT and we don't want a wobbly sync
                    // heuristic to overwrite that ground truth. Including
                    // direction lets an inbound "Hi" and an outbound "Hi"
                    // coexist instead of one masking the other.
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
                                sentAt: new Date(base - (total - m) * 1000),
                            }
                        });
                        if (msg.direction === 'RECEIVED') hasNewReply = true;
                    }
                }

                // Update lead status if there's a new reply
                if (hasNewReply) {
                    totalNewReplies++;
                    await prisma.lead.update({
                        where: { id: lead.id },
                        data: { status: 'REPLIED' }
                    });
                    await prisma.campaignLead.updateMany({
                        where: { leadId: lead.id, isCompleted: false },
                        data: { status: 'REPLIED' }
                    });

                    // CRM event — emit for each active campaign the lead is
                    // currently in. Reply text is the last RECEIVED message.
                    const activeLinks = await prisma.campaignLead.findMany({
                        where: { leadId: lead.id, isCompleted: false },
                        select: { campaignId: true },
                    });
                    const lastInbound = [...chatHistory].reverse().find(m => m.direction === 'RECEIVED');
                    for (const link of activeLinks) {
                        import('../services/crm-events').then(({ emitCrmEvent }) =>
                            emitCrmEvent({
                                event: 'lead.replied',
                                userId,
                                campaignId: link.campaignId,
                                leadId: lead.id,
                                meta: { replyContent: lastInbound?.text },
                            }),
                        ).catch(() => {});
                    }
                    await prisma.notification.create({
                        data: {
                            userId,
                            title: 'New Reply Received',
                            body: `${participantName} messaged you back.`,
                            type: 'REPLY',
                            meta: { leadId: lead.id }
                        }
                    });

                    // Realtime nudge so an open inbox refreshes without polling.
                    import('../socket').then(({ io }) =>
                        io?.to(`user_${userId}`).emit('INBOX_UPDATED', {
                            leadId: lead.id,
                            participantName,
                            replyContent: lastInbound?.text,
                            timestamp: new Date().toISOString(),
                        }),
                    ).catch(() => {});

                    console.log(`[INBOX-WORKER] Lead ${participantName} marked as REPLIED.`);
                }
            } else {
                console.log(`[INBOX-WORKER] No matching lead found for "${participantName}". Skipping DB save.`);
            }
        }

        console.log(`[INBOX-WORKER] Inbox sync complete. Synced ${syncLimit} threads, ${totalNewReplies} with new replies.`);

    } catch (err: any) {
        console.error(`[INBOX-WORKER] Error:`, err.message);
    } finally {
        if (context) await context.close().catch(() => {});
        if (browser) await browser.close().catch(() => {});
        await prisma.user
            .update({ where: { id: userId }, data: { cloudWorkerActive: false, lastCloudActionAt: new Date() } })
            .catch(() => {});
        await releaseAccountLock(userId, lockToken);
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
