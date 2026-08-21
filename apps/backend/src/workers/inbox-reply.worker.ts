import { Worker, Job, Queue } from 'bullmq';
import { prisma } from '@repo/db';
import Redis from 'ioredis';
import { launchAuthenticatedContext } from '../campaign-engine/session-launch';
import { deliverDirectMessage } from '../campaign-engine/nodes/deliver-dm';
import { checkQuota, nextDayRetryAt } from '../campaign-engine/safety/quota';
import { tryAcquireAccountLock, releaseAccountLock } from './campaign-worker';
import {
    getBrowserlessVoyagerContext,
    warmSelfCache,
    syncInbox as voyagerSyncInbox,
    sendMessageToConversation,
} from '../services/voyager-api.service';

/**
 * Inbox manual-reply flush worker — API-first, DOM-fallback.
 *
 * When a user hits Send on a reply, the controller writes the Message as
 * `deliveryStatus = 'PENDING'` and enqueues a DEBOUNCED per-account flush. This
 * worker is where those replies reach LinkedIn, and it COALESCES: one flush per
 * account acquires the account lock once and drains the user's pending replies.
 *
 * Transport (proven 2026-08-21):
 *   - PRIMARY = browser-FREE Voyager. Replying into an EXISTING thread works via
 *     the legacy events endpoint (sendMessageToConversation) — no Chromium,
 *     ~300ms. We resolve each reply's conversationUrn from a single conversations
 *     read (vanity-match lead → thread).
 *   - FALLBACK = DOM. If a lead has no synced thread yet, or the API send fails,
 *     we fall back to the proven deliverDirectMessage browser path for those.
 *
 * Safety (unchanged from campaigns — LinkedIn rate-limits the ACCOUNT, not the
 * transport): per-account Redis lock serialises, the same daily send-message cap
 * applies, work is bounded per run (MAX_PER_FLUSH), and sends are human-paced.
 * Transient failures (no session/proxy, dead session) leave replies PENDING and
 * re-enqueue — only a genuine per-lead delivery failure marks FAILED.
 */

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';
const redisConnection = REDIS_URL ? new Redis(REDIS_URL, { maxRetriesPerRequest: null }) : null;

export const inboxReplyQueue = redisConnection
    ? new Queue('inbox-reply', { connection: redisConnection as any })
    : null;

const wait = (ms: number) => new Promise(res => setTimeout(res, ms));
const randomRange = (min: number, max: number) => Math.floor(Math.random() * (max - min + 1) + min);

const LOCK_RETRY_DELAY_MS = 30_000;   // account busy / transient → retry the flush shortly
const MAX_PER_FLUSH = 8;              // bound per-run work under the lock TTL
const API_MIN_GAP_MS = 8_000;        // browser-free sends are cheap but still paced
const API_MAX_GAP_MS = 20_000;
const DOM_MIN_GAP_MS = 15_000;       // DOM fallback paced like campaign sends
const DOM_MAX_GAP_MS = 45_000;

const PENDING_WHERE = { deliveryStatus: 'PENDING', channel: 'linkedin', direction: 'SENT' } as const;

// Resolve a lead → conversation by NAME. messengerConversations returns the
// participant's profileUrl as /in/<opaque-member-id>, NOT the vanity slug, so
// a vanity-URL match always misses (the inbox sync matches by name for the same
// reason). Names aren't unique, so a duplicate name is marked AMBIGUOUS and
// falls to the DOM path rather than risk sending to the wrong thread.
const AMBIGUOUS = '__AMBIGUOUS__';
function nameKey(first?: string | null, last?: string | null): string {
    return `${(first || '').trim()} ${(last || '').trim()}`.toLowerCase().trim();
}

/**
 * Enqueue a coalescing reply flush, with a short Redis-backed debounce so a
 * burst of Send clicks collapses into ONE flush that drains them together.
 */
export const enqueueInboxReplyFlush = async (
    userId: string,
    opts: { debounceSec?: number } = {},
): Promise<boolean> => {
    if (!inboxReplyQueue) return false;
    const { debounceSec = 20 } = opts;

    if (debounceSec > 0 && redisConnection) {
        const set = await redisConnection.set(`inbox_reply_recent:${userId}`, '1', 'EX', debounceSec, 'NX');
        if (set !== 'OK') {
            console.log(`[INBOX-REPLY] Debounced flush for ${userId} (within ${debounceSec}s) — batch grows.`);
            return false;
        }
    }
    // Delay the run so replies typed within the window are all PENDING when it fires.
    await inboxReplyQueue.add('flush', { userId }, {
        delay: debounceSec * 1000,
        removeOnComplete: true,
        removeOnFail: true,
    });
    return true;
};

