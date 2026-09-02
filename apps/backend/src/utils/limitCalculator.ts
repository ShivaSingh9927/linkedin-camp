import { SubscriptionTier, LinkedinPlan } from "@prisma/client";
import { planFor } from "../config/plans";

export interface LimitResult {
    safeDailyLimit: number;
    isThrottledByLinkedIn: boolean;
}

// LinkedIn-plan ceilings are a SEPARATE axis from our SaaS tier: a user's
// LinkedIn account type (Basic/Premium/Sales Nav) caps how many invites/day is
// safe regardless of what they paid us for. The effective limit is the smaller
// of the two.
const LINKEDIN_DAILY: Record<LinkedinPlan, number> = {
    BASIC: 20,     // safe conservative average for free LinkedIn (15–25)
    PREMIUM: 35,   // (20–40)
    SALES_NAV: 40, // (40+)
};

export function getSafeDailyLimit(saasTier: SubscriptionTier, linkedinPlan: LinkedinPlan): LimitResult {
    const maxLinkedInDaily = LINKEDIN_DAILY[linkedinPlan] ?? LINKEDIN_DAILY.BASIC;

    // SaaS-side daily cap comes from the single source of truth (config/plans),
    // so PRO/ADVANCED/Business no longer fall through to 0 as they did when this
    // lived in a hand-maintained switch.
    const maxSaaSDaily = planFor(saasTier).dailyInviteCap;

    const safeDailyLimit = Math.floor(Math.min(maxLinkedInDaily, maxSaaSDaily));

    // LinkedIn is the bottleneck when it forces us below what the SaaS tier grants.
    const isThrottledByLinkedIn = maxLinkedInDaily < maxSaaSDaily;

    return { safeDailyLimit, isThrottledByLinkedIn };
}
