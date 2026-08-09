import { Worker, Job, Queue } from 'bullmq';
import { prisma } from '@repo/db';
import Redis from 'ioredis';
import { launchAuthenticatedContext } from '../campaign-engine/session-launch';
import { classifyPage, classifyHtml, isCheckpoint, handleCheckpoint } from '../campaign-engine/safety/checkpoint';
import { tryAcquireAccountLock, releaseAccountLock } from './campaign-worker';
import {
    syncInbox as voyagerSyncInbox,
    getMessagesInConversation,
    captureVoyagerHeaders,
    warmSelfCache,
    getBrowserlessVoyagerContext,
} from '../services/voyager-api.service';

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
    let disposeApi: (() => Promise<void>) | null = null;

    try {
        // Transport. Default is browser-free: the sync reads Voyager exclusively
        // and never touched the DOM, so Chromium was only ever supplying an HTTP
        // client, a redirect target, and headers we don't need. Proven on prod
        // 2026-08-09 — /me, messengerConversations (18 threads) and
        // messengerMessages (20 bodies) all returned 200 from a bare request
        // context. Set INBOX_SYNC_USE_BROWSER=1 to fall back without a rebuild.
        const useBrowser = process.env.INBOX_SYNC_USE_BROWSER === '1';
        let page: any = null;
        let apiRequest: any = null;

        if (useBrowser) {
            // SINGLE source of truth for the sticky-proxy invariant. Pins the
            // exact login egress IP at launch level (aborts if no snapshot),
            // injects cookies + localStorage + fingerprint.
            const launch = await launchAuthenticatedContext(userId);
            if (!launch.ok) {
                console.error(`[INBOX-WORKER] Launch failed (${launch.failedAt}): ${launch.error}`);
                if (launch.failedAt === 'proxy-snapshot-missing') {
                    await handleCheckpoint({
                        userId,
                        info: { kind: 'still_login', url: 'no-proxy-snapshot' },
                    }).catch(err => console.error(`[INBOX-WORKER] handleCheckpoint failed: ${err.message}`));
                }
                return;
            }
            ({ browser, context } = launch);
            page = launch.page;
        } else {
            // Same sticky-proxy invariant, enforced inside the builder: it
            // refuses to construct a context without a pinned snapshot, which is
            // the browser-free equivalent of the launch abort above.
            const bl = await getBrowserlessVoyagerContext(userId);
            if (!bl) {
                // No pinned snapshot means we can't reproduce the egress the
                // cookies were captured behind, so this account genuinely needs
                // a re-login — an account-health fact, not a per-run blip.
                // Recording it stops the sweep retrying nightly, and routing it
                // through handleCheckpoint dedupes the notification (this branch
                // had written 63 identical rows, one per night, forever).
                console.error(`[INBOX-WORKER] No browser-free context for ${userId} (missing session or proxy snapshot).`);
                await handleCheckpoint({
                    userId,
                    info: { kind: 'still_login', url: 'no-proxy-snapshot' },
                }).catch(err => console.error(`[INBOX-WORKER] handleCheckpoint failed: ${err.message}`));
                return;
            }
            apiRequest = bl.ctx;
            disposeApi = bl.dispose;
        }

        // 1. Warmup + liveness, in ONE request.
        //
        // The warmup is not optional off-browser. A bare context that goes
        // straight to /voyager/api/me gets 401; the same context after a GET of
        // /feed/ succeeds (measured 2026-08-09). LinkedIn refreshes routing and
        // session cookies on a real page request — `lidc` among them — and the
        // API path wants them current. The browser never hit this because it
        // always navigates first.
        //
        // The same response also answers "is this session alive": being bounced
        // off /feed/ is LinkedIn stating plainly that it is not. That used to be
        // thrown away — logged, notified, and returned WITHOUT recording the
        // health change — so accountHealth read HEALTHY while LinkedIn bounced
        // the account nightly. Five accounts were in exactly that state on
        // 2026-08-09, one stale since June.
        //
        // Routing through the canonical classifier + handler buys three things
        // ad-hoc URL matching couldn't: the right health per kind
        // (authwall→SESSION_EXPIRED, login→NEEDS_LOGIN, pin→OTP_REQUIRED, else
        // RESTRICTED); `sessionInvalid` set so the 4am sweep stops re-driving a
        // dead account; and notifications only on TRANSITION, where the old code
        // inserted one every night forever (39 rows for snehlata, 34 for
        // shiva@gmail.com).
        console.log(`[INBOX-WORKER] Warming up${useBrowser ? '' : ' (browser-free)'}...`);
        let info;
        if (useBrowser) {
            await safeGoto(page, 'https://www.linkedin.com/feed/');
            await wait(randomRange(5000, 8000));
            info = await classifyPage(page);
        } else {
            const warm = await apiRequest.get('https://www.linkedin.com/feed/');
            const landed = warm.url();
            // Only a /checkpoint/ URL needs the body, and only to tell an
            // email-pin challenge from a captcha/phone/app one. Everything else
            // is decided by the URL, so don't pull HTML we won't read.
            const html = landed.includes('/checkpoint/') ? await warm.text().catch(() => null) : null;
            info = classifyHtml(landed, html);
        }

        if (isCheckpoint(info)) {
            console.error(`[INBOX-WORKER] Session not usable — kind=${info.kind} url=${info.url}`);
            await handleCheckpoint({ userId, info }).catch(err =>
                console.error(`[INBOX-WORKER] handleCheckpoint failed: ${err.message}`));
            return;
        }

        // 2. On the browser path only: sniff csrf + page-instance from the real
        //    UI's own traffic. Off-browser there is nothing to sniff and nothing
        //    to miss — csrf is the JSESSIONID cookie value and page-instance is
        //    telemetry (omitting it returns the identical 200).
        if (useBrowser) {
            console.log(`[INBOX-WORKER] Capturing Voyager headers...`);
            const headersPromise = captureVoyagerHeaders(page, userId, 10000);
            console.log(`[INBOX-WORKER] Navigating to inbox...`);
            await safeGoto(page, 'https://www.linkedin.com/messaging/');
            if (!await headersPromise) {
                console.warn(`[INBOX-WORKER] Could not capture Voyager headers. Inbox sync may fail.`);
            }
        }

        // 3. Warm the self mailbox URN cache (needed for syncInbox).
        console.log(`[INBOX-WORKER] Warming self cache...`);
        const meR = await warmSelfCache(userId, page, apiRequest);
        if (!meR.ok) {
            // Log only — deliberately no user notification. This is an internal
            // transient (headers/getMe didn't come back on this pass), and the
            // old "Could not warm LinkedIn cache. Please try again." gave the
            // user nothing to act on while carrying the same un-deduped
            // per-night spam risk as the two branches above. If the session is
            // genuinely dead, the warmup gate above catches it on the
            // next run and records it properly through handleCheckpoint.
            console.error(`[INBOX-WORKER] warmSelfCache failed: ${(meR as any).error || 'unknown'} — skipping this run`);
            return;
        }

        // 5. Fetch inbox thread list via Voyager GraphQL
        console.log(`[INBOX-WORKER] Fetching inbox threads via Voyager API...`);
        // 5 was leaving replies unread: rajaji's mailbox has 18 threads, so
        // anything below the 5 most recent was never even looked at. The thread
        // list is a single API call whatever the count, and the per-thread
        // fetches below are now gated on the participant being a tracked lead,
        // so widening this costs ~nothing.
        const inbox = await voyagerSyncInbox(userId, page, { maxThreads: 25 }, apiRequest);
        if (!inbox.ok) {
            console.error(`[INBOX-WORKER] syncInbox failed: ${(inbox as any).error || 'unknown'}`);
            return;
        }

        const conversations = inbox.data.conversations;
        console.log(`[INBOX-WORKER] Found ${conversations.length} threads.`);

        // 6. For each thread, fetch full message bodies via Voyager GraphQL
        //    with fallback to the last-message preview from the thread list.
        let totalNewReplies = 0;

        for (const c of conversations) {
            const participantName = `${c.otherFirstName} ${c.otherLastName}`.trim() || 'Unknown';

            // Match the lead FIRST. The old order fetched the full message
            // history for every thread and only then looked for a lead,
            // throwing most of it away — on this mailbox that's 18 Voyager
            // calls to keep maybe 2. Every discarded call was still a request
            // LinkedIn saw us make, so this is a footprint reduction as much as
            // a speed one.
            const lead = await prisma.lead.findFirst({
                where: {
                    userId,
                    OR: [
                        c.otherProfileUrl ? { linkedinUrl: { contains: extractVanityFromUrl(c.otherProfileUrl) || '__no_match__' } } : { id: '__no_match__' },
                        { firstName: { contains: c.otherFirstName, mode: 'insensitive' } },
                    ],
                }
            });

            if (!lead) {
                console.log(`[INBOX-WORKER] No matching lead for "${participantName}". Skipping.`);
                continue;
            }

            console.log(`[INBOX-WORKER] Fetching messages for ${participantName}...`);
            const msgs = await getMessagesInConversation(userId, c.conversationUrn, page, apiRequest);
            let chatHistory: Array<{ sender: string; text: string; direction: 'SENT' | 'RECEIVED' }>;
            if (msgs.ok && msgs.data.length > 0) {
                chatHistory = msgs.data.map((m) => ({
                    sender: m.isFromMe ? 'You' : `${m.senderFirstName} ${m.senderLastName}`.trim(),
                    text: m.body,
                    direction: m.isFromMe ? 'SENT' as const : 'RECEIVED' as const,
                }));
            } else if (c.lastMessageText) {
                chatHistory = [{
                    sender: 'last-message',
                    text: c.lastMessageText,
                    direction: 'RECEIVED',
                }];
            } else {
                chatHistory = [];
            }

            if (chatHistory.length === 0) continue;

            console.log(`[INBOX-WORKER] Got ${chatHistory.length} messages for ${participantName}.`);

            // 7. Save to DB
            let hasNewReply = false;
            const base = Date.now();
            const total = chatHistory.length;
            for (let m = 0; m < total; m++) {
                const msg = chatHistory[m];
                const exists = await prisma.message.findFirst({
                    where: { leadId: lead.id, content: msg.text }
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

                const activeLinks = await prisma.campaignLead.findMany({
                    where: { leadId: lead.id, isCompleted: false },
                    select: { campaignId: true },
                });
                const lastInbound = [...chatHistory].reverse().find(msg => msg.direction === 'RECEIVED');
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

            // Brief pause between threads
            await wait(randomRange(800, 1500));
        }

        console.log(`[INBOX-WORKER] Inbox sync complete. Synced ${conversations.length} threads, ${totalNewReplies} with new replies.`);

    } catch (err: any) {
        console.error(`[INBOX-WORKER] Error:`, err.message);
    } finally {
        if (context) await context.close().catch(() => {});
        if (browser) await browser.close().catch(() => {});
        if (disposeApi) await disposeApi().catch(() => {});
        await prisma.user
            .update({ where: { id: userId }, data: { cloudWorkerActive: false, lastCloudActionAt: new Date() } })
            .catch(() => {});
        await releaseAccountLock(userId, lockToken);
    }
};

function extractVanityFromUrl(profileUrl: string): string | null {
    if (!profileUrl) return null;
    const m = profileUrl.match(/\/in\/([^/?]+)/);
    return m ? m[1] : null;
}

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
