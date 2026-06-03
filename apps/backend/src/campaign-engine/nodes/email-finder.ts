import { NodeHandler, NodeResult } from '../types';

/**
 * EMAIL_FINDER — surfaces whatever email profile-visit already
 * harvested from LinkedIn's contact-info modal (only visible when
 * the lead is a 1st-degree connection, or when they've made it
 * public). Writes it under storedOutputs['email-finder'].email so
 * downstream IF_ELSE conditions like `email-finder.email is_not_null`
 * branch correctly, and the EMAIL node picks the right recipient.
 *
 * No external provider call today. When profile-visit didn't return
 * an email (LinkedIn hid it), we return null and the IF_ELSE takes
 * the false branch — same behavior as a failed Hunter.io lookup.
 *
 * Future: when we wire Hunter.io / Snov.io / Dropcontact, this
 * handler becomes the dispatch point. The contract (storedOutputs
 * key + return shape) stays identical.
 */
export const emailFinder: NodeHandler = async (ctx): Promise<NodeResult> => {
    const { lead, storedOutputs } = ctx;

    // Prefer a fresh profile-visit harvest from earlier in the same
    // workflow over the Lead row, since profile-visit re-scrapes and
    // the Lead row may carry stale enrichment from a prior campaign.
    const pvEmail = (storedOutputs['profile-visit']?.email as string | undefined) || null;
    const leadEmail = lead.email || null;
    const email = pvEmail || leadEmail;

    const source = pvEmail ? 'profile-visit' : leadEmail ? 'lead' : null;

    if (!email) {
        console.log(`[EMAIL-FINDER] No email found for ${lead.firstName || lead.linkedinUrl}.`);
        return {
            success: true,
            output: { email: null, source: null, found: false },
        };
    }

    console.log(`[EMAIL-FINDER] Found ${email} for ${lead.firstName} (from ${source})`);
    return {
        success: true,
        output: { email, source, found: true },
    };
};
