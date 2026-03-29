import { NodeHandler, NodeResult } from '../types';

const wait = (ms: number) => new Promise(res => setTimeout(res, ms));
const randomRange = (min: number, max: number) => Math.floor(Math.random() * (max - min + 1) + min);

async function safeGoto(page: any, url: string, retries = 3) {
    for (let i = 0; i < retries; i++) {
        try {
            await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
            return true;
        } catch (err: any) {
            if (i === retries - 1) throw err;
            await wait(3000);
        }
    }
}

interface InboxMessage {
    sender: string;
    text: string;
}

interface InboxThread {
    threadUrl: string;
    participantName: string;
    messages: InboxMessage[];
}

interface InboxSyncOutput {
    syncedThreads: number;
    threads: InboxThread[];
}

export const inboxSync: NodeHandler = async (ctx, config): Promise<NodeResult> => {
    const { page } = ctx;
    const maxThreads = config.maxThreads || 3;

    const output: InboxSyncOutput = { syncedThreads: 0, threads: [] };

    try {
        // Navigate to inbox
        console.log('[INBOX-SYNC] Navigating to messaging inbox...');
        await safeGoto(page, 'https://www.linkedin.com/messaging/');
        await wait(randomRange(4000, 6000));

        // Wait for conversation list
        try {
            await page.waitForSelector('.msg-conversation-listitem', { timeout: 15000 });
            console.log('[INBOX-SYNC] Conversation list rendered.');
        } catch {
            console.log('[INBOX-SYNC] Timed out waiting for conversation list.');
        }

        // Scroll the conversation list
        const leftPane = page.locator('.msg-conversations-container__list, ul.msg-conversations-container__conversations-list').first();
        if (await leftPane.isVisible({ timeout: 5000 }).catch(() => false)) {
            await leftPane.click({ force: true }).catch(() => {});
            await wait(1000);
            for (let i = 0; i < 4; i++) {
                await page.keyboard.press('PageDown');
                await wait(randomRange(800, 1500));
            }
        }

        // Count threads
        const threadItems = page.locator('.msg-conversation-listitem');
        const threadCount = await threadItems.count();

        if (threadCount === 0) {
            return { success: false, error: 'No conversation threads found' };
        }

        const syncLimit = Math.min(threadCount, maxThreads);
        console.log(`[INBOX-SYNC] Found ${threadCount} threads. Syncing top ${syncLimit}...`);

        for (let i = 0; i < syncLimit; i++) {
            const currentItem = threadItems.nth(i);

            // Extract participant name
            const nameLoc = currentItem.locator('.msg-conversation-listitem__participant-names, .msg-conversation-card__participant-names').first();
            let participantName = 'Unknown';
            if (await nameLoc.isVisible({ timeout: 3000 }).catch(() => false)) {
                const rawName = await nameLoc.innerText();
                participantName = rawName.split('\n')[0].trim();
            }

            console.log(`[INBOX-SYNC] Loading thread ${i + 1}/${syncLimit} with ${participantName}...`);

            await currentItem.click({ force: true });
            await wait(randomRange(4000, 6000));

            const threadUrl = page.url();

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
            const chatHistory: InboxMessage[] = await page.evaluate(() => {
                const msgs: InboxMessage[] = [];
                const eventNodes = Array.from(document.querySelectorAll('.msg-s-message-list__event, li.msg-s-message-list__event'));

                for (const eventNode of eventNodes) {
                    const bodyNode = eventNode.querySelector('.msg-s-event-listitem__body, .msg-s-event__content');
                    if (!bodyNode) continue;

                    const text = (bodyNode as HTMLElement).innerText.trim();
                    if (text.length === 0) continue;

                    let sender = 'Unknown';

                    // Strategy 1: aria-label "Options for..." pattern
                    const optionEl = eventNode.querySelector('[aria-label*="Options for"]');
                    if (optionEl) {
                        const ariaLabel = optionEl.getAttribute('aria-label');
                        if (ariaLabel?.includes('your message')) {
                            sender = 'You';
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
                        }
                    }

                    msgs.push({ sender, text });
                }
                return msgs;
            });

            output.threads.push({ threadUrl, participantName, messages: chatHistory });
            output.syncedThreads++;
            console.log(`[INBOX-SYNC] Extracted ${chatHistory.length} messages from ${participantName}.`);
        }

        console.log(`[INBOX-SYNC] Done. Synced ${output.syncedThreads} threads.`);
        return { success: true, output };

    } catch (err: any) {
        return { success: false, error: err.message };
    }
};
