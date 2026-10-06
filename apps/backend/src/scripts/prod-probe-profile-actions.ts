// What controls does a profile actually offer, and what do they say?
//
// Read-only: navigates, reads the action bar and opens the More menu, clicks
// nothing. Written because the follow node's state was being inferred from
// which selectors missed, which is guesswork — this reads the labels.
//
// ENV: QUSER_ID, QPROFILE_URL

import { prisma } from '@repo/db';
import { launchAuthenticatedContext } from '../campaign-engine/session-launch';

const wait = (ms: number) => new Promise(r => setTimeout(r, ms));

async function main() {
    const userId = process.env.QUSER_ID!;
    const url = process.env.QPROFILE_URL!;
    if (!userId || !url) { console.error('QUSER_ID and QPROFILE_URL required'); process.exit(2); }

    const user = await prisma.user.findUnique({ where: { id: userId }, select: { sessionPath: true } });
    const launch = await launchAuthenticatedContext(userId, undefined as any);
    if (!launch.ok) { console.error('launch failed:', launch.error); process.exit(1); }
    const { page, browser } = launch as any;
    try {
        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
        await wait(9000);
        console.log('url:', page.url());

        const bar = await page.evaluate(() => {
            const btns = Array.from(document.querySelectorAll('main button, main a[role="button"]'));
            return btns.slice(0, 20).map((b: any) => ({
                text: (b.textContent || '').trim().slice(0, 30),
                aria: b.getAttribute('aria-label') || '',
            })).filter(x => x.text || x.aria);
        });
        console.log('\n--- action-bar controls');
        bar.forEach((b: any) => console.log(`   text="${b.text}"  aria="${b.aria}"`));

        const more = page.locator('button:has(span:text-is("More")), button[aria-label^="More"]').first();
        if (await more.isVisible({ timeout: 4000 }).catch(() => false)) {
            await more.click({ timeout: 5000 }).catch(() => more.click({ force: true }));
            await wait(2500);
            const items = await page.evaluate(() => Array.from(
                document.querySelectorAll('[role="menuitem"], .artdeco-dropdown__item')
            ).map((e: any) => ({
                text: (e.textContent || '').trim().slice(0, 40),
                aria: e.getAttribute('aria-label') || '',
            })));
            console.log('\n--- More menu items');
            items.forEach((i: any) => console.log(`   text="${i.text}"  aria="${i.aria}"`));
            await page.keyboard.press('Escape').catch(() => {});
        } else {
            console.log('\n--- no More button found');
        }
    } finally {
        await browser?.close().catch(() => {});
    }
    await prisma.$disconnect();
}

main().catch(async (e) => { console.error(e?.message || e); await prisma.$disconnect(); process.exit(1); });
