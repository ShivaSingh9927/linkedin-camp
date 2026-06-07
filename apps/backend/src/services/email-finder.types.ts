// Types shared between the email-finder service and its supporting modules
// (health guard, domain cache). Extracted from email-finder.service.ts so
// other modules can import without pulling in axios.

export interface FindEmailInput {
    firstName: string;
    lastName: string;
    company: string;
    jobTitle?: string;
    domain?: string;
}

export interface FindEmailResult {
    email: string | null;
    verified: boolean;
    confidence: string | null;
    isCatchAll: boolean;
    source: string | null;
    domain: string | null;
    domainConfidence: string | null;
}
