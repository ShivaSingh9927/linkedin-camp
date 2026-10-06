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

        // Which container actually holds the profile's OWN action bar? The
        // node searched the whole page, so it matched embedded post authors
        // and a video player's controls.
        const scopes = await page.evaluate(() => {
            const candidates = [
                '.pvs-profile-actions',
                '.pv-top-card-v2-ctas',
                '.ph5.pb5',
                'main section:first-of-type',
                '[data-view-name="profile-top-card"]',
                'main .artdeco-card:first-of-type',
            ];
            return candidates.map((sel) => {
                const el = document.querySelector(sel);
                if (!el) return { sel, found: false, buttons: [] as any[] };
                const buttons = Array.from(el.querySelectorAll('button, a[role="button"]'))
                    .slice(0, 10)
                    .map((b: any) => ({ text: (b.textContent || '').trim().slice(0, 28), aria: b.getAttribute('aria-label') || '' }))
                    .filter((x) => x.text || x.aria);
                return { sel, found: true, buttons };
            });
        });
        console.log('\n--- candidate scopes for the profile action bar');
        for (const s of scopes as any[]) {
            console.log(`  ${s.sel}  found=${s.found}`);
            for (const b of s.buttons) console.log(`      text="${b.text}"  aria="${b.aria}"`);
        }

        const topCard = page.locator('.pvs-profile-actions, .pv-top-card-v2-ctas, [data-view-name="profile-top-card"]').first();
        const hasTop = (await topCard.count().catch(() => 0)) > 0;
        console.log(`\nprofile action container present: ${hasTop}`);
        const more = (hasTop ? topCard : page).locator('button:has(span:text-is("More")), button[aria-label^="More"]').first();
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