async function reEnqueue(userId: string, delayMs: number) {
    if (!inboxReplyQueue) return;
    await inboxReplyQueue.add('flush', { userId }, {
        delay: delayMs,
        removeOnComplete: true,
        removeOnFail: true,
    });
}

async function markSent(userId: string, msg: { id: string; leadId: string }) {
    await prisma.message.update({ where: { id: msg.id }, data: { deliveryStatus: 'SENT', sentAt: new Date() } }).catch(() => {});
    await prisma.actionLog.create({
        data: { userId, leadId: msg.leadId, actionType: 'send-message', status: 'SUCCESS', errorMessage: null },
    }).catch(() => {});
}

async function markFailed(userId: string, msg: { id: string; leadId: string }, reason: string) {
    await prisma.message.update({ where: { id: msg.id }, data: { deliveryStatus: 'FAILED' } }).catch(() => {});
    await prisma.actionLog.create({
        data: { userId, leadId: msg.leadId, actionType: 'send-message', status: 'FAILED', errorMessage: reason },
    }).catch(() => {});
    console.warn(`[INBOX-REPLY] Reply ${msg.id} FAILED: ${reason}`);
}

async function pendingCount(userId: string): Promise<number> {
    return prisma.message.count({ where: { userId, ...PENDING_WHERE } });
}

