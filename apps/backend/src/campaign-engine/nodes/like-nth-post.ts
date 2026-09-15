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

        // Read the control's own LABEL, not aria-pressed alone.
        //
        // aria-pressed is absent on the obfuscated-class build, so it reads null
        // whether or not the post is already liked. The node therefore never took
        // the "already liked" branch, clicked anyway, and TOGGLED AN EXISTING LIKE
        // OFF: the reaction count on Vignesh's post went 1,046 → 1,045 between two
        // runs. The clicks were landing the whole time — this was a state-reading
        // bug reported as a click failure, and it was quietly un-liking posts.
        const readState = async (): Promise<string> => {
            const t = ((await likeBtn.textContent().catch(() => '')) || '').trim().toLowerCase();
            const a = ((await likeBtn.getAttribute('aria-label').catch(() => '')) || '').trim().toLowerCase();
            const pressed = await likeBtn.getAttribute('aria-pressed').catch(() => null);
            return `${t}|${a}|${pressed ?? ''}`;
        };
        const looksLiked = (state: string) => state.includes('|true') || /unreact|unlike|liked/.test(state);

        const before = await readState();
        if (looksLiked(before)) {
            output.liked = true;
            (output as any).verified = true;
            console.log(`[LIKE-NTH-POST] Already liked (state="${before}") — leaving it alone.`);
            return { success: true, output };
        }

        await likeBtn.scrollIntoViewIfNeeded().catch(() => {});
        await likeBtn.click({ force: true });
        await wait(2500);

        const after = await readState();
        output.liked = true;
        (output as any).verified = after !== before;
        if (after === before) {
            console.log(`[LIKE-NTH-POST] Clicked but state never changed (state="${after}") — reporting failure.`);
            return { success: false, error: 'Like did not register' };
        }
        console.log(`[LIKE-NTH-POST] Liked (verified: "${before}" → "${after}").`);

        return { success: true, output };

    } catch (err: any) {
        return { success: false, error: err.message };
    }
};
