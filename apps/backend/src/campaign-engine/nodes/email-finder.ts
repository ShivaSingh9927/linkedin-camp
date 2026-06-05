import { NodeHandler, NodeResult } from '../types';
import { prisma } from '@repo/db';
import { findEmail } from '../../services/email-finder.service';

/**
 * EMAIL_FINDER — resolves a sendable email for the lead.
 *
 * Priority (cheapest + most authoritative first):
 *   1. profile-visit email — LinkedIn's contact-info card. The REAL address
 *      (people who made it public, or 1st-degree connections post-accept).
 *      Always wins; persisted by updateLeadEnrichment, so a later profile-visit
 *      after a connection is accepted naturally REPLACES a guessed email.
 *   2. lead.email — already on the row (prior enrichment / import).
 *   3. external email-finder box — ONLY when we have nothing above. Resolves
 *      company -> domain, guesses + SMTP-verifies. We trust its result for
 *      sending ONLY when verified; unverified guesses are surfaced as a
 *      non-sending `suggestedEmail` so we never email the wrong person.
 *
 * Writes storedOutputs['email-finder'].email = the sendable address (null when
 * we only have an unverified guess) so the EMAIL node's recipient gate holds.
 */
export const emailFinder: NodeHandler = async (ctx): Promise<NodeResult> => {
    const { lead, storedOutputs } = ctx;

    const pvEmail = (storedOutputs['profile-visit']?.email as string | undefined) || null;
    const leadEmail = lead.email || null;

    // 1 + 2: we already have a real/known email — use it, don't call the box.
    if (pvEmail || leadEmail) {
        const email = pvEmail || leadEmail;
        const source = pvEmail ? 'profile-visit' : 'lead';
        console.log(`[EMAIL-FINDER] Have ${email} for ${lead.firstName} (from ${source}) — no lookup needed`);
        return { success: true, output: { email, source, verified: true, found: true } };
    }

    // 3: nothing on file — try the external finder, if we have a company.
    const company =
        (storedOutputs['profile-visit']?.company as string | undefined) || lead.company || null;
    if (!company) {
        console.log(`[EMAIL-FINDER] No email and no company for ${lead.firstName || lead.linkedinUrl} — cannot search.`);
        return { success: true, output: { email: null, source: null, found: false, reason: 'no_company' } };
    }

    console.log(`[EMAIL-FINDER] No email on file — searching for ${lead.firstName} ${lead.lastName} @ ${company}`);
    const result = await findEmail({
        firstName: lead.firstName || '',
        lastName: lead.lastName || '',
        company,
        jobTitle: (storedOutputs['profile-visit']?.jobTitle as string | undefined) || lead.jobTitle || undefined,
    });

    if (!result || !result.email) {
        console.log(`[EMAIL-FINDER] No email found for ${lead.firstName}.`);
        return { success: true, output: { email: null, source: null, found: false } };
    }

    // Verified -> trust it for sending and persist to the Lead row (only if
    // still empty, so a real LinkedIn email later can overwrite it).
    if (result.verified) {
        await prisma.lead
            .update({ where: { id: lead.id }, data: { email: result.email } })
            .catch((err: any) => console.log(`[EMAIL-FINDER] persist failed: ${err.message}`));
        console.log(`[EMAIL-FINDER] Verified ${result.email} (${result.confidence}) via finder — saved.`);
        return {
            success: true,
            output: {
                email: result.email,
                source: 'finder',
                verified: true,
                confidence: result.confidence,
                domain: result.domain,
                found: true,
            },
        };
    }

    // Unverified / catch-all guess — DO NOT send to it. Surface as a suggestion
    // for visibility; email stays null so the EMAIL node skips.
    console.log(`[EMAIL-FINDER] Unverified guess ${result.email} (catchAll=${result.isCatchAll}) — held back, not sending.`);
    return {
        success: true,
        output: {
            email: null,
            suggestedEmail: result.email,
            source: 'finder',
            verified: false,
            confidence: result.confidence,
            isCatchAll: result.isCatchAll,
            domain: result.domain,
            found: false,
        },
    };
};
