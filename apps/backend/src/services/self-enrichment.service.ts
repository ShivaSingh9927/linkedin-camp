import { prisma } from '@repo/db';
import { launchAuthenticatedContext } from '../campaign-engine/session-launch';
import { scrapeOwnProfile, scrapeRecentPosts } from '../campaign-engine/scrape/profile-scrape';
import { generateSelfProfileSummary } from '../campaign-engine/ai-service';
import {
    getMe,
    getProfileByFsd,
    warmSelfCache,
    captureVoyagerHeaders,
} from './voyager-api.service';

export interface EnrichmentResult {
    status: 'done' | 'skipped' | 'failed';
    reason?: string;
}

/**
 * Push a "I just studied your LinkedIn profile" signal to the user's browser so
 * the dashboard can reveal what the AI learned the moment enrichment finishes —
 * rather than the summary silently appearing on the next page load. Best-effort.
 */
async function emitSelfEnriched(userId: string, ai: { summary?: string; communicationStyle?: string; tonePreferences?: string[] }) {
    if (!ai?.summary) return;
    try {
        const { io } = await import('../socket');
        io.to(`user_${userId}`).emit('SELF_PROFILE_ENRICHED', {
            summary: ai.summary,
            communicationStyle: ai.communicationStyle || '',
            tonePreferences: ai.tonePreferences || [],
        });
    } catch (e: any) {
        console.warn(`[SELF-ENRICH] emit failed (ignored): ${e?.message}`);
    }
}

export interface EnrichmentOptions {
    /**
     * 'api' (default): Use Voyager API for profile data (~300ms, no browser).
     * 'dom': Legacy DOM scraping path (~20s, launches browser).
     *
     * When 'api' is selected and the Voyager call fails, the system
     * automatically falls back to 'dom' mode.
     */
    mode?: 'api' | 'dom';
}

// ─── API Mode ────────────────────────────────────────────────────────────────

/**
 * Self-enrichment via Voyager API. No browser needed — calls LinkedIn's
 * internal REST/GraphQL endpoints through the authenticated Playwright
 * context to get the user's own profile data in ~300ms.
 *
 * Returns richer data than the DOM scraper: industry, geo, premium status,
 * pronouns, vanity, memberId, profile picture URL — all fields the DOM
 * scraper can't extract without additional page navigations.
 *
 * Trade-off: does NOT return recent posts (those require DOM navigation to
 * /recent-activity/shares/). The AI infers voice from headline + about text
 * instead. If posts are critical, use mode='dom'.
 */
