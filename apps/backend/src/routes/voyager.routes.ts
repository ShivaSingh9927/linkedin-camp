/**
 * voyager.routes.ts
 *
 * Thin REST wrapper around voyager-api.service.ts so the Chrome extension
 * (or any other client with a valid user JWT) can hit LinkedIn's internal
 * API through our backend instead of from the extension's background script.
 *
 * Use cases:
 *   1. Extension captures a search results page → extension POSTs the
 *      captured vanities here → we fan out to LinkedIn's FullProfile API
 *      and return a single enriched JSON blob. ~5x faster than letting the
 *      extension do the DOM scrape per profile.
 *   2. Bulk enrichment of the 719-row CSV: extension imports the CSV, posts
 *      the vanities here, and the backend returns the enriched rows in a
 *      single round trip. Lets us reuse the proxy + fingerprint the worker
 *      already has, so the rate-limit budget is shared across all requests.
 *
 * The endpoint deliberately does NOT expose write operations (no
 * createMessage, no invitations, no reactions). Those are gated by
 * `mailboxPreWriteValidate` and would just 400 anyway; keeping them out of
 * the surface area is part of the "DOM-only writes" invariant.
 */
import { Router, Response } from 'express';
import { authMiddleware, AuthRequest } from '../middleware/auth.middleware';
import {
    getMe,
    getProfileByFsd,
    isFirstDegree,
    getAllConnections,
    getMailboxCounts,
    syncInbox,
    getMessagesInConversation,
    getUnseenCounts,
} from '../services/voyager-api.service';
import { launchAuthenticatedContext } from '../campaign-engine/session-launch';

const router = Router();
router.use(authMiddleware);

// Per-user request broker. The voyager service needs a live Playwright page
// for every request (to ride the session). We open a single context per user
// (lazily), keep it warm for `keepAliveMs` after the last request, then close.
// This amortizes the ~3-5s Playwright launch cost across N calls — the 719-row
// CSV takes 5min instead of 60min.
interface UserBrowserSession {
    userId: string;
    browser: any;
    context: any;
    page: any;
    lastUsedAt: number;
    keepAliveTimer: NodeJS.Timeout | null;
}
const SESSION_KEEPALIVE_MS = 90_000; // 90s
const sessions = new Map<string, UserBrowserSession>();

async function getOrCreateSession(userId: string): Promise<UserBrowserSession | null> {
    const existing = sessions.get(userId);
    if (existing) {
        existing.lastUsedAt = Date.now();
        if (existing.keepAliveTimer) clearTimeout(existing.keepAliveTimer);
        existing.keepAliveTimer = setTimeout(() => closeSession(userId), SESSION_KEEPALIVE_MS);
        return existing;
    }
    const launch = await launchAuthenticatedContext(userId);
    if (!launch.ok) return null;
    const sess: UserBrowserSession = {
        userId,
        browser: launch.browser,
        context: launch.context,
        page: launch.page,
        lastUsedAt: Date.now(),
        keepAliveTimer: null,
    };
    sess.keepAliveTimer = setTimeout(() => closeSession(userId), SESSION_KEEPALIVE_MS);
    sessions.set(userId, sess);
    return sess;
}

async function closeSession(userId: string) {
    const sess = sessions.get(userId);
    if (!sess) return;
    try { await sess.context?.close(); } catch {}
    try { await sess.browser?.close(); } catch {}
    sessions.delete(userId);
}

async function withSession<T>(userId: string, fn: (page: any) => Promise<T>): Promise<T | { error: string; status?: number }> {
    let sess = await getOrCreateSession(userId);
    if (!sess) {
        return { error: 'Failed to launch authenticated browser (no proxy snapshot? re-login required)' };
    }
    try {
        return await fn(sess.page);
    } catch (e: any) {
        return { error: e?.message || String(e) };
    }
}

/**
 * GET /voyager/me
 * Self profile (plainId, vanity, name, occupation).
 */
router.get('/me', async (req: AuthRequest, res: Response) => {
    const userId = req.user!.id;
    const r = await withSession(userId, async (page) => getMe(userId, page));
    if ((r as any).error) return res.status(500).json(r);
    res.json(r);
});

/**
 * GET /voyager/profile/:vanity
 * Full profile enrichment (name, headline, summary, location, industry, photo).
 */
router.get('/profile/:vanity', async (req: AuthRequest, res: Response) => {
    const userId = req.user!.id;
    const vanity = String(req.params.vanity);
    // Resolve vanity → fsdUrn (cheap GraphQL call inside the same session)
    const fsd = await withSession(userId, async (page) => {
        const url = `https://www.linkedin.com/voyager/api/graphql?variables=(memberIdentity:${encodeURIComponent(vanity)})&queryId=voyagerIdentityDashProfiles.b5c27c04968c409fc0ed3546575b9b7a`;
        const { voyagerFetch } = await import('../services/voyager-api.service');
        const r = await voyagerFetch<any>(userId, url, { page, skipRateLimit: true });
        if (!r.ok) return null;
        const data = (r.data as any)?.data || {};
        const included = (r.data as any)?.included || [];
        const profileUrn = data['*profile'] || data.profile;
        if (profileUrn?.startsWith('urn:li:fsd_profile:')) return profileUrn;
        const found = included.find((e: any) =>
            e.entityUrn?.startsWith('urn:li:fsd_profile:') ||
            e['*entityUrn']?.startsWith('urn:li:fsd_profile:')
        );
        return found?.entityUrn || found?.['*entityUrn'] || null;
    });
    if (!fsd || (fsd as any).error) {
        return res.status(404).json({ error: 'Could not resolve vanity to fsdUrn', fsd });
    }
    const r = await withSession(userId, async (page) => getProfileByFsd(userId, fsd as string, page));
    if ((r as any).error) return res.status(500).json(r);
    res.json(r);
});

