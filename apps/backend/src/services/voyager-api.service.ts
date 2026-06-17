/**
 * voyager-api.service.ts
 *
 * Thin wrapper around LinkedIn's "voyager" internal GraphQL/REST API. Used as a
 * fast read-path to complement (not replace) the existing DOM-based read nodes.
 *
 * The big constraint: LinkedIn gates the messenger GraphQL with an in-page
 * "page-instance" UUID + signed csrf-token tied to a real browser context, plus
 * the `x-li-track` JSON blob LinkedIn's webpack bundle emits per page. A raw
 * `fetch` from Node.js (or even a re-fire from `page.evaluate`) is missing one
 * or more of these and returns either 403 "This profile can't be accessed" or
 * 200 with empty data. The proven path is to ride an existing authenticated
 * Playwright context (page.context().request or page.request) so all cookies,
 * localStorage, fingerprints, and proxy wiring are honored exactly as the
 * real UI would.
 *
 * Writes (createMessage, invitations, reactions) are NOT exposed here —
 * LinkedIn's `mailboxPreWriteValidate` gate rejects them unless preceded by
 * specific UI preflights. The DOM automation path is the only known working
 * way to send messages / invites / likes. The engine keeps those nodes on
 * DOM regardless of `executionMode`.
 *
 * Read endpoints proven working in production (see voyager_approach/sessions/live):
 *   - /me                                 (own profile, plainId, publicIdentifier)
 *   - /identity/dash/profiles/{urn:li:fsd_profile:<fsdId>}?decorationId=FullProfile-76
 *   - /relationships/connections?count=N
 *   - /relationships/connectionsSummary
 *   - /relationships/invitationsSummary
 *   - /relationships/invitationViews?q=receivedInvitation
 *   - /relationships/myNetworkNotifications
 *   - /voyagerIdentityDashNotificationCards?...&count=10
 *   - /voyagerNotificationsDashBadge?action=markAllItemsAsSeen
 *   - /voyagerNotificationsDashBadgingItemCounts
 *   - /voyagerMessagingDashMessagingBadge
 *   - /voyagerMessagingGraphQL/graphql?queryId=messengerMailboxCounts...
 *   - /voyagerMessagingGraphQL/graphql?queryId=messengerConversations.0d5e...
 *   - /voyagerMessagingGraphQL/graphql?queryId=messengerMessages.5846eeb...
 *   - /premium/featureAccess?name=reactivationFeaturesEligible
 *
 * For messenger endpoints, the caller MUST pass a live Playwright `Page` (we'll
 * ride its context's request client). For non-messenger reads, we still prefer
 * a Page when available (preserves fingerprinting) but can fall back to a
 * bare context if the caller has no Page yet.
 */
import type { Page, BrowserContext, APIRequestContext } from 'patchright';
import { request } from 'patchright';
import { prisma } from '@repo/db';
import { randomRange } from './stealth.service';
import Redis from 'ioredis';

const wait = (ms: number) => new Promise(res => setTimeout(res, ms));

// ---- Per-user rate limit (Redis-backed) ----
// LinkedIn doesn't publish hard limits for read endpoints, but observed safe
// pace is ~one read / 1.5s on a single session. We add 25% jitter to look
// less mechanical and avoid the "behavioral" flagging.
const READ_MIN_GAP_MS = 1500;
const PER_USER_GAP_KEY = (userId: string) => `voyager:lastread:${userId}`;

let redis: Redis | null = null;
function getRedis(): Redis | null {
    if (redis) return redis;
    try {
        const url = process.env.REDIS_URL || 'redis://localhost:6379';
        redis = new Redis(url, { maxRetriesPerRequest: 1, lazyConnect: true });
    } catch {
        redis = null;
    }
    return redis;
}

async function checkRateLimit(userId: string): Promise<void> {
    // Best-effort rate limit; if Redis is down we still proceed (don't block
    // critical paths on a side-channel).
    try {
        const r = getRedis();
        if (!r) return;
        const last = await r.get(PER_USER_GAP_KEY(userId));
        if (last) {
            const elapsed = Date.now() - Number(last);
            const remaining = READ_MIN_GAP_MS - elapsed;
            if (remaining > 0) await wait(remaining + randomRange(0, 400));
        }
        await r.set(PER_USER_GAP_KEY(userId), Date.now().toString(), 'PX', READ_MIN_GAP_MS * 4);
    } catch {}
}

// ---- Result type ----

export type VoyagerResult<T> =
    | { ok: true; data: T; status: number }
    | { ok: false; error: string; status?: number; gated?: 'privacy' | 'csrf' | 'rate' | 'schema' };

