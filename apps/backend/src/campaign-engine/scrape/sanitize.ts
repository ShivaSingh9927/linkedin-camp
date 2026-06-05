/**
 * Shared guards that keep junk out of person-level text fields (jobTitle,
 * headline). LinkedIn search-result cards and the extension scrape frequently
 * mislabel non-role text — the connection-degree subtitle ("3rd+ degree
 * connection"), the person's own name, video-modal a11y text ("This is a modal
 * window."), CTA buttons ("Visit my website") — and these used to land in the
 * jobTitle column. Used by both the lead import controller and profile-visit.
 */

export function isJunkPersonField(value?: string | null, name?: string | null): boolean {
    if (!value) return true;
    const s = String(value).trim();
    if (s.length < 2) return true;
    if (name && s.toLowerCase() === String(name).trim().toLowerCase()) return true;
    return (
        /degree connection/i.test(s) || // "3rd+ degree connection"
        /modal window/i.test(s) || // "This is a modal window."
        /media could not be loaded/i.test(s) || // video-player error overlay
        /^(Beginning|End) of dialog window/i.test(s) ||
        /^\s*\d[\d,]*\s+(followers?|connections?|mutual)/i.test(s) ||
        /^(Visit my website|Contact info|Message|More|Follow|Connect|Pending|Open to|Add profile section)\b/i.test(s) ||
        /^(He\/Him|She\/Her|They\/Them)$/i.test(s)
    );
}

/** Returns the trimmed value, or null when it's junk. */
export function cleanPersonField(value?: string | null, name?: string | null): string | null {
    return isJunkPersonField(value, name) ? null : String(value).trim();
}
