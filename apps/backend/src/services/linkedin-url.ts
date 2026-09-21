// linkedin-url.ts
//
// One canonical form for a LinkedIn profile URL, used by every store that keys
// on it (Lead.linkedinUrl, SeenProfile) so dedup lines up across all of them.
//
// This exists because the same person arrives spelled several ways:
//   • the extension and in-app search return  https://www.linkedin.com/in/x
//   • public search engines return            https://in.linkedin.com/in/X/
//   • tracking params ride along              .../in/x?trk=public_profile
// Before this, only query/hash/trailing-slash were stripped, so a lead found
// via a country subdomain imported as a SECOND lead alongside one already in
// the database.
//
// The profile slug is the identity; the host and decorations are not.

/** Extract the lowercase profile slug, or null if this isn't a /in/ URL. */
export function profileSlug(raw?: string | null): string | null {
    if (!raw) return null;
    const m = String(raw)
        .trim()
        .match(/^(?:https?:\/\/)?(?:[a-z0-9-]+\.)*linkedin\.com\/in\/([^/?#\s]+)/i);
    if (!m) return null;
    const slug = decodeURIComponent(m[1]).trim();
    if (!slug || slug.length > 100) return null;
    return slug.toLowerCase();
}

/**
 * Canonical storage form. Profile URLs collapse to
 * `https://www.linkedin.com/in/<lowercase-slug>`; anything that isn't a
 * recognisable profile URL keeps the old conservative treatment (strip
 * query/hash/trailing slash) rather than being dropped.
 */
export function normalizeLinkedinUrl(raw?: string): string {
    if (!raw) return raw || '';
    const slug = profileSlug(raw);
    if (slug) return `https://www.linkedin.com/in/${slug}`;
    return raw.trim().split('?')[0].split('#')[0].replace(/\/+$/, '');
}
