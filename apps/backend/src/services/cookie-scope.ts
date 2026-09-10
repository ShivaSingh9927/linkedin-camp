/**
 * Cookie scoping for captured browser sessions.
 *
 * `context.cookies()` returns cookies for EVERY domain the context has
 * touched, not just the one we care about. That was harmless while the login
 * browser only ever visited linkedin.com — but interactive login sends users
 * through Google/Apple/Microsoft SSO inside the same context, and those flows
 * leave full identity-provider session cookies behind (Google's SID / HSID /
 * __Secure-1PSID and friends).
 *
 * Persisting those would mean our database holds live sessions to users'
 * entire Google accounts — mail, drive, everything — to do a job that needs
 * nothing but `li_at`. Wildly disproportionate, and a breach of our side would
 * become a breach of their whole identity. So capture is scoped here, at the
 * single point every login path funnels through.
 *
 * Keeping the SSO cookies WOULD buy silent re-login when a LinkedIn session
 * dies (re-run "Continue with Google", provider still authenticated, no user
 * involvement). That convenience is real and it is not worth it: the blast
 * radius is the user's entire online identity, and they consented to us
 * automating LinkedIn.
 */

/**
 * Minimal shape we need. Deliberately NOT an index signature — that would make
 * Playwright's own Cookie type (with its narrower unions) unassignable here.
 */
export interface CapturedCookie {
    name: string;
    domain: string;
}

/** Domains whose cookies we are entitled to keep. */
const ALLOWED_SUFFIXES = ['linkedin.com', 'licdn.com'];

function isAllowedDomain(rawDomain: string): boolean {
    // Cookie domains may carry a leading dot ('.linkedin.com'); normalise it.
    const domain = (rawDomain || '').replace(/^\./, '').toLowerCase();
    return ALLOWED_SUFFIXES.some((suffix) => domain === suffix || domain.endsWith(`.${suffix}`));
    // Suffix is matched with a dot boundary so 'notlinkedin.com' can't pass.
}

/**
 * Drop every cookie that isn't LinkedIn's. Returns the kept cookies and logs
 * what was discarded, so an unexpected third-party domain in a login flow is
 * visible rather than silent.
 */
export function scopeToLinkedIn<T extends CapturedCookie>(cookies: T[], context: string): T[] {
    const kept: T[] = [];
    const droppedDomains = new Set<string>();

    for (const cookie of cookies) {
        if (isAllowedDomain(cookie.domain)) kept.push(cookie);
        else droppedDomains.add((cookie.domain || 'unknown').replace(/^\./, ''));
    }

    if (droppedDomains.size > 0) {
        console.log(
            `[COOKIE-SCOPE] ${context}: kept ${kept.length} LinkedIn cookies, dropped ` +
            `${cookies.length - kept.length} from ${[...droppedDomains].join(', ')} (not ours to store)`
        );
    }
    return kept;
}

/**
 * Scrub non-LinkedIn cookies from the LIVE browser profile.
 *
 * Filtering what we export is not enough: the login browser runs under
 * `launchPersistentContext`, so Chromium writes its own cookie store into the
 * session directory on disk (and that path is kept as
 * User.persistentSessionPath). Without this, an SSO login would leave the
 * user's Google session sitting in our filesystem even though we never
 * exported it.
 *
 * Best-effort by design — a failure here must never sink a successful login,
 * but it is logged loudly because it means third-party cookies survived.
 */
export async function purgeNonLinkedInCookies(
    browserContext: any,
    keep: CapturedCookie[],
    label: string
): Promise<void> {
    try {
        await browserContext.clearCookies();
        if (keep.length > 0) await browserContext.addCookies(keep as any[]);
        console.log(`[COOKIE-SCOPE] ${label}: profile scrubbed to ${keep.length} LinkedIn cookies`);
    } catch (e: any) {
        console.error(
            `[COOKIE-SCOPE] ⚠️  ${label}: failed to scrub the persistent profile (${e?.message}) — ` +
            `third-party cookies may remain on disk at the session path.`
        );
    }
}
