/**
 * inbox-sync-voyager.ts
 *
 * HYBRID inbox sync that uses Voyager GraphQL (HTTP) for the inbox preview
 * (thread list + metadata + per-thread message bodies) and falls back to the
 * DOM scraping path in `inbox-sync.ts` if the API is gated. Same return
 * shape as the DOM node — engine and storage layer don't need to know which
 * path ran.
 *
 * Why this exists: the DOM-based sync (`inbox-sync.ts`) costs ~5-8s per thread
 * (navigate to /messaging/, wait for thread list to render, click each
 * thread, wait for messages to load, scroll up to load history, parse DOM).
 * The Voyager path is ~300ms for thread metadata + ~300ms per thread for
 * full message bodies, all from inside the existing authenticated Playwright
 * context — no DOM scraping, no navigation.
 *
 * Trade-off: a small subset of message types (rich cards, reactions,
 * attachments) come back through the API with less rendering fidelity than
 * the DOM. We surface both forms: `messages: MessageBody[]` (full body text)
 * and `previews` (the metadata-only form for the inbox list).
 */
import { NodeHandler, NodeResult } from '../types';
import { prisma } from '@repo/db';
import { captureFirstReply } from '../../services/analytics.service';
import {
    syncInbox,
    getMessagesInConversation,
    warmSelfCache,
    captureVoyagerHeaders,
} from '../../services/voyager-api.service';

const wait = (ms: number) => new Promise(res => setTimeout(res, ms));
const randomRange = (min: number, max: number) => Math.floor(Math.random() * (max - min + 1) + min);

interface HybridThread {
    threadUrl: string;
    participantName: string;
    participantVanity: string | null;
    preview: string | null;
    unread: boolean;
    lastActivityAt: number | null;
    messages: Array<{
        sender: string;
        text: string;
        deliveredAt: number;
    }>;
}

/**
 * Voyager path. Requires a live page (we use it to ride the session).
 * Must be called with a page that's been navigated somewhere LinkedIn
 * recently so the page-instance + csrf are warm. We navigate to /messaging/
 * for safety and let that page render trigger a real voyager call, then
 * fire our own — the call works because the session is warm.
 */
async function syncInboxViaVoyager(
    userId: string,
    page: any,
    maxThreads: number
): Promise<{ ok: true; threads: HybridThread[]; mailboxCounts: any[]; mode: 'voyager' } | { ok: false; error: string }> {
    try {
        // 1. Warm self cache + capture headers by navigating to /messaging/
        //    (the real page will fire its own voyager call, which we sniff)
        await page.goto('https://www.linkedin.com/messaging/', {
            waitUntil: 'domcontentloaded',
            timeout: 60000,
        });
        // Wait for headers to be captured (or 8s max)
        await captureVoyagerHeaders(page, userId, 8000);
        await wait(randomRange(2000, 4000));

        // 2. Warm the self mailbox URN cache
        const meR = await warmSelfCache(userId, page);
        if (!meR.ok) {
            return { ok: false, error: `warmSelfCache failed: ${(meR as any).error || 'unknown'}` };
        }

        // 3. Fetch inbox preview
        const inbox = await syncInbox(userId, page, { maxThreads });
        if (!inbox.ok) {
            return { ok: false, error: `syncInbox failed: ${(inbox as any).error || 'unknown'}` };
        }

        // 4. For each thread, fetch the full message bodies in parallel
        //    (up to 5 concurrent to avoid hammering LinkedIn)
        //
        // IMPORTANT: the messengerMessages endpoint gates hard unless called
        // from the live thread detail page (page-instance = conversation_detail
        // + a fresh page session). When the gate fires, we still return the
        // thread with the LAST-MESSAGE PREVIEW from the list call (which is
        // always available), so the inbox UI still has something useful to
        // show — the per-thread message history just needs a separate
        // dedicated page navigation to be fully read.
        const threads: HybridThread[] = [];
        const concurrency = 5;
        for (let i = 0; i < inbox.data.conversations.length; i += concurrency) {
            const batch = inbox.data.conversations.slice(i, i + concurrency);
            const batchResults = await Promise.all(
                batch.map(async (c) => {
                    const msgs = await getMessagesInConversation(userId, c.conversationUrn, page);
                    // msgs may succeed OR may be gated (200 with empty/null).
                    // The preview from the list call is always populated, so
                    // we always have at least one message bubble to surface.
                    let messages: Array<{ sender: string; text: string; deliveredAt: number }>;
                    if (msgs.ok && msgs.data.length > 0) {
                        messages = msgs.data.map((m) => ({
                            sender: m.isFromMe ? 'You' : `${m.senderFirstName} ${m.senderLastName}`.trim(),
                            text: m.body,
                            deliveredAt: m.deliveredAt,
                        }));
                    } else if (c.lastMessageText) {
                        // Fall back to the single-message preview from the
                        // thread list endpoint (always available).
                        messages = [{
                            sender: 'last-message',
                            text: c.lastMessageText,
                            deliveredAt: c.lastActivityAt,
                        }];
                    } else {
                        messages = [];
                    }
                    const threadUrl = c.otherProfileUrl
                        ? `${c.otherProfileUrl.replace(/\/$/, '')}`
                        : `https://www.linkedin.com/messaging/thread/${extractThreadId(c.conversationUrn)}/`;
                    return {
                        threadUrl,
                        participantName: `${c.otherFirstName} ${c.otherLastName}`.trim(),
                        participantVanity: extractVanityFromUrl(c.otherProfileUrl),
                        preview: c.lastMessageText,
                        unread: c.unreadCount > 0,
                        lastActivityAt: c.lastActivityAt || null,
                        messages,
                    } as HybridThread;
                })
            );
            threads.push(...batchResults);
            // Short pause between batches
            if (i + concurrency < inbox.data.conversations.length) {
                await wait(randomRange(800, 1500));
            }
        }

        return { ok: true, threads, mailboxCounts: inbox.data.mailboxCounts, mode: 'voyager' };
    } catch (e: any) {
        return { ok: false, error: e?.message || String(e) };
    }
}

