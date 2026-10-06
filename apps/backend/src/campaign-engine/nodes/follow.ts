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

/**
 * FOLLOW node — follows the lead on LinkedIn without sending a connect
 * request. Used by templates like soft-follow-audience and abm-scout to
 * build a passive touchpoint that LinkedIn surfaces in the lead's
 * "Notifications" tab but doesn't gate behind acceptance.
 *
 * Button surfaces in three places depending on the lead's degree + the
 * primary action LinkedIn chose to render:
 *   1. Primary "Follow" button (rare — only when LinkedIn elected to put
 *      Follow as the headline CTA, e.g. creator accounts).
 *   2. Secondary "Follow" button (most common for 2nd/3rd-degree).
 *   3. "Follow" item inside the "More" dropdown (when Connect/Message
 *      took the primary slot).
 *
 * Skip semantics (success, no follow):
 *   - already_following → "Following" / "Unfollow" surfaces in primary
 *     or in the More menu.
 */
export const follow: NodeHandler = async (ctx): Promise<NodeResult> => {
    const { page, lead } = ctx;

    try {
        console.log(`[FOLLOW] Navigating to profile: ${lead.linkedinUrl}`);
        await safeGoto(page, lead.linkedinUrl);
        await wait(randomRange(8000, 12000));

        const url = page.url();
        if (url.includes('authwall') || url.includes('login') || url.includes('checkpoint')) {
            return { success: false, error: `Session invalid. Redirected to: ${url}` };
        }

        // Already following? LinkedIn flips the button to "Following".
        const followingIndicator = page.locator(
            'button[aria-label^="Stop following"], ' +
            'button[aria-label^="Unfollow"], ' +
            'button:has(span:text-is("Following"))'
        ).first();
        if (await followingIndicator.isVisible({ timeout: 2000 }).catch(() => false)) {
            console.log('[FOLLOW] Already following — skipping.');
            return { success: true, output: { followed: false, alreadyFollowing: true } };
        }

        // Try the direct Follow button first (primary or secondary slot).
        let followBtn = page.locator(
            'button[aria-label^="Follow"]:not([aria-label*="Following"]):not([aria-label*="hashtag"]), ' +
            'button:has(span:text-is("Follow"))'
        ).first();

        if (!(await followBtn.isVisible({ timeout: 5000 }).catch(() => false))) {
            // Fall back to the More menu.
            console.log('[FOLLOW] No primary Follow button — trying More menu.');
            const moreBtn = page.locator(
                'button:has(span:text-is("More")), button[aria-label^="More"]'
            ).first();
            if (await moreBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
                await moreBtn.evaluate((el: any) => el.click());
                await wait(randomRange(1500, 2500));
                followBtn = page.locator(
                    '[role="menuitem"]:has-text("Follow"), ' +
                    '.artdeco-dropdown__item:has-text("Follow")'
                ).first();
            }
        }

        if (!(await followBtn.isVisible({ timeout: 5000 }).catch(() => false))) {
            return { success: false, error: 'Follow button not found on profile' };
        }

        // A REAL click, not el.click() dispatched through evaluate.
        //
        // An evaluate-dispatched click is untrusted, and LinkedIn's handlers
        // are documented elsewhere in this engine as ignoring those in favour
        // of a trusted one. An ordinary Playwright click also enforces
        // actionability, so a control that is covered or disabled reports that
        // instead of silently absorbing the click.
        await followBtn.scrollIntoViewIfNeeded().catch(() => {});
        let forced = false;
        await followBtn.click({ timeout: 6000 }).catch(async (e: any) => {
            console.log(`[FOLLOW] Click refused (${(e?.message || '').split('\n')[0]}) — retrying forced.`);
            forced = true;
            await followBtn.click({ force: true }).catch(() => {});
        });
        await wait(randomRange(2000, 3500));

        // Verify — LinkedIn swaps the button to "Following". Polled, because a
        // single look right after the click reported "never appeared" for
        // actions that had simply not repainted yet.
        const followingNow = async (): Promise<boolean> => page.locator(
            'button[aria-label^="Stop following"], button[aria-label^="Unfollow"], button:has(span:text-is("Following"))'
        ).first().isVisible({ timeout: 2500 }).catch(() => false);

        let confirmed = false;
        for (let attempt = 0; attempt < 4 && !confirmed; attempt++) {
            confirmed = await followingNow();
            if (!confirmed) await wait(1500);
        }

        if (!confirmed) {
            // An unverified follow is a FAILURE, not a confident "followed".
            //
            // This used to return success:true, followed:true regardless — the
            // comment here even named the pattern that let unsent comments and
            // invites report success, and then repeated it. So the node's 29/0
            // record counted clicks, not follows, and some of those 29 may
            // never have registered.
            //
            // Safe to fail: the already-following check above runs first, so a
            // later retry skips rather than following twice.
            console.log(`[FOLLOW] Clicked but the Following indicator never appeared (forced=${forced}) — reporting failure.`);
            return { success: false, error: `Follow did not register (forced=${forced})` };
        }

        console.log('[FOLLOW] Following (verified).');
        return { success: true, output: { followed: true, verified: true, alreadyFollowing: false } };
    } catch (err: any) {
        return { success: false, error: err.message };
    }
};