export const initInboxReplyWorker = () => {
    if (!redisConnection) {
        console.log('[INBOX-REPLY] ❌ No Redis connection — worker NOT started');
        return;
    }
    console.log('[INBOX-REPLY] ✅ Starting worker (queue: inbox-reply)...');

    new Worker('inbox-reply', async (job: Job) => {
        const { userId } = job.data as { userId: string };

        if ((await pendingCount(userId)) === 0) return;

        const lockToken = `inbox-reply-${job.id || 'x'}-${Date.now()}`;
        if (!(await tryAcquireAccountLock(userId, lockToken))) {
            console.log(`[INBOX-REPLY] 🔒 Account ${userId} busy — re-queueing flush in ${LOCK_RETRY_DELAY_MS / 1000}s`);
            await reEnqueue(userId, LOCK_RETRY_DELAY_MS);
            return;
        }

        let sent = 0;
        let capHit = false;
        const needsDom: Array<{ id: string; leadId: string; content: string; linkedinUrl: string }> = [];

        try {
            // Snapshot a bounded batch up front (we hold the lock; the controller
            // only ADDS pending rows, so this can't double-process).
            const batch = await prisma.message.findMany({
                where: { userId, ...PENDING_WHERE },
                orderBy: { sentAt: 'asc' },
                take: MAX_PER_FLUSH,
                include: { Lead: true },
            });

            // ---- API-FIRST PASS (browser-free) ----
            const bl = await getBrowserlessVoyagerContext(userId);
            if (!bl) {
                // No session/proxy snapshot — DOM would fail identically. Transient.
                console.warn(`[INBOX-REPLY] No browser-free context for ${userId} — leaving replies PENDING, retrying.`);
                await reEnqueue(userId, LOCK_RETRY_DELAY_MS);
                return;
            }

            let sessionAlive = false;
            const convByName = new Map<string, string>();
            try {
                const warm = await warmSelfCache(userId, null, bl.ctx);
                if (warm.ok) {
                    const inbox = await voyagerSyncInbox(userId, null, { maxThreads: 50 }, bl.ctx);
                    if (inbox.ok) {
                        sessionAlive = true;
                        for (const c of inbox.data!.conversations) {
                            const k = nameKey(c.otherFirstName, c.otherLastName);
                            if (!k) continue;
                            convByName.set(k, convByName.has(k) ? AMBIGUOUS : c.conversationUrn);
                        }
                    }
                }

                if (sessionAlive) {
                    for (const msg of batch) {
                        const quota = await checkQuota(userId, 'send-message');
                        if (!quota.allowed) { capHit = true; break; }

                        const lead = (msg as any).Lead;
                        const url = lead?.linkedinUrl as string | undefined;
                        const convUrn = lead ? convByName.get(nameKey(lead.firstName, lead.lastName)) : undefined;
                        if (!convUrn || convUrn === AMBIGUOUS || !url) {
                            // No unambiguous thread (cold / unsynced / duplicate name) → DOM fallback.
                            if (url) needsDom.push({ id: msg.id, leadId: msg.leadId, content: msg.content, linkedinUrl: url });
                            else await markFailed(userId, msg, 'lead has no linkedinUrl');
                            continue;
                        }

                        const r = await sendMessageToConversation(userId, convUrn, msg.content, { apiRequest: bl.ctx });
                        if (r.ok) {
                            await markSent(userId, msg);
                            sent++;
                            console.log(`[INBOX-REPLY] Reply ${msg.id} SENT via API.`);
                            await wait(randomRange(API_MIN_GAP_MS, API_MAX_GAP_MS));
                        } else {
                            // API refused this one → try DOM for it.
                            console.log(`[INBOX-REPLY] API send failed for ${msg.id} (${r.status || ''} ${r.error || ''}) → DOM fallback.`);
                            needsDom.push({ id: msg.id, leadId: msg.leadId, content: msg.content, linkedinUrl: url });
                        }
                    }
                } else {
                    // Session not live browser-free → transient. Don't mark anything;
                    // don't DOM-fallback (a dead session would DOM-fail too and
                    // wrongly mark FAILED). Just retry the whole flush later.
                    console.warn(`[INBOX-REPLY] Browser-free session not live for ${userId} — leaving replies PENDING, retrying.`);
                    await reEnqueue(userId, LOCK_RETRY_DELAY_MS);
                    return;
                }
            } finally {
                await bl.dispose().catch(() => {});
            }

            // ---- DOM FALLBACK PASS (only reached with a confirmed-live session) ----
            if (needsDom.length > 0 && !capHit) {
                console.log(`[INBOX-REPLY] DOM fallback for ${needsDom.length} repl(y|ies).`);
                const launch = await launchAuthenticatedContext(userId);
                if (launch.ok) {
                    const { browser, context } = launch as any;
                    const page = context.pages()[0] || (await context.newPage());
                    try {
                        for (const m of needsDom) {
                            const quota = await checkQuota(userId, 'send-message');
                            if (!quota.allowed) { capHit = true; break; }
                            let deliver;
                            try {
                                deliver = await deliverDirectMessage(page, { linkedinUrl: m.linkedinUrl }, m.content);
                            } catch (e: any) {
                                deliver = { sent: false, error: e?.message || 'delivery threw' };
                            }
                            if (deliver.sent) { await markSent(userId, m); sent++; }
                            else await markFailed(userId, m, deliver.skipReason || deliver.error || 'unknown');
                            await wait(randomRange(DOM_MIN_GAP_MS, DOM_MAX_GAP_MS));
                        }
                    } finally {
                        await browser.close().catch(() => {});
                    }
                } else {
                    console.warn(`[INBOX-REPLY] DOM fallback launch failed (${(launch as any).error}) — leaving ${needsDom.length} PENDING.`);
                }
            }

            // ---- leftovers ----
            const remaining = await pendingCount(userId);
            if (remaining > 0) {
                const delayMs = capHit
                    ? Math.max(60_000, nextDayRetryAt().getTime() - Date.now())
                    : LOCK_RETRY_DELAY_MS;
                console.log(`[INBOX-REPLY] Flush done (sent ${sent}); ${remaining} still pending → re-flush in ${Math.round(delayMs / 1000)}s.`);
                await reEnqueue(userId, delayMs);
            } else {
                console.log(`[INBOX-REPLY] Flush complete — sent ${sent}, none remaining.`);
            }
        } catch (err: any) {
            console.error(`[INBOX-REPLY] Flush error for ${userId}: ${err?.message}`);
            await reEnqueue(userId, LOCK_RETRY_DELAY_MS);
        } finally {
            await releaseAccountLock(userId, lockToken);
            console.log(`[INBOX-REPLY] 🔓 Released account lock for ${userId}`);
        }
    }, {
        connection: redisConnection as any,
        concurrency: parseInt(process.env.INBOX_REPLY_CONCURRENCY || '6', 10),
    });
};