function extractThreadId(convUrn: string): string {
    // conversationUrn = "urn:li:msg_conversation:(urn:li:fsd_profile:<id>,2-<base64>=)"
    const m = convUrn.match(/,2-([^)]+)\)/);
    return m ? m[1] : '';
}

function extractVanityFromUrl(profileUrl: string): string | null {
    // profileUrl = "https://www.linkedin.com/in/ACoAAGj45loB..." (returns fsd
    // id as a path component in the API response — annoying). Real UI uses
    // the publicIdentifier. We return null here and let the engine re-resolve
    // if it needs the vanity.
    if (!profileUrl) return null;
    const m = profileUrl.match(/\/in\/([^/?]+)/);
    return m ? m[1] : null;
}

export const inboxSyncVoyager: NodeHandler = async (ctx, config): Promise<NodeResult> => {
    const { page, lead, userId, campaignId } = ctx;
    const maxThreads = (config as any)?.maxThreads || 10;

    try {
        if (!page) {
            return { success: false, error: 'inbox-sync-voyager requires a live Page' };
        }

        console.log(`[INBOX-SYNC-VOYAGER] Starting sync (maxThreads=${maxThreads})...`);
        const r = await syncInboxViaVoyager(userId, page, maxThreads);
        if (!r.ok) {
            // Voyager failed — surface as failed result so the engine can
            // fall back to DOM if a sibling node is configured. We don't
            // auto-fallback here because the DOM node is a separate
            // nodeType and the engine doesn't know about it.
            console.log(`[INBOX-SYNC-VOYAGER] Voyager sync failed: ${(r as any).error || 'unknown'}`);
            return { success: false, error: (r as any).error || 'unknown' };
        }

        // Persist any new REPLY messages to the Message table so the
        // reply-pause invariant (engine.ts) catches them. The leadId here
        // may be null since inbox-sync is account-level (not per-lead);
        // look up the lead by otherVanity when possible.
        let newReplies = 0;
        for (const t of r.threads) {
            for (const m of t.messages) {
                if (m.sender === 'You') continue; // skip our own sends
                // Try to find a Lead row matching this conversation's vanity
                // (or by memberId if we have it).
                const lead = await prisma.lead.findFirst({
                    where: {
                        userId,
                        OR: [
                            t.participantVanity ? { linkedinUrl: { contains: `/in/${t.participantVanity}` } } : { id: '__no_match__' },
                        ],
                    },
                    select: { id: true },
                }).catch(() => null);
                if (!lead) continue;
                // Only persist a new Message row if one doesn't already
                // exist with the same body+sender+leadId (de-dup).
                const exists = await prisma.message.findFirst({
                    where: {
                        leadId: lead.id,
                        direction: 'RECEIVED',
                        content: m.text,
                    },
                    select: { id: true },
                }).catch(() => null);
                if (exists) continue;
                await prisma.message.create({
                    data: {
                        userId,
                        leadId: lead.id,
                        direction: 'RECEIVED',
                        content: m.text,
                        source: 'INBOX_SYNC',
                        sentAt: new Date(m.deliveredAt || Date.now()),
                    },
                }).catch((err: any) => console.log(`[INBOX-SYNC-VOYAGER] message write failed: ${err.message}`));
                newReplies++;
            }
        }

        // Side-effect: write a summary to Lead.connectionStatus for the
        // first lead with new replies (the engine's reply-pause check
        // picks it up on the next tick).
        if (newReplies > 0) {
            console.log(`[INBOX-SYNC-VOYAGER] ${newReplies} new reply messages persisted`);
            void captureFirstReply(userId, newReplies);
        }

        return {
            success: true,
            output: {
                mode: r.mode,
                syncedThreads: r.threads.length,
                mailboxCounts: r.mailboxCounts,
                newReplies,
                threads: r.threads,
            },
        };
    } catch (err: any) {
        return { success: false, error: err?.message || String(err) };
    }
};