async function enrichViaApi(userId: string, user: any): Promise<EnrichmentResult | null> {
    // null return = fall back to DOM mode
    try {
        console.log(`[SELF-ENRICH] user=${userId} mode=api — fetching via Voyager...`);

        // The voyager-api.service needs a live Playwright page to ride the
        // session (csrf + page-instance). We launch a minimal browser just
        // for the API calls — much lighter than a full DOM scrape since we
        // don't navigate to the profile page or scroll.
        const launch = await launchAuthenticatedContext(userId);
        if (!launch.ok) {
            console.warn(`[SELF-ENRICH] user=${userId} API launch failed (${(launch as any).failedAt || 'unknown'}) — falling back to DOM`);
            return null; // triggers DOM fallback
        }

        const { browser, context, page } = launch;
        try {
            // Navigate to /feed/ to trigger a real voyager call (captures csrf + page-instance)
            await page.goto('https://www.linkedin.com/feed/', { waitUntil: 'domcontentloaded', timeout: 60000 });
            await page.waitForTimeout(5000);
            await captureVoyagerHeaders(page, userId, 5000);

            // Step 1: Get self data (plainId, vanity, fsdUrn)
            const meR = await getMe(userId, page);
            if (!meR.ok) {
                console.warn(`[SELF-ENRICH] user=${userId} /me failed: ${(meR as any).error} — falling back to DOM`);
                return null;
            }
            const selfData = meR.data;
            const fsdUrn = selfData.miniProfile.dashEntityUrn;
            if (!fsdUrn) {
                console.warn(`[SELF-ENRICH] user=${userId} no dashEntityUrn — falling back to DOM`);
                return null;
            }

            // Backfill user's linkedinUrl if we learned it via /me
            const vanity = selfData.miniProfile.publicIdentifier;
            if (vanity && !user.linkedinUrl) {
                const resolvedUrl = `https://www.linkedin.com/in/${vanity}/`;
                await prisma.user
                    .update({ where: { id: userId }, data: { linkedinUrl: resolvedUrl } })
                    .catch(() => {});
                console.log(`[SELF-ENRICH] user=${userId} backfilled linkedinUrl: ${resolvedUrl}`);
            }

            // Step 2: Get full profile via FullProfile-76 decoration
            const profileR = await getProfileByFsd(userId, fsdUrn, page);
            if (!profileR.ok) {
                console.warn(`[SELF-ENRICH] user=${userId} FullProfile failed: ${(profileR as any).error} — falling back to DOM`);
                return null;
            }
            const p = profileR.data;

            // Step 3: Build enriched AI input
            const fullName = [p.firstName, p.lastName].filter(Boolean).join(' ').trim() || null;
            const postContents: string[] = []; // API doesn't return posts

            let ai = { summary: '', communicationStyle: '', tonePreferences: [] as string[] };
            try {
                ai = await generateSelfProfileSummary({
                    name: fullName,
                    headline: p.headline,
                    about: p.summary,
                    company: null, // FullProfile doesn't return company separately; parsed from headline by AI
                    jobTitle: null, // same
                    location: p.location || null,
                    posts: postContents,
                    // Voyager extended fields — the whole point of API mode
                    industry: p.industry || null,
                    geoLocation: p.location || null,
                    premium: p.premium ?? null,
                    pronouns: p.pronouns || null,
                    vanity: p.vanity || null,
                    memberId: p.memberId || null,
                    profilePictureUrl: p.photoUrl || null,
                });
            } catch (e: any) {
                console.warn(`[SELF-ENRICH] user=${userId} AI summary failed (non-fatal): ${e?.message}`);
            }

            // Step 4: Write to BusinessProfile
            const existing = user.BusinessProfile;
            const isEmptyStr = (v: any) => !v || (typeof v === 'string' && v.trim() === '');
            const isEmptyArr = (v: any) => !Array.isArray(v) || v.length === 0;

            const fields = {
                // Core fields (same as DOM mode)
                selfHeadline: p.headline,
                selfAbout: p.summary,
                selfRecentPosts: [] as any, // no posts in API mode
                selfProfileSummary: ai.summary || null,
                selfProfileEnrichedAt: new Date(),
                // Voyager-only extended fields (new)
                selfIndustry: p.industry || null,
                selfGeoLocation: p.location || null,
                selfPremium: p.premium ?? null,
                selfPronouns: p.pronouns || null,
                selfVanity: p.vanity || null,
                selfMemberId: p.memberId || null,
                selfProfilePictureUrl: p.photoUrl || null,
                // Auto-applied voice — only when not already set by the user.
                ...(ai.communicationStyle && isEmptyStr(existing?.communicationStyle)
                    ? { communicationStyle: ai.communicationStyle }
                    : {}),
                ...(ai.tonePreferences.length && isEmptyArr(existing?.tonePreferences)
                    ? { tonePreferences: ai.tonePreferences }
                    : {}),
                // Light profile fills (only if empty).
                ...(p.headline && isEmptyStr(existing?.persona) ? { persona: p.headline } : {}),
            };

            await prisma.businessProfile.upsert({
                where: { userId },
                update: fields,
                create: { userId, ...fields },
            });

            console.log(`[SELF-ENRICH] user=${userId} ✅ enriched via API (industry=${p.industry}, geo=${p.location}, premium=${p.premium}, summary=${ai.summary ? 'yes' : 'no'})`);
            await emitSelfEnriched(userId, ai);
            return { status: 'done' };
        } finally {
            await context.close().catch(() => {});
            await browser.close().catch(() => {});
        }
    } catch (e: any) {
        console.warn(`[SELF-ENRICH] user=${userId} API mode failed: ${e?.message} — falling back to DOM`);
        return null;
    }
}

// ─── DOM Mode (Legacy) ───────────────────────────────────────────────────────

/**
 * Self-enrichment via DOM scraping. Launches a full browser, navigates to the
 * user's profile, scrolls, extracts fields from the rendered page, then
 * scrapes recent posts. Slower (~20s) but gets posts for voice inference.
 *
 * This is the original enrichment path — kept intact as fallback when Voyager
 * API is unavailable or when mode='dom' is explicitly requested.
 */