/**
 * POST /voyager/bulk-enrich
 * Body: { vanities: string[], delayMs?: number }
 * Fetches each profile in turn, returning an array of enriched profiles.
 * Use this for the 719-row CSV enrichment flow.
 */
router.post('/bulk-enrich', async (req: AuthRequest, res: Response) => {
    const userId = req.user!.id;
    const { vanities, delayMs = 800 } = req.body as { vanities: string[]; delayMs?: number };
    if (!Array.isArray(vanities) || vanities.length === 0) {
        return res.status(400).json({ error: 'vanities must be a non-empty array' });
    }
    if (vanities.length > 200) {
        return res.status(400).json({ error: 'max 200 vanities per request (split into batches)' });
    }

    const wait = (ms: number) => new Promise((res) => setTimeout(res, ms));
    const results: any[] = [];
    for (const vanity of vanities) {
        try {
            const r = await withSession(userId, async (page) => {
                // Resolve vanity → fsdUrn
                const url = `https://www.linkedin.com/voyager/api/graphql?variables=(memberIdentity:${encodeURIComponent(vanity)})&queryId=voyagerIdentityDashProfiles.b5c27c04968c409fc0ed3546575b9b7a`;
                const { voyagerFetch, getProfileByFsd } = await import('../services/voyager-api.service');
                const resolveR = await voyagerFetch<any>(userId, url, { page, skipRateLimit: true });
                if (!resolveR.ok) return { vanity, error: `vanity resolve: ${resolveR.error}` };
                const data = (resolveR.data as any)?.data || {};
                const included = (resolveR.data as any)?.included || [];
                const profileUrn = data['*profile'] || data.profile;
                let fsd = profileUrn?.startsWith('urn:li:fsd_profile:') ? profileUrn : null;
                if (!fsd) {
                    const found = included.find((e: any) => e.entityUrn?.startsWith('urn:li:fsd_profile:'));
                    fsd = found?.entityUrn || null;
                }
                if (!fsd) return { vanity, error: 'no fsdUrn resolved' };
                const profileR = await getProfileByFsd(userId, fsd, page);
                if (!profileR.ok) return { vanity, error: profileR.error };
                return { vanity, profile: profileR.data };
            });
            results.push(r);
        } catch (e: any) {
            results.push({ vanity, error: e?.message || String(e) });
        }
        await wait(delayMs);
    }
    res.json({ results, count: results.length });
});

/**
 * GET /voyager/connections
 * Returns 1st-degree connections list. Cached per session.
 */
router.get('/connections', async (req: AuthRequest, res: Response) => {
    const userId = req.user!.id;
    const r = await withSession(userId, async (page) => getAllConnections(userId, page));
    if ((r as any).error) return res.status(500).json(r);
    res.json(r);
});

/**
 * GET /voyager/is-1st-degree/:vanity
 * Fast binary check; uses cached connections list.
 */
router.get('/is-1st-degree/:vanity', async (req: AuthRequest, res: Response) => {
    const userId = req.user!.id;
    const r = await withSession(userId, async (page) => isFirstDegree(userId, String(req.params.vanity), page));
    res.json({ vanity: String(req.params.vanity), isFirstDegree: r });
});

/**
 * GET /voyager/mailbox-counts
 * Unread counts per mailbox category.
 */
router.get('/mailbox-counts', async (req: AuthRequest, res: Response) => {
    const userId = req.user!.id;
    const r = await withSession(userId, async (page) => getMailboxCounts(userId, page));
    if ((r as any).error) return res.status(500).json(r);
    res.json(r);
});

/**
 * GET /voyager/inbox?maxThreads=N
 * Sync inbox via Voyager (thread list + per-thread message bodies).
 */
router.get('/inbox', async (req: AuthRequest, res: Response) => {
    const userId = req.user!.id;
    const maxThreads = parseInt((req.query.maxThreads as string) || '20');
    const r = await withSession(userId, async (page) => syncInbox(userId, page, { maxThreads }));
    if ((r as any).error) return res.status(500).json(r);
    res.json(r);
});

/**
 * GET /voyager/conversation/:urn
 * Full message bodies in a conversation. URN must be URL-encoded.
 */
router.get('/conversation', async (req: AuthRequest, res: Response) => {
    const userId = req.user!.id;
    const urn = req.query.urn as string;
    if (!urn) return res.status(400).json({ error: 'urn query param required' });
    const r = await withSession(userId, async (page) => getMessagesInConversation(userId, urn, page));
    if ((r as any).error) return res.status(500).json(r);
    res.json(r);
});

/**
 * GET /voyager/unseen-counts
 * Unread counts by notification category.
 */
router.get('/unseen-counts', async (req: AuthRequest, res: Response) => {
    const userId = req.user!.id;
    const r = await withSession(userId, async (page) => getUnseenCounts(userId, page));
    if ((r as any).error) return res.status(500).json(r);
    res.json(r);
});

/**
 * GET /voyager/session-health
 * Reports whether the user has an active browser session + voyager-ready.
 * Used by the extension to decide whether to call this backend or do its
 * own DOM scrape.
 */
router.get('/session-health', async (req: AuthRequest, res: Response) => {
    const userId = req.user!.id;
    const existing = sessions.get(userId);
    res.json({
        active: !!existing,
        lastUsedAt: existing?.lastUsedAt || null,
        keepAliveRemaining: existing ? Math.max(0, SESSION_KEEPALIVE_MS - (Date.now() - existing.lastUsedAt)) : 0,
    });
});

export default router;
