import { NodeHandler, NodeResult, PostOutput } from '../types';
import { persistDiscoveredPost } from '../storage';
import { getOrDiscoverNthPost } from './post-discovery';
import { actionShot } from './action-shot';

const wait = (ms: number) => new Promise(res => setTimeout(res, ms));

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

export const likeNthPost: NodeHandler = async (ctx, config): Promise<NodeResult> => {
    const { page, lead, storedOutputs, userId } = ctx;
    const n = config.n || 1;

    const output: PostOutput = { postUrl: null, postContent: null, liked: false };

    try {
        console.log(`[LIKE-NTH-POST] Navigating to posts feed (target: post #${n})...`);

        const { post: discovered, emptyFeed } = await getOrDiscoverNthPost(storedOutputs, page, lead.linkedinUrl, n, 'LIKE-NTH-POST');
        if (!discovered) {
            // Empty/insufficient feed is deterministic — the profile has no
            // recent post to like, and a retry will find the same. Retire the
            // lead rather than re-scraping it up to 3x.
            if (emptyFeed) {
                return { success: false, terminal: true, terminalReason: 'no_recent_post', error: 'No recent post found' };
            }
            return { success: false, error: `Post #${n} not found` };
        }

        const postLink = discovered.url;
        output.postUrl = postLink;
        console.log(`[LIKE-NTH-POST] Found post #${n}. Navigating...`);

        await safeGoto(page, postLink);

        // CONFIRM we are actually on the post before touching any button.
        //
        // LinkedIn is a SPA: domcontentloaded fires while the previous view is
        // still mounted, so a fixed wait can leave us looking at the HOME FEED.
        // Screenshots on 2026-09-15 caught exactly that — the "like" ran against
        // rajaji's feed, matched the first Like button on a stranger's post, and
        // reported a failure that looked like an account write-block. Worse than
        // failing: that click was aimed at someone who was never a target.
        const activityId = (discovered.urn.match(/(\d{6,})/) || [])[1] || '';
        let onPost = false;
        for (let attempt = 0; attempt < 6 && !onPost; attempt++) {
            await wait(1500);
            const url = page.url();
            onPost = url.includes('/feed/update/') && (!activityId || url.includes(activityId));
        }
        if (!onPost) {
            console.log(`[LIKE-NTH-POST] Never landed on the post (url=${page.url().slice(0, 90)}) — refusing to click.`);
            return { success: false, error: 'Post page did not load — refused to like the wrong post' };
        }
        await wait(2000);

        // Extract post content
        try {
            const moreBtn = page.locator('button[data-testid="expandable-text-button"]').first();
            if (await moreBtn.isVisible({ timeout: 3000 })) {
                await moreBtn.click({ force: true });
                await wait(1000);
            }
            output.postContent = await page.$eval('.update-components-text, [data-testid="expandable-text-box"]', (el: any) => el.innerText).catch(() => null);
        } catch {}

        // Cache the post on the Lead row — profile-visit skips its own duplicate
        // activity-feed scrape when this node is present, so this keeps the UI's
        // "Recent post" panel populated. Fire-and-forget.
        persistDiscoveredPost(lead.id, output.postUrl, output.postContent).catch(() => {});

        // Resolve the Like control STRUCTURALLY, for the same reason as the
        // comment submit: LinkedIn serves two frontend builds and one of them
        // uses obfuscated hashed class names, so class-based selectors match
        // nothing there. Accounts are pinned to a variant — which is why this
        // node worked on shivasingh9927 and never on rajaji.
        //
        // [data-urn] is NOT present on the post permalink page (only on the
        // activity feed we discovered from), so scope instead to the FIRST post
        // container on the page — the focused post — and take its Like control.
        // The button may be labelled by text or only by aria-label, so accept
        // either, and tag the match so Playwright performs the real click.
        const LIKE_MARK = 'data-qampi-like';
        const likeLocated = await page.evaluate((mark: string) => {
            document.querySelectorAll(`[${mark}]`).forEach((e) => e.removeAttribute(mark));
            const isLike = (b: any) => {
                const t = (b.textContent || '').trim().toLowerCase();
                const a = (b.getAttribute('aria-label') || '').trim().toLowerCase();
                return t === 'like' || a === 'like' || a.startsWith('react like');
            };
            // Prefer a button inside the first post container; fall back to the
            // first Like on the page only if no container is recognisable.
            const container = document.querySelector(
                'div.feed-shared-update-v2, article, div[class*="feed-shared-update"], main',
            );
            const scopes = [container, document].filter(Boolean) as any[];
            for (const scope of scopes) {
                const btn = Array.from(scope.querySelectorAll('button')).find(isLike);
                if (btn) {
                    (btn as any).setAttribute(mark, '1');
                    return (btn as any).getAttribute('aria-pressed') === 'true' ? 'already' : 'found';
                }
            }
            return 'none';
        }, LIKE_MARK).catch(() => 'error');

        if (likeLocated === 'none' || likeLocated === 'error') {
            console.log(`[LIKE-NTH-POST] No Like control found on the post (${likeLocated}).`);
            return { success: false, error: 'Like button not found on post' };
        }

        const likeBtn = page.locator(`[${LIKE_MARK}="1"]`).first();
        const btnVisible = await likeBtn.isVisible({ timeout: 5000 }).catch(() => false);

        // Truthful reporting: if the Like button isn't on the page we did NOT
        // like anything, so return failure. Previously this fell through to
        // `return { success: true }`, so a missing button was logged as a
        // successful like — which is why an account could show "17 likes" for
        // posts where nothing was actually clicked. The engine keys ActionLog
        // SUCCESS/FAILED on this return value, so honesty here is what makes the
        // like metric mean what it says.
        if (!btnVisible) {
            return { success: false, error: 'Like button not found on post' };
        }

        const isPressed = await likeBtn.getAttribute('aria-pressed');
        if (isPressed === 'true') {
            output.liked = true;
            console.log('[LIKE-NTH-POST] Already liked.');
        } else {
            await actionShot(page, userId, `like_before_${lead.id}`);
            await likeBtn.evaluate((el: any) => el.click());
            await wait(2000);
            await actionShot(page, userId, `like_after_${lead.id}`);
            // Re-read on a FRESH locator — the post-click DOM swap can leave the
            // old handle stale and report the pre-click state.
            const nowPressed = await page
                .locator('button:has(span:text-is("Like")), button:has(span:text-is("Liked"))')
                .first()
                .getAttribute('aria-pressed')
                .catch(() => null);
            // Unverified means it did NOT happen. I previously kept this as a
            // success on the theory that LinkedIn might not always expose
            // aria-pressed — the A/B killed that theory: on a healthy account
            // (shivasingh9927) the attribute flipped on 3 of 3 likes, while on a
            // write-blocked one (rajaji) it flipped on 0 of 2 and the user
            // confirmed no like existed on either post. So the attribute is
            // reliable, and "couldn't confirm" is the signature of a like that
            // never registered — not of a missing attribute.
            if (nowPressed !== 'true') {
                console.log('[LIKE-NTH-POST] Like clicked but never registered — reporting failure.');
                return { success: false, error: 'Like did not register' };
            }
            output.liked = true;
            (output as any).verified = true;
            console.log('[LIKE-NTH-POST] Liked (verified).');
        }

        return { success: true, output };

    } catch (err: any) {
        return { success: false, error: err.message };
    }
};
