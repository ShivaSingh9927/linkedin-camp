/**
 * The profile-visit output, whichever node produced it.
 *
 * The engine keys `storedOutputs` by NODE TYPE, and there are two profile-visit
 * implementations — the DOM one ('profile-visit') and the browser-free Voyager
 * one ('profile-visit-voyager'), which deliberately emit the same shape. Every
 * downstream consumer read only the DOM key, so any template built on the API
 * visit silently lost its enrichment: AI messages fell back to the Lead row,
 * and `{company}` / `{jobTitle}` tags resolved to empty strings in copy the
 * user had written expecting them to fill in.
 *
 * Both running in one flow is unusual but not impossible, so merge rather than
 * pick — DOM last (it has the contact-info modal and post scrape), and skip
 * null/undefined so a field the DOM pass couldn't read doesn't erase the value
 * Voyager did read.
 */
export function profileVisitOutput(storedOutputs: Record<string, any> | undefined): Record<string, any> {
    const voyager = storedOutputs?.['profile-visit-voyager'] || {};
    const dom = storedOutputs?.['profile-visit'] || {};
    const merged: Record<string, any> = { ...voyager };
    for (const [k, v] of Object.entries(dom)) {
        if (v !== null && v !== undefined) merged[k] = v;
    }
    return merged;
}
