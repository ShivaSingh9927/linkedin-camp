import type { Page } from 'playwright';

// Inspect a LinkedIn profile page (assumed already navigated to) and return
// a robust read of the lead's connection state.
//
// Why this exists: LinkedIn has shipped a new design system where every
// previous detection heuristic in this codebase is broken at runtime —
// `<button>Message</button>` no longer exists (it's an `<a href="/messaging/
// compose/...">`), class names are now random hashes, and the only stable
// anchors are URL patterns that include the lead's identity (profileUrn for
// DMs, vanity-slug for Connect).
//
// Decision basis (in priority order):
//   1. composeUrl present  →  isDmable=true   (DM allowed right now —
//                                              1st-degree OR Open Profile)
//   2. connectHref present →  needsConnect    (no compose, can send invite)
//   3. pending aria-label  →  invitePending   (invite already sent, waiting)
//   4. nothing matches     →  isUnknown       (DOM didn't render, or LinkedIn
//                                              has blocked us; caller decides)
//
// The script that proved these signals lives at
// testscripts/phase2_connection_detect.js — verified against Sandhya (1st)
// and Reid Hoffman (3rd) on production session.

export interface ConnectionState {
    composeUrl: string | null;
    connectHref: string | null;
    pendingAriaLabel: string | null;
    isDmable: boolean;
    needsConnect: boolean;
    invitePending: boolean;
    isUnknown: boolean;
}

export function extractSlug(linkedinUrl: string): string {
    return (linkedinUrl.split('/in/').pop() || '').replace(/\/+$/, '').replace(/\?.*$/, '');
}

export async function detectConnectionState(page: Page, leadLinkedinUrl: string): Promise<ConnectionState> {
    const slug = extractSlug(leadLinkedinUrl);

    // Best-effort wait for either the compose link (DMable case) or the
    // invite link bound to THIS lead's slug (unconnected case). LinkedIn
    // hydrates these after initial DOMContentLoaded.
    await Promise.race([
        page.waitForSelector('a[href*="/messaging/compose/?profileUrn"]', { state: 'attached', timeout: 15000 }).catch(() => null),
        page.waitForSelector(`a[href*="/preload/custom-invite/?vanityName=${slug}"]`, { state: 'attached', timeout: 15000 }).catch(() => null),
    ]).catch(() => null);

    const signals = await page.evaluate((s: string) => {
        const composeEl = document.querySelector('a[href*="/messaging/compose/?profileUrn"]') as HTMLAnchorElement | null;
        const composeUrl = composeEl ? composeEl.href : null;

        // Bind connect-link detection to the lead's slug so we never pick
        // up the connect link for a "People you may know" card.
        const connectEl = (document.querySelector(`a[href*="/preload/custom-invite/?vanityName=${s}"]`)
            || Array.from(document.querySelectorAll('a[href*="/preload/custom-invite/"]'))
                .find(a => /^Invite .+ to connect$/i.test(a.getAttribute('aria-label') || ''))) as HTMLAnchorElement | null;
        const connectHref = connectEl ? connectEl.getAttribute('href') : null;

        const pendingBtn = Array.from(document.querySelectorAll('button[aria-label], a[role="button"][aria-label]'))
            .find(b => /Pending|click to withdraw|Withdraw invitation/i.test(b.getAttribute('aria-label') || ''));
        const pendingAriaLabel = pendingBtn ? pendingBtn.getAttribute('aria-label') : null;

        return { composeUrl, connectHref, pendingAriaLabel };
    }, slug);

    const isDmable = !!signals.composeUrl;
    const needsConnect = !signals.composeUrl && !!signals.connectHref;
    const invitePending = !signals.composeUrl && !signals.connectHref && !!signals.pendingAriaLabel;
    const isUnknown = !isDmable && !needsConnect && !invitePending;

    return { ...signals, isDmable, needsConnect, invitePending, isUnknown };
}
