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

        // Where does each candidate control actually live? Class-based scoping
        // is useless on the obfuscated build, so the question is what ANCESTOR
        // marks a control as belonging to an embedded post or a media player —
        // i.e. what to exclude, rather than what to scope into.
        await page.evaluate((n: string) => { (window as any).__QNAME__ = n; }, process.env.QNAME || '').catch(() => {});
        const controls = await page.evaluate(() => {
            const want = /^(follow|following|unfollow|message|connect|more)$/i;
            const nameNeedle = (window as any).__QNAME__ ? String((window as any).__QNAME__).toLowerCase() : '';
            const out: any[] = [];
            for (const b of Array.from(document.querySelectorAll('button, a[role="button"]'))) {
                const text = (b.textContent || '').trim();
                const aria = b.getAttribute('aria-label') || '';
                const mentionsLead = nameNeedle
                    && (text.toLowerCase().includes(nameNeedle) || aria.toLowerCase().includes(nameNeedle));
                if (!want.test(text) && !/^(follow|message|connect|more)/i.test(aria) && !mentionsLead) continue;
                const chain: string[] = [];
                let n: any = b;
                for (let i = 0; i < 8 && n; i++) {
                    n = n.parentElement;
                    if (!n) break;
                    const data = Array.from(n.attributes || [])
                        .filter((a: any) => a.name.startsWith('data-') || a.name === 'role')
                        .map((a: any) => `${a.name}=${String(a.value).slice(0, 34)}`)
                        .join(' ');
                    chain.push(`${n.tagName.toLowerCase()}${data ? '{' + data + '}' : ''}`);
                }
                out.push({ text: text.slice(0, 24), aria: aria.slice(0, 40), chain: chain.join(' < ') });
                if (out.length >= 16) break;
            }
            return out;
        });
        console.log('\n--- candidate controls and where they live');
        for (const c of controls as any[]) {
            console.log(`  text="${c.text}" aria="${c.aria}"`);
            console.log(`      ${c.chain}`);
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
