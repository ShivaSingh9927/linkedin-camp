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

        await followBtn.evaluate((el: any) => el.click());
        console.log('[FOLLOW] Follow button clicked.');
        await wait(randomRange(2000, 3500));

        // Verify — LinkedIn swaps the button text to "Following".
        const confirmed = await page.locator(
            'button[aria-label^="Stop following"], button:has(span:text-is("Following"))'
        ).first().isVisible({ timeout: 4000 }).catch(() => false);

        if (!confirmed) {
            // Don't fail hard — LinkedIn sometimes lazy-renders the swap.
            // Click registered; downstream nodes shouldn't block on this.
            console.log('[FOLLOW] Click registered but Following indicator not yet visible.');
        }

        return { success: true, output: { followed: true, alreadyFollowing: false } };
    } catch (err: any) {
        return { success: false, error: err.message };
    }
};
