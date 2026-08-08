import { prisma } from '@repo/db';
import { launchAuthenticatedContext } from '../campaign-engine/session-launch';

/**
 * Automates the withdrawal of old pending LinkedIn invitations.
 *
 * HISTORY — why this file is written the way it is (2026-08-08):
 * This job used to build its own Chromium launch, and got it wrong in the most
 * damaging way possible. It read `(user as any).proxy` behind a `@ts-ignore`,
 * but `findUnique` loads no relations and the relation is named `Proxy` anyway,
 * so the value was ALWAYS undefined and the browser launched with **no proxy**.
 * It then injected the user's real session cookies and browsed LinkedIn — from
 * the Hetzner datacenter IP instead of the account's pinned ISP egress, with a
 * random user agent instead of the pinned fingerprint. Running nightly across
 * every user, it invalidated sessions within hours, for weeks.
 *
 * It never even worked: on 2026-08-08, 11/11 runs logged "No sent invitations
 * found or layout changed" and withdrew nothing — the unproxied browser was
 * being served an authwall, not the invitations page.
 *
 * So: NEVER hand-roll a launch here. `launchAuthenticatedContext` is the single
 * source of truth for the sticky-proxy invariant — it pins the login snapshot at
 * LAUNCH level, injects cookies + the pinned UA, and ABORTS when no snapshot
 * exists rather than silently falling back to a different IP.
 */
export const withdrawOldInvites = async (userId: string, olderThanDays: number = 30) => {
    console.log(`[Withdraw Sync] Checking old outstanding invites for user ${userId} > ${olderThanDays} days`);

    const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { linkedinCookie: true, sessionInvalid: true, accountHealth: true },
    });

    if (!user || !user.linkedinCookie) {
        console.log(`[Withdraw Sync] Skipping: no LinkedIn session.`);
        return { success: false, reason: 'Missing cookies/auth' };
    }

    // Don't drive an account LinkedIn has already logged out or challenged.
    // Callers gate on this too; belt-and-braces because this function is
    // exported and a future caller may not.
    if (user.sessionInvalid || (user.accountHealth && user.accountHealth !== 'HEALTHY')) {
        console.log(`[Withdraw Sync] Skipping: session invalid or accountHealth=${user.accountHealth}.`);
        return { success: false, reason: 'session-unhealthy' };
    }

    let browser;
    try {
        // Enforce cloud worker safety lock
        await prisma.user.update({
            where: { id: userId },
            data: { cloudWorkerActive: true, lastCloudActionAt: new Date() }
        });

        // 1. Authenticated launch — pinned proxy at LAUNCH level, pinned UA,
        //    cookies injected, aborts if no snapshot. See the file header.
        const launch = await launchAuthenticatedContext(userId);
        if (!launch.ok) {
            console.warn(`[Withdraw Sync] Launch refused (${launch.failedAt}): ${launch.error}`);
            return { success: false, reason: launch.failedAt };
        }
        browser = launch.browser;
        const { context, page } = launch;
        console.log(`[Withdraw Sync] Launched through pinned proxy ${launch.proxyServer}`);

        // 1.5. Proxy Bandwidth & Server RAM Optimizer
        await context.route('**/*', (route: any) => {
            const type = route.request().resourceType();
            if (['image', 'media', 'font', 'stylesheet'].includes(type) || route.request().url().includes('google-analytics')) {
                route.abort();
            } else {
                route.continue();
            }
        });

        // 3. Navigate to Sent Invitations
        console.log(`[Withdraw Sync] Navigating to active sent invitations...`);
        await page.goto('https://www.linkedin.com/mynetwork/invitation-manager/sent/', { waitUntil: 'load', timeout: 60000 });

        // Did we actually reach the invitations page? This check exists because
        // its absence hid the unproxied-launch bug for weeks: every run reported
        // the benign "No sent invitations found", when in reality LinkedIn was
        // serving an authwall to a datacenter IP. "Nothing to withdraw" and
        // "we got bounced to a login page" must never look the same in the log.
        const landed = page.url();
        if (/\/(uas\/)?login|authwall|checkpoint/i.test(landed)) {
            console.error(`[Withdraw Sync] Bounced to a login/checkpoint page: ${landed} — session not usable from this egress.`);
            return { success: false, reason: 'authwall', url: landed };
        }

        // Wait for the invitation list container to load
        try {
            await page.waitForSelector('.invitation-card', { timeout: 10000 });
        } catch (e) {
            console.log(`[Withdraw Sync] No sent invitations found or layout changed (url=${landed}).`);
            return { success: true, count: 0 };
        }

        // 4. Extract and Click Old Invitations Native in DOM Context
        const result = await page.evaluate(async () => {
            let withdrawnCount = 0;

            // Loop over all rendered invitation card items
            const cards = document.querySelectorAll('.invitation-card');
            for (let i = 0; i < cards.length; i++) {
                const card = cards[i] as HTMLElement;
                const timeText = card.querySelector('time.time-badge')?.textContent?.toLowerCase() || '';

                // Detection logic: X months ago, X years ago
                // Often LinkedIn format: "2 weeks ago", "1 month ago", "6 months ago"
                const isOlderThanAmonth = timeText.includes('month') || timeText.includes('year') || timeText.includes('4 week');

                if (isOlderThanAmonth) {
                    const buttons = card.querySelectorAll('button');
                    const withdrawBtn = Array.from(buttons).find(b => b.innerText.toLowerCase().includes('withdraw'));

                    if (withdrawBtn) {
                        withdrawBtn.click();
                        withdrawnCount++;

                        // Fake a human delay inside the Chromium Context
                        await new Promise(r => setTimeout(r, 1500));

                        // Confirm modal (Usually pops up: class .artdeco-modal__confirm-dialog-btn)
                        const confirmBtn = document.querySelector('button.artdeco-modal__confirm-dialog-btn') as HTMLElement;
                        if (confirmBtn) {
                            confirmBtn.click();
                            await new Promise(r => setTimeout(r, 1000)); // sleep after animation
                        }
                    }
                }
            }
            return withdrawnCount;
        });

        console.log(`[Withdraw Sync] Finished navigating. Withdrew ${result} old connection requests.`);

        // 5. Update Local Database if lead exists to mark as withdrawn/unconnected
        // (Wait, we'd need LinkedIn IDs or URLs to sync perfectly. For simple usage, 
        // they return to "UNCONNECTED" natively on LinkedIn, so subsequent scrapes will catch it).

        return { success: true, count: result };

    } catch (error) {
        console.error(`[Withdraw Sync] Encountered error:`, error);
        return { success: false, error: 'Failed to process withdrawals' };
    } finally {
        if (browser) await browser.close();

        // Always unlock cloud safety explicitly
        await prisma.user.update({
            where: { id: userId },
            data: { cloudWorkerActive: false, lastCloudActionAt: new Date() }
        });
    }
};