async function enrichViaDom(userId: string, user: any): Promise<EnrichmentResult> {
    const profileUrl = user.linkedinUrl || 'https://www.linkedin.com/in/me/';

        const launch = await launchAuthenticatedContext(userId);
        if (!launch.ok) {
            console.error(`[SELF-ENRICH] user=${userId} DOM launch failed: ${(launch as any).failedAt || 'unknown'}`);
            return { status: 'failed', reason: (launch as any).failedAt || 'launch-failed' };
        }

    const { browser, context, page } = launch;
    try {
        console.log(`[SELF-ENRICH] user=${userId} mode=dom — scraping own profile: ${profileUrl}`);
        const profile = await scrapeOwnProfile(page, profileUrl);

        // Resolve the canonical URL after any /in/me/ redirect so the posts
        // feed (and any stored linkedinUrl) point at the real profile.
        const resolvedUrl = page.url().split('?')[0];

        // Backfill the user's linkedinUrl if we just learned it via /in/me/.
        if (!user.linkedinUrl && /\/in\//.test(resolvedUrl) && !/\/in\/me\/?$/.test(resolvedUrl)) {
            await prisma.user
                .update({ where: { id: userId }, data: { linkedinUrl: resolvedUrl } })
                .catch(() => {});
        }

        let posts: { url: string | null; content: string; postedAgo: string | null }[] = [];
        try {
            posts = await scrapeRecentPosts(page, resolvedUrl, 3);
            console.log(`[SELF-ENRICH] user=${userId} scraped ${posts.length} recent posts`);
        } catch (e: any) {
            console.warn(`[SELF-ENRICH] user=${userId} post scrape failed (non-fatal): ${e?.message}`);
        }

        const postContents = posts.map((p) => p.content).filter(Boolean);

        let ai = { summary: '', communicationStyle: '', tonePreferences: [] as string[] };
        try {
            ai = await generateSelfProfileSummary({
                name: profile.name,
                headline: profile.headline,
                about: profile.about,
                company: profile.company,
                jobTitle: profile.jobTitle,
                location: profile.location,
                posts: postContents,
            });
        } catch (e: any) {
            console.warn(`[SELF-ENRICH] user=${userId} AI summary failed (non-fatal): ${e?.message}`);
        }

        const existing = user.BusinessProfile;
        const writingSamples = posts
            .slice(0, 3)
            .filter((p) => p.content)
            .map((p, i) => ({ label: `LinkedIn post ${i + 1}`, text: p.content }));

        // Fill-if-empty so we never overwrite anything the user typed.
        const isEmptyStr = (v: any) => !v || (typeof v === 'string' && v.trim() === '');
        const isEmptyArr = (v: any) => !Array.isArray(v) || v.length === 0;
        const existingSamples = existing?.writingSamples as any;

        const fields = {
            // Always-set self* fields (raw enrichment data).
            selfHeadline: profile.headline,
            selfAbout: profile.about,
            selfRecentPosts: posts as any,
            selfProfileSummary: ai.summary || null,
            selfProfileEnrichedAt: new Date(),
            // Auto-applied voice — only when not already set by the user.
            ...(ai.communicationStyle && isEmptyStr(existing?.communicationStyle)
                ? { communicationStyle: ai.communicationStyle }
                : {}),
            ...(writingSamples.length && isEmptyArr(existingSamples) ? { writingSamples: writingSamples as any } : {}),
            ...(ai.tonePreferences.length && isEmptyArr(existing?.tonePreferences)
                ? { tonePreferences: ai.tonePreferences }
                : {}),
            // Light profile fills (only if empty).
            ...(profile.jobTitle && isEmptyStr(existing?.persona) ? { persona: profile.jobTitle } : {}),
            ...(profile.company && isEmptyStr(existing?.company) ? { company: profile.company } : {}),
        };

        await prisma.businessProfile.upsert({
            where: { userId },
            update: fields,
            create: { userId, ...fields },
        });

        console.log(`[SELF-ENRICH] user=${userId} ✅ enriched via DOM (posts=${postContents.length}, summary=${ai.summary ? 'yes' : 'no'})`);
        await emitSelfEnriched(userId, ai);
        return { status: 'done' };
    } catch (e: any) {
        console.error(`[SELF-ENRICH] user=${userId} DOM failed: ${e?.message}`);
        return { status: 'failed', reason: e?.message };
    } finally {
        await context.close().catch(() => {});
        await browser.close().catch(() => {});
    }
}

// ─── Entry Point ─────────────────────────────────────────────────────────────

/**
 * One-time self-profile enrichment. Visits the user's OWN LinkedIn profile,
 * summarizes it with the AI, and writes the result back to BusinessProfile
 * so the strategy + every generated message reflect the user's real voice.
 *
 * Default mode is 'api' (Voyager API, ~300ms, no browser). If the API call
 * fails, automatically falls back to 'dom' (full browser scrape, ~20s).
 * Pass { mode: 'dom' } to skip the API path entirely.
 *
 * Caller (the enrichment worker) MUST hold the per-account lock so this never
 * runs concurrently with a campaign on the same LinkedIn account.
 *
 * Auto-applies scraped voice into communicationStyle / writingSamples /
 * tonePreferences, but only when those are empty — never clobbers values the
 * user typed themselves.
 */
export async function runSelfProfileEnrichment(
    userId: string,
    options: EnrichmentOptions = {}
): Promise<EnrichmentResult> {
    const mode = options.mode || 'api';

    const user = await prisma.user.findUnique({
        where: { id: userId },
        include: { BusinessProfile: true },
    });

    if (!user) return { status: 'skipped', reason: 'no-user' };

    // Once-only: bail if we've already enriched this user.
    if (user.BusinessProfile?.selfProfileEnrichedAt) {
        return { status: 'skipped', reason: 'already-enriched' };
    }

    // Don't drive an unhealthy account (OTP / restricted / expired).
    if ((user as any).accountHealth && (user as any).accountHealth !== 'HEALTHY') {
        return { status: 'skipped', reason: `account-${String((user as any).accountHealth).toLowerCase()}` };
    }

    if (mode === 'api') {
        const apiResult = await enrichViaApi(userId, user);
        if (apiResult) return apiResult;
        // API failed — fall through to DOM mode
        console.log(`[SELF-ENRICH] user=${userId} API mode failed, falling back to DOM...`);
    }

    return enrichViaDom(userId, user);
}