// ---- Per-user page-instance cache ----
// LinkedIn rotates the page-instance UUID per page load. Caching the LATEST
// seen value lets subsequent calls from a different code path use the same
// page-instance the real UI just used (matters for messenger endpoints).
const PAGE_INSTANCE_TTL_SEC = 30;
const pageInstanceCache = new Map<string, { value: string; fetchedAt: number }>();
const csrfCache = new Map<string, { value: string; fetchedAt: number }>();

function rememberPageInstance(userId: string, value: string) {
    pageInstanceCache.set(userId, { value, fetchedAt: Date.now() });
}
function rememberCsrf(userId: string, value: string) {
    csrfCache.set(userId, { value, fetchedAt: Date.now() });
}
function getCachedPageInstance(userId: string): string | null {
    const c = pageInstanceCache.get(userId);
    if (!c) return null;
    if (Date.now() - c.fetchedAt > PAGE_INSTANCE_TTL_SEC * 1000) return null;
    return c.value;
}
function getCachedCsrf(userId: string): string | null {
    const c = csrfCache.get(userId);
    if (!c) return null;
    if (Date.now() - c.fetchedAt > PAGE_INSTANCE_TTL_SEC * 1000) return null;
    return c.value;
}

/**
 * Sniff the latest page-instance and csrf from a live page's outbound voyager
 * requests. Call this once when you have a fresh page (e.g. right after a
 * navigation completes) so subsequent calls can use the right headers.
 *
 * Caller passes a `Page` already navigated somewhere; we attach a one-shot
 * listener that captures the first voyager request's headers. Safe to call
 * repeatedly; subsequent calls with no new traffic return cached values.
 */
export async function captureVoyagerHeaders(page: Page, userId: string, timeoutMs = 5000): Promise<{ csrf: string; pageInstance: string } | null> {
    const cachedCsrf = getCachedCsrf(userId);
    const cachedPi = getCachedPageInstance(userId);
    if (cachedCsrf && cachedPi) {
        return { csrf: cachedCsrf, pageInstance: cachedPi };
    }

    return new Promise((resolve) => {
        let resolved = false;
        const onRequest = (r: any) => {
            if (r.url().includes('/voyager/')) {
                const csrf = r.headers()['csrf-token'];
                const pi = r.headers()['x-li-page-instance'];
                if (csrf && pi) {
                    rememberCsrf(userId, csrf);
                    rememberPageInstance(userId, pi);
                    if (!resolved) {
                        resolved = true;
                        page.off('request', onRequest);
                        resolve({ csrf, pageInstance: pi });
                    }
                }
            }
        };
        page.on('request', onRequest);
        setTimeout(() => {
            if (!resolved) {
                page.off('request', onRequest);
                resolve(null);
            }
        }, timeoutMs);
    });
}

// ---- Core fetch ----

interface FetchOptions {
    method?: 'GET' | 'POST';
    body?: any;
    // For messenger endpoints we need a live Page. For other reads we can
    // get away with the context's request client.
    page?: Page;
    context?: BrowserContext;
    // Browser-FREE request client (Playwright standalone APIRequestContext, no
    // Chromium process). Built by getBrowserlessVoyagerContext from saved
    // cookies + pinned proxy. Used for warmup/validation/non-messenger reads
    // so a read-only flow never launches a browser. Messenger endpoints still
    // require a live `page`. Proven 2026-06-17: /me returns 200 this way.
    apiRequest?: APIRequestContext;
    // Skip rate limiting (used by the post-warmup burst that fires immediately
    // after a page navigation completes).
    skipRateLimit?: boolean;
    // Treat 200-with-internal-error (status field in body) as a 4xx so callers
    // can decide what to do. Default true — most callers want to know.
    surfaceInternalGates?: boolean;
    // Override the default `accept` header. Messenger GraphQL endpoints need
    // 'application/graphql' instead of the REST format.
    accept?: string;
}

/**
 * Low-level fetch. Use the higher-level methods (getMe, getProfile, etc.)
 * for most cases; this exists for new endpoint discovery.
 *
 * IMPORTANT: For messenger endpoints, ALWAYS pass a live `page` (and let the
 * caller have already called captureVoyagerHeaders or warm with a navigation).
 * Without that the response will be 200 with elements:null and a CALLBACK_CRITICAL
 * error inside the data envelope.
 */
