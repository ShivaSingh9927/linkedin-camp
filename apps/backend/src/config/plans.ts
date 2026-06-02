// Plan-tier limits. Keep these in one place so product changes are a single
// edit. Free users get a tight cap so their first campaign finishes in ~3
// days (50 leads × 3 steps ÷ 58 actions/day) — that proves out the loop
// before they need to think about scale. Paid tiers get ~10-day campaigns.
//
// SubscriptionTier values come from prisma schema: FREE | CORE | PRO |
// ADVANCED | PLUS | EXPERT. Anything that isn't FREE counts as paid.

export const LEAD_CAP_FREE = 50;
export const LEAD_CAP_PAID = 200;

export function leadCapForTier(tier: string | null | undefined): number {
    return tier === 'FREE' || !tier ? LEAD_CAP_FREE : LEAD_CAP_PAID;
}
