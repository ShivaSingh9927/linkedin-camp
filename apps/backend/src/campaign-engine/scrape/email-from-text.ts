/**
 * Extract a self-published email from a profile's free text (headline / about /
 * summary). People frequently put a contact email right in their bio
 * (e.g. "...share your resume at jane@acme.com" or "📧 jane.doe@corp.com").
 *
 * Unlike LinkedIn's Contact-info card — which LinkedIn gates to 1st-degree
 * connections only — this text is returned for EVERY connection degree (the
 * Voyager FullProfile headline/summary, or the DOM top-card/about), so it's a
 * free, real, self-declared address available even for cold 3rd-degree leads.
 * It is therefore the cheapest and most authoritative email source we have,
 * ahead of any guess from the external finder.
 */

const EMAIL_RE = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;

// Generic/role inboxes — not the person's own address, so skip them.
const ROLE_PREFIX_RE =
    /^(info|contact|hello|hi|support|admin|office|help|sales|hr|careers?|jobs|team|general|enquir(?:y|ies)|feedback|noreply|no-reply|press|media|marketing|billing|legal|abuse|postmaster|webmaster)@/i;

// Image/asset extensions that the regex can falsely match (e.g. "logo@2x.png").
const ASSET_DOMAIN_RE = /\.(png|jpe?g|gif|svg|webp|bmp|ico)$/i;

/**
 * Returns the first plausible personal email found across the given texts,
 * in argument order (so pass the most authoritative source first), or null.
 */
export function extractEmailFromText(...texts: (string | null | undefined)[]): string | null {
    for (const t of texts) {
        if (!t) continue;
        const matches = t.match(EMAIL_RE);
        if (!matches) continue;
        for (const raw of matches) {
            const e = raw.toLowerCase().replace(/[.,;:)\]>]+$/, '');
            const [local, domain] = e.split('@');
            if (!local || local.length < 2 || !domain) continue;
            if (!/\.[a-z]{2,}$/.test(domain)) continue;
            if (ASSET_DOMAIN_RE.test(domain)) continue;
            if (ROLE_PREFIX_RE.test(e)) continue;
            return e;
        }
    }
    return null;
}