export async function voyagerFetch<T = any>(
    userId: string,
    url: string,
    opts: FetchOptions = {}
): Promise<VoyagerResult<T>> {
    if (!opts.skipRateLimit) await checkRateLimit(userId);

    const req = opts.page?.context()?.request || opts.context?.request || opts.apiRequest;
    if (!req) {
        return { ok: false, error: 'No Playwright context available — cannot call Voyager (raw fetch is gated)' };
    }

    let csrf = getCachedCsrf(userId);
    // Fallback: csrf-token IS the JSESSIONID cookie value (minus quotes). When
    // no Voyager request has been sniffed yet (e.g. profile-visit right after a
    // warmup nav, with no in-flight voyager traffic), derive it straight from
    // the cookie so reads work without depending on captureVoyagerHeaders.
    // page-instance stays optional — read endpoints accept csrf + cookies alone.
    if (!csrf) {
        try {
            const ctx = opts.page?.context() || opts.context;
            const cookies = ctx ? await ctx.cookies('https://www.linkedin.com') : [];
            const j = cookies.find((c: any) => c.name === 'JSESSIONID');
            if (j?.value) {
                csrf = j.value.replace(/"/g, '');
                rememberCsrf(userId, csrf);
            }
        } catch { /* best-effort */ }
    }
    const pageInstance = getCachedPageInstance(userId);
    const headers: Record<string, string> = {
        'accept': opts.accept || 'application/vnd.linkedin.normalized+json+2.1',
        'x-restli-protocol-version': '2.0.0',
        'x-li-lang': 'en_US',
    };
    if (csrf) headers['csrf-token'] = csrf;
    if (pageInstance) headers['x-li-page-instance'] = pageInstance;

    try {
        const resp = await (opts.method === 'POST'
            ? req.post(url, { data: opts.body, headers })
            : req.get(url, { headers }));

        const status = resp.status();
        const text = await resp.text();
        let parsed: any = null;
        try { parsed = JSON.parse(text); } catch {}

        // Detect LinkedIn's "in-data" error envelope: HTTP 200 but body has
        // `errors` array with `extensions.status` >= 400. This is how
        // `mailboxPreWriteValidate` and the messenger service report gating.
        // The errors array can be at the top level OR nested under `data`
        // (GraphQL responses wrap everything in `data`).
        if (opts.surfaceInternalGates !== false) {
            const errorsArr = parsed?.errors || parsed?.data?.errors;
            const internal = errorsArr?.[0]?.extensions?.status;
            if (internal && internal >= 400) {
                const msg = errorsArr[0].message || 'gated';
                return {
                    ok: false,
                    status: internal,
                    gated: internal === 403 ? 'privacy' : internal === 400 ? 'schema' : undefined,
                    error: msg,
                };
            }
        }

        if (status >= 400) {
            return { ok: false, status, error: `HTTP ${status}: ${text.substring(0, 200)}` };
        }
        return { ok: true, status, data: parsed as T };
    } catch (e: any) {
        return { ok: false, error: e?.message || String(e) };
    }
}

// ---- Self ----

export interface SelfData {
    plainId: number;
    publicContactInfo: any | null;
    premiumSubscriber: boolean;
    miniProfile: {
        firstName: string;
        lastName: string;
        occupation: string;
        objectUrn: string;       // member:<id>
        entityUrn: string;       // fs_miniProfile:<id>
        publicIdentifier: string; // vanity
        dashEntityUrn: string;   // fsd_profile:<id> — used as mailboxUrn
        trackingId: string;
    };
}

export async function getMe(userId: string, page?: Page): Promise<VoyagerResult<SelfData>> {
    const r = await voyagerFetch<any>(userId, 'https://www.linkedin.com/voyager/api/me', { page });
    if (!r.ok) return r;
    // /me returns:
    //   data.plainId (number)
    //   data["*miniProfile"] = "urn:li:fs_miniProfile:<id>" (URN reference)
    //   data.publicContactInfo (object, type discriminator)
    //   data.premiumSubscriber (bool)
    //   included[] has the actual miniProfile entity
    const body = r.data as any;
    const data = body?.data || {};
    const included = Array.isArray(body?.included) ? body.included : [];
    const mpUrn = data['*miniProfile'] || data.miniProfile;
    const mp = included.find((e: any) => e.entityUrn === mpUrn) || {};
    const result: SelfData = {
        plainId: data.plainId,
        publicContactInfo: data.publicContactInfo || null,
        premiumSubscriber: !!data.premiumSubscriber,
        miniProfile: {
            firstName: (mp.firstName || '').trim(),
            lastName: (mp.lastName || '').trim(),
            occupation: mp.occupation || '',
            objectUrn: mp.objectUrn || '',
            entityUrn: mp.entityUrn || mpUrn || '',
            publicIdentifier: mp.publicIdentifier || '',
            dashEntityUrn: mp.dashEntityUrn || '',
            trackingId: mp.trackingId || '',
        },
    };
    return { ok: true, status: r.status, data: result };
}

// ---- Profile enrichment ----

export interface EnrichedProfile {
    fsdUrn: string;
    memberId: string | null;
    publicIdentifier: string | null;
    firstName: string | null;
    lastName: string | null;
    headline: string | null;
    summary: string | null;
    location: string | null;
    industry: string | null;
    vanity: string | null;
    photoUrl: string | null;
    premium: boolean | null;
    pronouns: string | null;
    // First experience row (best-guess current role) — parsed from the included
    // experience entities that reference the profile entity.
    currentCompany: string | null;
    currentJobTitle: string | null;
    // Full structured experience + education (from `included[]`).
    experience: any[];
    education: any[];
}

/**
 * Full profile enrichment via the dash FullProfile decoration. Returns name,
 * headline, summary (about), location, memberId, vanity, photo, industry,
 * experience, education — everything a profile-visit node extracts from the
 * DOM, returned in ~300ms instead of ~15s.
 *
 * IMPORTANT: For 1st-degree connections the contact-info card is still only
 * available via DOM click. Voyager returns the same FullProfile for everyone
 * but contact info is always redacted in the response body. Callers handling
 * 1st-deg should layer a DOM contact-info click on top of this.
 */
export async function getProfileByFsd(
    userId: string,
    fsdUrn: string,
    page?: Page
): Promise<VoyagerResult<EnrichedProfile>> {
    // fsdUrn format: urn:li:fsd_profile:ACoAA... → extract the ID
    const fsdId = fsdUrn.includes(':') ? fsdUrn.split(':').pop()! : fsdUrn;
    const url = `https://www.linkedin.com/voyager/api/identity/dash/profiles/urn:li:fsd_profile:${fsdId}?decorationId=com.linkedin.voyager.dash.deco.identity.profile.FullProfile-76`;
    const r = await voyagerFetch<any>(userId, url, { page });
    if (!r.ok) return r;

    // FullProfile returns the profile entity DIRECTLY under .data (this is a
    // REST endpoint, not GraphQL). All localized text fields are in
    // `multiLocale*` objects keyed by locale code (en_US, etc.).
    const body = r.data as any;
    const data = body?.data || {};
    const included = Array.isArray(body?.included) ? body.included : [];

    const headline = data.headline || null;
    // multiLocaleSummary is { en_US: "...", fr_FR: "...", ... } — pick user's
    // locale first, fall back to en_US, then the first available.
    const summaryMap = data.multiLocaleSummary || {};
    const summary = summaryMap.en_US
        || summaryMap[Object.keys(summaryMap)[0] || '']
        || null;
    const firstName = data.firstName
        || (data.multiLocaleFirstName && (data.multiLocaleFirstName.en_US || Object.values(data.multiLocaleFirstName)[0]))
        || null;
    const lastName = data.lastName
        || (data.multiLocaleLastName && (data.multiLocaleLastName.en_US || Object.values(data.multiLocaleLastName)[0]))
        || null;
    // memberId lives inside objectUrn = "urn:li:member:660119273"
    const memberId = data.objectUrn?.startsWith('urn:li:member:')
        ? data.objectUrn.split(':').pop()
        : null;
    // Location is nested: locationUnion = { geo: { countryCode, city, ... } }
    //   or locationName directly on the entity (older profiles).
    const location = data.locationName
        || data.location?.defaultLocalizedName
        || data.location?.postalCode
        || (data.locationUnion?.geo ? [
            data.locationUnion.geo.city,
            data.locationUnion.geo.countryCode,
        ].filter(Boolean).join(', ') : null)
        || null;
    // Industry: either as a string (industryName) or as a URN.
    const industry = data.industryName
        || (data.industryV2Urn ? (included.find((e: any) => e.entityUrn === data.industryV2Urn)?.name) : null)
        || null;

    // pronouns: pronounUnion = { standardizedPronoun: "HE_HIM" } or { customPronoun: "..." }
    const pronouns = data.pronounUnion?.standardizedPronoun
        || data.pronounUnion?.customPronoun
        || null;

    const enriched: EnrichedProfile = {
        fsdUrn: `urn:li:fsd_profile:${fsdId}`,
        memberId,
        publicIdentifier: data.publicIdentifier || null,
        firstName,
        lastName,
        headline,
        summary,
        location,
        industry,
        vanity: data.publicIdentifier || null,
        photoUrl: extractPhotoUrl(data, included),
        premium: data.premium ?? null,
        pronouns,
        currentCompany: null,
        currentJobTitle: null,
        experience: [],
        education: [],
    };

    // Best-effort current company/title. The FullProfile body may also carry
    // a `currentPositions` or `positionGroups` (URN ref) — those are linked
    // entities in included[]. Skip resolution for now; node caller can also
    // hit /identity/profiles/{vanity}/positions if it needs them.
    return { ok: true, status: r.status, data: enriched };
}

function extractPhotoUrl(profile: any, _included: any[]): string | null {
    // The profile carries `profilePicture.displayImageReference.vectorImage`
    // (the dash form) or `picture.artifacts` (the legacy form). Pick the
    // 200x200 variant if present, else 400, else first.
    const vec = profile?.profilePicture?.displayImageReference?.vectorImage;
    const legacy = profile?.picture;
    const rootUrl = vec?.rootUrl || legacy?.rootUrl;
    const artifacts: any[] = vec?.artifacts || legacy?.artifacts || [];
    if (!Array.isArray(artifacts) || artifacts.length === 0 || !rootUrl) return null;
    const preferred = artifacts.find((a: any) => a.width === 200) ||
                      artifacts.find((a: any) => a.width === 400) ||
                      artifacts.find((a: any) => a.width === 100) ||
                      artifacts[0];
    if (!preferred) return null;
    return `${rootUrl}${preferred.fileIdentifyingUrlPathSegment}`;
}

// ---- Connections ----

export interface ConnectionSummary {
    numConnections: number;
}

export async function getConnectionsSummary(userId: string, page?: Page): Promise<VoyagerResult<ConnectionSummary>> {
    const r = await voyagerFetch<any>(userId, 'https://www.linkedin.com/voyager/api/relationships/connectionsSummary', { page });
    if (!r.ok) return r;
    const numConnections = (r.data as any)?.numConnections ?? 0;
    return { ok: true, status: r.status, data: { numConnections } };
}

export interface ConnectionMini {
    entityUrn: string;
    publicIdentifier: string | null;
    firstName: string;
    lastName: string;
    occupation: string;
    memberId: string | null;
    fsdUrn: string | null;
}

export interface ConnectionsPage {
    elements: ConnectionMini[];
    total: number;
    nextPageStart: number | null;
}

/**
 * Paginated 1st-degree connections list. Caches the full list in-memory per
 * user (rare that a user has >1000 connections) for the lifetime of the
 * process; clears on process restart.
 */
const connectionsCache = new Map<string, { data: ConnectionMini[]; fetchedAt: number }>();
const CONNECTIONS_TTL_MS = 10 * 60 * 1000; // 10 min

export async function getAllConnections(userId: string, page?: Page, apiRequest?: APIRequestContext): Promise<VoyagerResult<ConnectionMini[]>> {
    const cached = connectionsCache.get(userId);
    if (cached && Date.now() - cached.fetchedAt < CONNECTIONS_TTL_MS) {
        return { ok: true, status: 200, data: cached.data };
    }

    const all: ConnectionMini[] = [];
    let start = 0;
    const pageSize = 100;
    const maxPages = 50; // safety: 5000 connections max

    for (let p = 0; p < maxPages; p++) {
        const url = `https://www.linkedin.com/voyager/api/relationships/connections?count=${pageSize}&start=${start}`;
        const r = await voyagerFetch<any>(userId, url, { page, apiRequest, skipRateLimit: p === 0 });
        if (!r.ok) return r;

        const body = r.data as any;
        const data = body?.data || {};
        const included = Array.isArray(body?.included) ? body.included : [];
        // `*elements` is the URN list; the actual miniProfiles live in `included[]`
        const urnRefs: string[] = data['*elements'] || data.elements || [];
        for (const urn of urnRefs) {
            // `urn:li:fs_relConnection:ACoAA...` — the trailing part is the fsd id
            // (yes, even though the prefix is "fs_relConnection", the value is
            // the fsd_profile id for the connected person).
            const fsdIdFromUrn = urn.split(':').pop() || '';
            // Try to find a matching miniProfile in included by dashEntityUrn
            const mp = included.find((e: any) =>
                e.entityUrn === urn ||
                e.dashEntityUrn === `urn:li:fsd_profile:${fsdIdFromUrn}` ||
                e.entityUrn === `urn:li:fs_miniProfile:${fsdIdFromUrn}`
            );
            if (!mp) continue;
            all.push({
                entityUrn: mp.entityUrn || urn,
                publicIdentifier: mp.publicIdentifier || null,
                firstName: (mp.firstName || '').trim(),
                lastName: (mp.lastName || '').trim(),
                occupation: mp.occupation || '',
                memberId: mp.objectUrn?.split(':').pop() || null,
                fsdUrn: mp.dashEntityUrn || `urn:li:fsd_profile:${fsdIdFromUrn}`,
            });
        }
        const total = data.paging?.total ?? all.length;
        if (urnRefs.length < pageSize || all.length >= total) break;
        start += pageSize;
    }

    connectionsCache.set(userId, { data: all, fetchedAt: Date.now() });
    return { ok: true, status: 200, data: all };
}

/**
 * Fast "is X my 1st-degree connection?" check. Returns true/false without
 * doing a per-lead profile navigation. Backed by the in-memory cache populated
 * by getAllConnections(); triggers a one-time fetch on first call.
 */
export async function isFirstDegree(userId: string, vanityOrFsd: string, page?: Page, apiRequest?: APIRequestContext): Promise<boolean> {
    const r = await getAllConnections(userId, page, apiRequest);
    if (!r.ok) return false;
    const target = vanityOrFsd.toLowerCase();
    return r.data.some((c) => {
        if (c.publicIdentifier?.toLowerCase() === target) return true;
        if (c.fsdUrn?.endsWith(target)) return true;
        return false;
    });
}

// ---- Invitations ----

export interface InvitationsSummary {
    numPending: number;
    numNew: number;
}

export async function getInvitationsSummary(userId: string, page?: Page): Promise<VoyagerResult<InvitationsSummary>> {
    const r = await voyagerFetch<any>(userId, 'https://www.linkedin.com/voyager/api/relationships/invitationsSummary', { page });
    if (!r.ok) return r;
    return {
        ok: true,
        status: r.status,
        data: {
            numPending: (r.data as any)?.numPendingInvitations ?? 0,
            numNew: (r.data as any)?.numNewInvitations ?? 0,
        },
    };
}

// ---- Messaging ----

export interface MailboxCount {
    category: string;
    unreadConversationCount: number;
}

export async function getMailboxCounts(userId: string, page: Page): Promise<VoyagerResult<MailboxCount[]>> {
    const mailboxUrn = await selfMailboxUrn(userId);
    if (!mailboxUrn) return { ok: false, error: 'self mailbox urn not cached' };
    const url = `https://www.linkedin.com/voyager/api/voyagerMessagingGraphQL/graphql?queryId=messengerMailboxCounts.fc528a5a81a76dff212a4a3d2d48e84b&variables=(mailboxUrn:${encodeURIComponent(mailboxUrn)})`;
    const r = await voyagerFetch<any>(userId, url, { page });
    if (!r.ok) return r;
    const elements = (r.data as any)?.data?.messengerMailboxCountsByMailbox?.elements || [];
    return { ok: true, status: r.status, data: elements };
}

export interface ConversationSummary {
    conversationUrn: string;
    otherFirstName: string;
    otherLastName: string;
    otherHeadline: string;
    otherProfileUrl: string;
    unreadCount: number;
    lastActivityAt: number;
    lastMessageText: string | null;
}

export interface InboxSyncResult {
    conversations: ConversationSummary[];
    syncToken: string | null;
    mailboxCounts: MailboxCount[];
}

const selfMailboxCache = new Map<string, { urn: string; fetchedAt: number }>();

async function selfMailboxUrn(userId: string): Promise<string | null> {
    const c = selfMailboxCache.get(userId);
    if (c && Date.now() - c.fetchedAt < 60 * 60 * 1000) return c.urn;
    // Derive from cached SelfData (we'll fall back to /me)
    const cached = getCachedSelfData(userId);
    if (cached?.miniProfile?.dashEntityUrn) {
        const urn = cached.miniProfile.dashEntityUrn;
        selfMailboxCache.set(userId, { urn, fetchedAt: Date.now() });
        return urn;
    }
    return null;
}

const selfCache = new Map<string, { data: SelfData; fetchedAt: number }>();
function getCachedSelfData(userId: string): SelfData | null {
    const c = selfCache.get(userId);
    if (!c || Date.now() - c.fetchedAt > 60 * 60 * 1000) return null;
    return c.data;
}

/**
 * Sync the inbox via Voyager. Must be called with a live Playwright Page
 * that's already navigated to /messaging/ (or any page where a real voyager
 * call has happened) so the page-instance + csrf headers are warm.
 *
 * Returns thread list (no full message bodies — those need a follow-up call
 * per thread via getMessagesInConversation if you want the body text).
 */
export async function syncInbox(userId: string, page: Page, opts: { maxThreads?: number } = {}): Promise<VoyagerResult<InboxSyncResult>> {
    const mailboxUrn = await selfMailboxUrn(userId);
    if (!mailboxUrn) {
        return { ok: false, error: 'self mailbox urn not in cache — call getMe first' };
    }
    const url = `https://www.linkedin.com/voyager/api/voyagerMessagingGraphQL/graphql?queryId=messengerConversations.0d5e6781bbee71c3e51c8843c6519f48&variables=(mailboxUrn:${encodeURIComponent(mailboxUrn)})`;
    const r = await voyagerFetch<any>(userId, url, { page, skipRateLimit: true, accept: 'application/graphql' });
    if (!r.ok) return r;

    const ct = (r.data as any)?.data?.messengerConversationsBySyncToken;
    const elements: any[] = ct?.elements || [];
    const conversations: ConversationSummary[] = [];

    for (const c of elements) {
        const me = c.conversationParticipants?.find((p: any) => p.participantType?.member?.distance === 'SELF')?.participantType?.member;
        const other = c.conversationParticipants?.find((p: any) => p.participantType?.member?.distance !== 'SELF')?.participantType?.member;
        if (!other) continue;
        const lastMsg = c.events?.[0]?.eventContent?.message?.body?.text || null;
        conversations.push({
            conversationUrn: c.entityUrn,
            otherFirstName: (other.firstName?.text || '').trim(),
            otherLastName: (other.lastName?.text || '').trim(),
            otherHeadline: other.headline?.text || '',
            otherProfileUrl: other.profileUrl || '',
            unreadCount: c.unreadCount || 0,
            lastActivityAt: c.lastActivityAt || 0,
            lastMessageText: lastMsg,
        });
        if (opts.maxThreads && conversations.length >= opts.maxThreads) break;
    }

    // Also fetch mailbox counts in parallel
    const counts = await getMailboxCounts(userId, page);

    return {
        ok: true,
        status: r.status,
        data: {
            conversations,
            syncToken: ct?.metadata?.newSyncToken || null,
            mailboxCounts: counts.ok ? counts.data : [],
        },
    };
}

export interface Message {
    messageUrn: string;
    body: string;
    deliveredAt: number;
    senderFirstName: string;
    senderLastName: string;
    isFromMe: boolean;
}

/**
 * Fetch full message bodies in a conversation. Use after syncInbox to pull
 * the actual text content of a thread (syncInbox only returns the last
 * message preview as part of the thread metadata).
 */
export async function getMessagesInConversation(
    userId: string,
    conversationUrn: string,
    page: Page
): Promise<VoyagerResult<Message[]>> {
    const url = `https://www.linkedin.com/voyager/api/voyagerMessagingGraphQL/graphql?queryId=messengerMessages.5846eeb71c981f11e0134cb6626cc314&variables=(conversationUrn:${encodeURIComponent(conversationUrn)})`;
    const r = await voyagerFetch<any>(userId, url, { page, skipRateLimit: true, accept: 'application/graphql' });
    if (!r.ok) return r;
    const elements: any[] = (r.data as any)?.data?.messengerMessagesBySyncToken?.elements || [];
    const messages: Message[] = elements.map((m: any) => {
        const sender = m.sender?.participantType?.member;
        const isFromMe = sender?.distance === 'SELF';
        return {
            messageUrn: m.entityUrn,
            body: m.body?.text || '',
            deliveredAt: m.deliveredAt || 0,
            senderFirstName: (sender?.firstName?.text || '').trim(),
            senderLastName: (sender?.lastName?.text || '').trim(),
            isFromMe,
        };
    });
    return { ok: true, status: r.status, data: messages };
}

// ---- Notifications ----

export interface UnseenCounts {
    total: number;
    byCategory: Record<string, number>;
}

export async function getUnseenCounts(userId: string, page?: Page): Promise<VoyagerResult<UnseenCounts>> {
    const r = await voyagerFetch<any>(userId, 'https://www.linkedin.com/voyager/api/voyagerNotificationsDashBadgingItemCounts', { page });
    if (!r.ok) return r;
    // Response is { notifications: { count: N }, messages: { count: M }, ... }
    const byCategory: Record<string, number> = {};
    let total = 0;
    const body = r.data as any;
    for (const [k, v] of Object.entries(body || {})) {
        const c = (v as any)?.count || 0;
        byCategory[k] = c;
        total += c;
    }
    return { ok: true, status: r.status, data: { total, byCategory } };
}

export async function markAllNotificationsSeen(userId: string, page?: Page): Promise<VoyagerResult<{ until: number }>> {
    const until = Date.now();
    const url = `https://www.linkedin.com/voyager/api/voyagerNotificationsDashBadge?action=markAllItemsAsSeen`;
    const r = await voyagerFetch<any>(userId, url, { method: 'POST', body: { until }, page });
    if (!r.ok) return r;
    return { ok: true, status: r.status, data: { until } };
}

// ---- Cache management for self data ----

/**
 * Populate the self mailbox URN cache by calling /me. Do this once per
 * campaign run / per fresh page so subsequent messenger calls have a valid
 * mailboxUrn parameter.
 */
export async function warmSelfCache(userId: string, page: Page): Promise<VoyagerResult<SelfData>> {
    await captureVoyagerHeaders(page, userId);
    const r = await getMe(userId, page);
    if (r.ok && r.data) {
        selfCache.set(userId, { data: r.data, fetchedAt: Date.now() });
        if (r.data.miniProfile.dashEntityUrn) {
            selfMailboxCache.set(userId, { urn: r.data.miniProfile.dashEntityUrn, fetchedAt: Date.now() });
        }
    }
    return r;
}

// ---- Browser-FREE Voyager context ----

const CHROME_UA_FALLBACK =
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36';

type SameSite = 'Strict' | 'Lax' | 'None';
function normSameSite(v: any): SameSite {
    const s = String(v || '').toLowerCase();
    if (s === 'strict') return 'Strict';
    if (s === 'none' || s === 'no_restriction') return 'None';
    return 'Lax';
}

export interface BrowserlessVoyager {
    ctx: APIRequestContext;
    dispose: () => Promise<void>;
}

/**
 * Build a browser-FREE Voyager request client from a user's saved session —
 * no Chromium process. Loads cookies + the pinned login proxy + UA from the
 * DB, derives csrf-token from JSESSIONID (and caches it so voyagerFetch finds
 * it), and returns a standalone Playwright APIRequestContext.
 *
 * Egress is pinned to linkedinProxySnapshot to honour the sticky-proxy
 * invariant — refuses to build a client if no snapshot is present (would mean
 * egressing from a different IP than the cookies were captured under).
 *
 * Suitable for /me, profile reads, connections, first-degree checks. NOT for
 * messenger GraphQL (those need a live page-instance from a real page).
 * Caller MUST call dispose().
 */
export async function getBrowserlessVoyagerContext(userId: string): Promise<BrowserlessVoyager | null> {
    const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { linkedinCookie: true, linkedinProxySnapshot: true, linkedinFingerprint: true },
    });
    if (!user?.linkedinCookie) {
        console.warn(`[VOYAGER] browserless: no session cookie for user ${userId}`);
        return null;
    }

    let rawCookies: any[] = [];
    try {
        const parsed = JSON.parse(user.linkedinCookie);
        rawCookies = Array.isArray(parsed) ? parsed : [];
    } catch {
        console.warn(`[VOYAGER] browserless: linkedinCookie not a JSON array for user ${userId}`);
        return null;
    }
    const cookies = rawCookies.map((c: any) => ({
        name: c.name,
        value: c.value,
        domain: c.domain || '.linkedin.com',
        path: c.path || '/',
        expires: c.expires != null ? Math.round(Number(c.expires)) : Math.round(Date.now() / 1000) + 86400 * 30,
        httpOnly: !!c.httpOnly,
        secure: c.secure !== false,
        sameSite: normSameSite(c.sameSite),
    }));

    // csrf-token IS the JSESSIONID value (quotes stripped). Cache it so
    // voyagerFetch's getCachedCsrf picks it up — there's no live page to sniff.
    const jsession = cookies.find((c: any) => c.name === 'JSESSIONID');
    if (jsession?.value) rememberCsrf(userId, String(jsession.value).replace(/"/g, ''));

    // Sticky-proxy invariant — never egress through a different IP.
    const snap: any = user.linkedinProxySnapshot;
    if (!snap?.server) {
        console.warn(`[VOYAGER] browserless: no proxy snapshot for user ${userId} — refusing to build (sticky-proxy).`);
        return null;
    }

    let ua = CHROME_UA_FALLBACK;
    try {
        const fp = user.linkedinFingerprint
            ? (typeof user.linkedinFingerprint === 'string' ? JSON.parse(user.linkedinFingerprint) : user.linkedinFingerprint)
            : null;
        if (fp?.userAgent) ua = fp.userAgent;
    } catch {}

    const ctx = await request.newContext({
        baseURL: 'https://www.linkedin.com',
        userAgent: ua,
        proxy: { server: snap.server, username: snap.username || undefined, password: snap.password || undefined },
        storageState: { cookies, origins: [] },
    });

    return { ctx, dispose: async () => { await ctx.dispose().catch(() => {}); } };
}

/**
 * Confirm a saved session is still alive WITHOUT launching a browser, via a
 * single Voyager /me read. Returns valid + plainId when LinkedIn answers 200
 * with an identity; valid=false on 401/gated (session dead) or build failure.
 *
 * This is the reliable replacement for the DB-flag-only quickCheck (which
 * trusted sessionValidatedAt and so reported dead sessions as healthy).
 */
export async function validateSessionBrowserless(
    userId: string,
): Promise<{ valid: boolean; status?: number; plainId?: number; reason?: string }> {
    const bl = await getBrowserlessVoyagerContext(userId);
    if (!bl) return { valid: false, reason: 'no-session-or-proxy' };
    try {
        const r = await voyagerFetch<any>(userId, 'https://www.linkedin.com/voyager/api/me', {
            apiRequest: bl.ctx,
            skipRateLimit: true,
        });
        if (!r.ok) return { valid: false, status: (r as any).status, reason: r.error };
        const body: any = r.data;
        const plainId = body?.data?.plainId ?? body?.plainId;
        if (plainId && body?.data?.status !== 401) return { valid: true, status: r.status, plainId };
        return { valid: false, status: r.status, reason: 'no-identity-in-/me' };
    } finally {
        await bl.dispose();
    }
}
