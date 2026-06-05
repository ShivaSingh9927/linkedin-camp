import axios from 'axios';

// The self-hosted email-finder box (Kamatera, open port 25). Resolves a
// company name -> domain, guesses permutations, and SMTP-verifies them.
// Firewalled to this backend's IP; auth via X-API-Key.
const EMAIL_FINDER_URL = process.env.EMAIL_FINDER_URL || 'http://localhost:8002';
const EMAIL_FINDER_TOKEN = process.env.EMAIL_FINDER_TOKEN || '';

export interface FindEmailInput {
    firstName: string;
    lastName: string;
    company: string;
    jobTitle?: string;
    domain?: string; // optional — service resolves from company when omitted
}

export interface FindEmailResult {
    email: string | null;
    verified: boolean;
    confidence: string | null; // high | medium | low | null
    isCatchAll: boolean;
    source: string | null; // permutation | research | research-pattern
    domain: string | null;
    domainConfidence: string | null;
}

/**
 * Ask the email-finder to find an address for a person. Returns null on any
 * transport/config error (caller treats "no email" as a soft skip, never a
 * hard failure). The service itself decides verified/unverified — the caller
 * gates on `verified` before trusting the address for sending.
 */
export async function findEmail(input: FindEmailInput): Promise<FindEmailResult | null> {
    if (!EMAIL_FINDER_TOKEN) {
        console.warn('[email-finder] EMAIL_FINDER_TOKEN not set — skipping lookup');
        return null;
    }
    if (!input.firstName || !input.lastName || !input.company) return null;

    try {
        const { data } = await axios.post(
            `${EMAIL_FINDER_URL}/email-finder/guess`,
            {
                firstName: input.firstName,
                lastName: input.lastName,
                company: input.company,
                jobTitle: input.jobTitle,
                ...(input.domain ? { domain: input.domain } : {}),
            },
            {
                headers: { 'X-API-Key': EMAIL_FINDER_TOKEN, 'Content-Type': 'application/json' },
                timeout: 150_000, // resolve + SMTP probes can take a while
            }
        );
        return {
            email: data?.email ?? null,
            verified: !!data?.verified,
            confidence: data?.confidence ?? null,
            isCatchAll: !!data?.is_catch_all,
            source: data?.source ?? null,
            domain: data?.domain ?? null,
            domainConfidence: data?.domain_confidence ?? null,
        };
    } catch (err: any) {
        console.error(`[email-finder] lookup failed: ${err?.message}`);
        return null;
    }
}
