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
    // 1 | 2 | 3 | null — degree extracted from the visible badge on the
    // profile page header. Falls back to inference from the signals above
    // when the badge isn't found (isDmable → 1, needsConnect → 3).
    connectionDegree: number | null;
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

        // Degree badge on the profile page sits in the top card next to
        // the name as text "• 1st" / "• 2nd" / "• 3rd+". Scope the search
        // to the top card region (within ~3000 chars of the H1 / role=main)
        // so we don't pick up a degree token from a sidebar "People you may
        // know" entry.
        let degreeText: string | null = null;
        const main = document.querySelector('main, [role="main"]');
        if (main) {
            const topSnippet = (main.textContent || '').substring(0, 3000);
            const dm = topSnippet.match(/•\s*(1st|2nd|3rd\+?)\b/);
            if (dm) degreeText = dm[1];
        }

        return { composeUrl, connectHref, pendingAriaLabel, degreeText };
    }, slug);

    const isDmable = !!signals.composeUrl;
    const needsConnect = !signals.composeUrl && !!signals.connectHref;
    const invitePending = !signals.composeUrl && !signals.connectHref && !!signals.pendingAriaLabel;
    const isUnknown = !isDmable && !needsConnect && !invitePending;

    // Prefer the visible badge text when LinkedIn rendered it — that's
    // the ground truth. Fall back to inference from the action buttons:
    //   isDmable     → 1 (1st-degree or Open Profile, treat both as DMable)
    //   needsConnect → 3 (Connect button visible — can't distinguish 2nd
    //                     vs 3rd from the buttons alone; safe default)
    //   else         → null (unknown / pending invite — don't write garbage)
    let connectionDegree: number | null = null;
    if (signals.degreeText === '1st') connectionDegree = 1;
    else if (signals.degreeText === '2nd') connectionDegree = 2;
    else if (signals.degreeText && signals.degreeText.startsWith('3rd')) connectionDegree = 3;
    else if (isDmable) connectionDegree = 1;
    else if (needsConnect) connectionDegree = 3;

    return {
        composeUrl: signals.composeUrl,
        connectHref: signals.connectHref,
        pendingAriaLabel: signals.pendingAriaLabel,
        isDmable,
        needsConnect,
        invitePending,
        isUnknown,
        connectionDegree,
    };
}
