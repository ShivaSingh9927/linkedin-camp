import { prisma } from '@repo/db';
import { launchAuthenticatedContext } from '../campaign-engine/session-launch';
import { scrapeOwnProfile, scrapeRecentPosts } from '../campaign-engine/scrape/profile-scrape';
import { generateSelfProfileSummary } from '../campaign-engine/ai-service';

export interface EnrichmentResult {
    status: 'done' | 'skipped' | 'failed';
    reason?: string;
}

/**
 * One-time self-profile enrichment. Visits the user's OWN LinkedIn profile and
 * recent posts (the safest possible LinkedIn action — own profile, own posts,
 * zero outbound), summarizes them with the AI, and writes the result back to
 * BusinessProfile so the strategy + every generated message reflect the user's
 * real voice.
 *
 * Caller (the enrichment worker) MUST hold the per-account lock so this never
 * runs concurrently with a campaign on the same LinkedIn account. Launches via
 * the shared launcher so the sticky-proxy/session invariant is honored.
 *
 * Auto-applies scraped voice into communicationStyle / writingSamples /
 * tonePreferences, but only when those are empty — never clobbers values the
 * user typed themselves.
 */
export async function runSelfProfileEnrichment(userId: string): Promise<EnrichmentResult> {
    // The relation field is `BusinessProfile` (capital) — matches both local
    // tsc and the generated Prisma client running in prod. (Lowercase usages
    // elsewhere in the codebase are latent bugs, not a working convention.)
    const user = await prisma.user.findUnique({
        where: { id: userId },
        include: { BusinessProfile: true },
    });

    if (!user) return { status: 'skipped', reason: 'no-user' };

    // Once-only: bail if we've already enriched this user.
    if (user.BusinessProfile?.selfProfileEnrichedAt) {
        return { status: 'skipped', reason: 'already-enriched' };
    }

    // Use the user's stored profile URL if we have one; otherwise rely on
    // LinkedIn's /in/me/ alias, which redirects to the logged-in user's own
    // profile. This means enrichment works even before the user has typed
    // their LinkedIn URL into onboarding.
    const profileUrl = user.linkedinUrl || 'https://www.linkedin.com/in/me/';

    // Don't drive an unhealthy account (OTP / restricted / expired).
    if ((user as any).accountHealth && (user as any).accountHealth !== 'HEALTHY') {
        return { status: 'skipped', reason: `account-${String((user as any).accountHealth).toLowerCase()}` };
    }

    const launch = await launchAuthenticatedContext(userId);
    if (!launch.ok) {
        console.error(`[SELF-ENRICH] user=${userId} launch failed: ${launch.failedAt}`);
        return { status: 'failed', reason: launch.failedAt };
    }

    const { browser, context, page } = launch;
    try {
        console.log(`[SELF-ENRICH] user=${userId} scraping own profile: ${profileUrl}`);
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

        console.log(`[SELF-ENRICH] user=${userId} ✅ enriched (posts=${postContents.length}, summary=${ai.summary ? 'yes' : 'no'})`);
        return { status: 'done' };
    } catch (e: any) {
        console.error(`[SELF-ENRICH] user=${userId} failed: ${e?.message}`);
        return { status: 'failed', reason: e?.message };
    } finally {
        await context.close().catch(() => {});
        await browser.close().catch(() => {});
    }
}
