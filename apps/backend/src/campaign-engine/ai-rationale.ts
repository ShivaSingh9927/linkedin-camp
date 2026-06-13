/**
 * Deterministic "why this message" rationale.
 *
 * Assembled at send time from the personalization signals that were ACTUALLY
 * available to the AI when it wrote the message — the lead's recent post, their
 * role/company, the user's top messaging pillar, the ICP pain, and where the
 * lead sits in the sequence. No extra LLM call, no latency, and it never claims
 * more than was true (it lists what the model was given, not what it "chose").
 *
 * Surfaced in the campaign Messages tab so the user can see, per message, that
 * the AI did its homework on both the lead and their own business strategy.
 */

export interface RationaleInput {
    latestPost?: string | null;
    company?: string | null;
    jobTitle?: string | null;
    headline?: string | null;
    about?: string | null;
    aiStrategy?: any;
    campaignProgress?: {
        stepNumber?: number;
        totalSteps?: number;
        completedSteps?: Array<any>;
    } | null;
}

export function buildRationale(input: RationaleInput): string | undefined {
    const parts: string[] = [];

    if (input.latestPost && input.latestPost.trim().length > 20) {
        parts.push('referenced their recent LinkedIn post');
    }

    if (input.jobTitle && input.company) {
        parts.push(`their role as ${input.jobTitle} at ${input.company}`);
    } else if (input.company) {
        parts.push(`their company ${input.company}`);
    } else if (input.jobTitle) {
        parts.push(`their role as ${input.jobTitle}`);
    } else if (input.headline) {
        parts.push('their headline');
    }

    if (input.about && input.about.trim().length > 30) {
        parts.push('their profile background');
    }

    // Strategy signals — proof the message is tied to the user's own GTM, not
    // a generic template.
    const pillar = Array.isArray(input.aiStrategy?.messagingPillars)
        ? input.aiStrategy.messagingPillars[0]?.pillar
        : undefined;
    if (pillar) {
        parts.push(`your "${pillar}" angle`);
    }

    const pain = input.aiStrategy?.icp?.primary?.painPoints?.[0];
    if (pain) {
        parts.push(`the ICP pain "${pain}"`);
    }

    if (parts.length === 0) return undefined;

    const cp = input.campaignProgress;
    const isFollowUp = !!(cp && Array.isArray(cp.completedSteps) && cp.completedSteps.length > 0);
    let prefix = 'Personalized using ';
    if (isFollowUp && cp?.stepNumber && cp?.totalSteps) {
        prefix = `Follow-up (step ${cp.stepNumber} of ${cp.totalSteps}) — kept distinct from earlier touches and personalized using `;
    }

    // Join as a readable list: "a, b and c".
    let list: string;
    if (parts.length === 1) {
        list = parts[0];
    } else {
        list = parts.slice(0, -1).join(', ') + ' and ' + parts[parts.length - 1];
    }

    return prefix + list + '.';
}
