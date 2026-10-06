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

        // Match the control by the LEAD'S OWN NAME, from its aria-label.
        //
        // Every previous selector searched the whole page for the word
        // "Follow", so on a profile that embeds someone else's post it could
        // match THAT author's Follow button — and on a profile with a video it
        // matched the player's controls and opened the player's menu looking
        // for a follow item (probed 2026-10-06: the only "More" controls were
        // inside div[role="toolbar"], and the menu offered subtitle settings).
        // So a "Following (verified)" could not be attributed to anyone in
        // particular.
        //
        // LinkedIn labels these controls with the person: "Follow Sachin
        // Raghav", "Unfollow <name>". The name is the one anchor that is both
        // build-agnostic — the obfuscated build has none of the top-card
        // classes, all of which probed as absent — and target-specific.
        const fullName = `${lead.firstName || ''} ${lead.lastName || ''}`.trim();
        if (!fullName) {
            return { success: false, error: 'Lead has no name to match the Follow control against' };
        }
        const esc = fullName.replace(/"/g, '\\"');

        // Already following? The control inverts to Unfollow / Stop following
        // FOR THIS PERSON.
        const followingIndicator = page.locator(
            `button[aria-label="Unfollow ${esc}"], button[aria-label="Stop following ${esc}"], `
            + `[role="menuitem"][aria-label="Unfollow ${esc}"]`
        ).first();
        if (await followingIndicator.isVisible({ timeout: 2500 }).catch(() => false)) {
            console.log(`[FOLLOW] Already following ${fullName} — leaving it alone.`);
            return { success: true, output: { followed: false, alreadyFollowing: true } };
        }

        // The Follow control for THIS lead.
        const followBtn = page.locator(
            `button[aria-label="Follow ${esc}"], a[role="button"][aria-label="Follow ${esc}"]`
        ).first();

        if (!(await followBtn.isVisible({ timeout: 5000 }).catch(() => false))) {
            // No Follow control is NOT a failure — there is simply no follow
            // action to take. Either we already follow them (this build
            // renders no "Unfollow <name>" for the check above to find), or
            // LinkedIn offers none at all, which is the normal case for a
            // 1st-degree connection since connections are followed
            // automatically. Reporting FAILED here marked a correct no-op as
            // a broken node on every second pass.
            //
            // Guard against calling a blank page a skip: a profile that
            // rendered has controls on it.
            const rendered = await page.locator('main button').count().catch(() => 0);
            if (!rendered) {
                return { success: false, error: `Profile did not render any controls for ${fullName}` };
            }
            console.log(`[FOLLOW] No Follow control for ${fullName} — nothing to do (already following, or LinkedIn offers none).`);
            return { success: true, output: { followed: false, alreadyFollowing: true, skipReason: 'no_follow_control' } };
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

        // Verify against THIS lead's control, for the same reason the lookup
        // is name-scoped: a page-wide "Following" could belong to anyone.
        // Polled, because a single look right after the click reported
        // "never appeared" for actions that had simply not repainted yet.
        const followingNow = async (): Promise<boolean> => page.locator(
            `button[aria-label="Unfollow ${esc}"], button[aria-label="Stop following ${esc}"]`
        ).first().isVisible({ timeout: 2500 }).catch(() => false);

        // The Follow control for this lead should no longer be offered.
        //
        // Positive confirmation would be an "Unfollow <name>" control, and on
        // the semantic build that is what appears. This build renders neither
        // that nor a "Following" label anywhere we can find: probed on
        // 2026-10-06 after a real follow, "Follow Sachin Raghav" had simply
        // vanished and nothing named him replaced it. So accept EITHER signal
        // — the inverse control appearing, or the Follow control for THIS
        // PERSON disappearing. Both are state changes tied to the right
        // target, which is what the old page-wide "something says Following"
        // check never was.
        const followOfferStillThere = async (): Promise<boolean> =>
            page.locator(`button[aria-label="Follow ${esc}"], a[role="button"][aria-label="Follow ${esc}"]`)
                .first().isVisible({ timeout: 2000 }).catch(() => false);

        let confirmed = false;
        let how = '';
        for (let attempt = 0; attempt < 4 && !confirmed; attempt++) {
            if (await followingNow()) { confirmed = true; how = 'Unfollow control appeared'; break; }
            if (!(await followOfferStillThere())) { confirmed = true; how = 'Follow control no longer offered'; break; }
            await wait(1500);
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
            return { success: false, error: `Follow did not register for ${fullName} — the Follow control is still being offered (forced=${forced})` };
        }

        console.log(`[FOLLOW] Following ${fullName} (verified: ${how}).`);
        return { success: true, output: { followed: true, verified: true, alreadyFollowing: false } };
    } catch (err: any) {
        return { success: false, error: err.message };
    }
};
