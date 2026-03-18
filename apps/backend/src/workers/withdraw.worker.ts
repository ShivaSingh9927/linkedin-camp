import { chromium } from 'playwright';
import { prisma } from '@repo/db';
import { getRandomUserAgent } from '../services/safety.service';

/**
 * Automates the withdrawal of old pending LinkedIn invitations
 */
export const withdrawOldInvites = async (userId: string, olderThanDays: number = 30) => {
    console.log(`[Withdraw Sync] Checking old outstanding invites for user ${userId} > ${olderThanDays} days`);

    const user = await prisma.user.findUnique({
        where: { id: userId },
        include: { proxy: true }
    });

    if (!user || (!user.linkedinCookie && !user.proxy)) {
        console.log(`[Withdraw Sync] Skipping: Missing LinkedIn Cookie or Proxy info.`);
        return { success: false, reason: 'Missing cookies/auth' };
    }

    let browser;
    try {
        // Enforce cloud worker safety lock
        await prisma.user.update({
            where: { id: userId },
            data: { cloudWorkerActive: true, lastCloudActionAt: new Date() }
        });

        // 1. Initialise Headless Browser with Custom Settings
        const launchOptions: any = {
            headless: true,
            args: ['--no-sandbox', '--disable-setuid-sandbox']
        };

        // @ts-ignore
        if ((user as any).proxy) {
            launchOptions.proxy = {
                server: `http://${(user as any).proxy.proxyHost}:${(user as any).proxy.proxyPort}`,
                username: (user as any).proxy.proxyUsername || undefined,
                password: (user as any).proxy.proxyPassword || undefined
            };
        }

        browser = await chromium.launch(launchOptions);
        const context = await browser.newContext({ userAgent: getRandomUserAgent() });

        // 1.5. Proxy Bandwidth & Server RAM Optimizer
        await context.route('**/*', (route) => {
            const type = route.request().resourceType();
            if (['image', 'media', 'font', 'stylesheet'].includes(type) || route.request().url().includes('google-analytics')) {
                route.abort();
            } else {
                route.continue();
            }
        });

        // 2. Parse and Attach Session Cookies
        let cookies: any[] = [];
        try {
            cookies = JSON.parse(user.linkedinCookie as string);
        } catch (e) {
            cookies = [{
                name: 'li_at', value: user.linkedinCookie, domain: '.linkedin.com',
                path: '/', secure: true, httpOnly: true, sameSite: 'None'
            }];
        }
        await context.addCookies(Array.isArray(cookies) ? cookies : [cookies]);

        const page = await context.newPage();

        // 3. Navigate to Sent Invitations
        console.log(`[Withdraw Sync] Navigating to active sent invitations...`);
        await page.goto('https://www.linkedin.com/mynetwork/invitation-manager/sent/', { waitUntil: 'load', timeout: 60000 });

        // Wait for the invitation list container to load
        try {
            await page.waitForSelector('.invitation-card', { timeout: 10000 });
        } catch (e) {
            console.log(`[Withdraw Sync] No sent invitations found or layout changed.`);
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
