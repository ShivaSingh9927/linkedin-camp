import { SubscriptionTier, LinkedinPlan } from "@prisma/client";

export interface LimitResult {
    safeDailyLimit: number;
    isThrottledByLinkedIn: boolean;
}

export function getSafeDailyLimit(saasTier: SubscriptionTier, linkedinPlan: LinkedinPlan): LimitResult {
    // 1. Determine the maximum allowed by their LinkedIn Plan
    let maxLinkedInDaily = 0;
    switch (linkedinPlan) {
        case 'BASIC':
            maxLinkedInDaily = 20; // safe conservative average for free tier (15-25)
            break;
        case 'PREMIUM':
            maxLinkedInDaily = 35; // (20-40)
            break;
        case 'SALES_NAV':
            maxLinkedInDaily = 40; // (40+)
            break;
    }

    // 2. Determine the maximum allowed by our SaaS Plan (assuming ~30 days avg a month)
    let maxSaaSDaily = 0;
    switch (saasTier) {
        case 'FREE':
            maxSaaSDaily = 5; // Trial
            break;
        case 'CORE':
            maxSaaSDaily = 10; // 300 / 30
            break;
        case 'PLUS':
        case 'EXPERT':
        case 'ULTIMATE':
            maxSaaSDaily = 27; // 800 / 30
            break;
    }

    // 3. Calculate the Absolute Minimum of the two
    const safeDailyLimit = Math.floor(Math.min(maxLinkedInDaily, maxSaaSDaily));

    // 4. Check if LinkedIn is the bottleneck (e.g. ULTIMATE plan but BASIC LinkedIn)
    const isThrottledByLinkedIn = maxLinkedInDaily < maxSaaSDaily;

    return {
        safeDailyLimit,
        isThrottledByLinkedIn
    };
}
