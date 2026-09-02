// ─────────────────────────────────────────────────────────────────────────────
// PLANS — the single source of truth for subscription-tier limits & features.
//
// Before this file, "what can a user on tier X do?" was answered in FOUR places
// that had silently drifted apart (quota daily caps, this file's binary lead
// cap, limitCalculator's per-tier switch with PRO/ADVANCED falling through to 0,
// and an ad-hoc ternary in linkedin.worker). Everything now derives from PLANS.
//
// Marketing names → stored enum (packages/db SubscriptionTier):
//     Free      → FREE
//     Core      → CORE
//     Pro       → PRO
//     Business  → BUSINESS
// The enum also carries legacy values (ADVANCED/PLUS/EXPERT/ULTIMATE) from an
// earlier 7-tier design; they alias to Business so old rows keep resolving.
//
// ENFORCEMENT NOTE: the *quantitative entitlements* here (monthlyInvites, the
// tier-derived daily caps) only bite when ENFORCE_TIER_QUOTAS=1 (see quota.ts).
// Until billing exists to assign a paid tier, every real user is FREE by
// default — hard-enforcing would throttle live/test accounts. Flag stays OFF in
// prod until billing lands; the config is still the source of truth for lead
// caps (always on, only ever loosens) and for all display/copilot surfaces.
// ─────────────────────────────────────────────────────────────────────────────
import { SubscriptionTier } from '@prisma/client';

export interface PlanFeatures {
    /** Sync leads to HubSpot / Pipedrive / Notion. */
    crmSync: boolean;
    /** Cold email + LinkedIn-and-email multichannel campaigns. */
    multichannel: boolean;
    /** Team workspace / shared leads / per-seat collaboration. */
    team: boolean;
    /** Public API + webhooks (n8n / Zapier / Make). */
    api: boolean;
    /** Copilot depth: 'limited' = lead-search only; 'full' = whole activation flow. */
    copilot: 'limited' | 'full';
    /** Template library: 'starter' = the 4–5 simple ones; 'all' = the full 43. */
    templates: 'starter' | 'all';
}

export interface Plan {
    /** Canonical enum value stored on User.tier. */
    key: SubscriptionTier;
    /** Buyer-facing name. */
    label: string;
    /** LinkedIn invite entitlement per CALENDAR MONTH (the tier lever). */
    monthlyInvites: number;
    /** Safe per-day connect ceiling — never above LinkedIn's cliff. */
    dailyInviteCap: number;
    /** Safe per-day message ceiling (account protection, flat across tiers). */
    dailyMessageCap: number;
    /** Max leads a user may store/import. */
    leadsStored: number;
    /** Email-finder credits (per month, unless emailFinderRecurring is false). */
    emailFinderCredits: number;
    /** false = the credits are a one-time grant (Free), not a monthly refill. */
    emailFinderRecurring: boolean;
    features: PlanFeatures;
    supportSla: string;
    /** Display prices for the pricing page (single source of truth). Two price
     *  books (India ₹ = PPP, Global $ = Western WTP), NOT a currency conversion.
     *  annualPerMonth = the monthly-equivalent when billed yearly (2 months free);
     *  annualTotal = the full yearly charge. Free = all zeros. */
    pricing: {
        inr: { monthly: number; annualPerMonth: number; annualTotal: number };
        usd: { monthly: number; annualPerMonth: number; annualTotal: number };
    };
}

export type BillingCycle = 'MONTHLY' | 'ANNUAL';

// Flat account-safety ceilings. Tier daily caps are min()'d against these so a
// tier can never raise an account above what LinkedIn tolerates.
export const SAFETY_DAILY_CONNECT = 18;
export const SAFETY_DAILY_MESSAGE = 40;

const FREE: Plan = {
    key: 'FREE',
    label: 'Free',
    monthlyInvites: 80, // ~20/week
    dailyInviteCap: 5,
    dailyMessageCap: SAFETY_DAILY_MESSAGE,
    leadsStored: 100,
    emailFinderCredits: 10,
    emailFinderRecurring: false, // one-time taste
    features: { crmSync: false, multichannel: false, team: false, api: false, copilot: 'limited', templates: 'starter' },
    supportSla: 'community',
    pricing: { inr: { monthly: 0, annualPerMonth: 0, annualTotal: 0 }, usd: { monthly: 0, annualPerMonth: 0, annualTotal: 0 } },
};

const CORE: Plan = {
    key: 'CORE',
    label: 'Core',
    monthlyInvites: 300,
    dailyInviteCap: 14, // ~300/22 working days, under the safety ceiling
    dailyMessageCap: SAFETY_DAILY_MESSAGE,
    leadsStored: 1500,
    emailFinderCredits: 100,
    emailFinderRecurring: true,
    features: { crmSync: true, multichannel: false, team: false, api: false, copilot: 'full', templates: 'all' },
    supportSla: 'email-48h',
    pricing: { inr: { monthly: 399, annualPerMonth: 333, annualTotal: 3990 }, usd: { monthly: 19, annualPerMonth: 16, annualTotal: 190 } },
};

const PRO: Plan = {
    key: 'PRO',
    label: 'Pro',
    monthlyInvites: 500, // capped at what ~18/day safely delivers
    dailyInviteCap: SAFETY_DAILY_CONNECT,
    dailyMessageCap: SAFETY_DAILY_MESSAGE,
    leadsStored: 2500,
    emailFinderCredits: 300,
    emailFinderRecurring: true,
    features: { crmSync: true, multichannel: false, team: true, api: true, copilot: 'full', templates: 'all' },
    supportSla: 'priority-4h',
    pricing: { inr: { monthly: 1199, annualPerMonth: 999, annualTotal: 11990 }, usd: { monthly: 49, annualPerMonth: 41, annualTotal: 490 } },
};

const BUSINESS: Plan = {
    key: 'BUSINESS',
    label: 'Business',
    monthlyInvites: 500,
    dailyInviteCap: SAFETY_DAILY_CONNECT,
    dailyMessageCap: SAFETY_DAILY_MESSAGE,
    leadsStored: 5000,
    emailFinderCredits: 500,
    emailFinderRecurring: true,
    features: { crmSync: true, multichannel: true, team: true, api: true, copilot: 'full', templates: 'all' },
    supportSla: 'priority-4h',
    pricing: { inr: { monthly: 1699, annualPerMonth: 1416, annualTotal: 16990 }, usd: { monthly: 69, annualPerMonth: 58, annualTotal: 690 } },
};

// Every enum value resolves to a Plan. Legacy ADVANCED/PLUS/EXPERT/ULTIMATE map
// to Business so old rows and any future top-tier naming keep working.
const PLANS: Record<SubscriptionTier, Plan> = {
    FREE,
    CORE,
    PRO,
    BUSINESS,
    ADVANCED: BUSINESS,
    PLUS: BUSINESS,
    EXPERT: BUSINESS,
    ULTIMATE: BUSINESS,
};

/** The four buyer-facing plans, in display order. */
export const ACTIVE_PLANS: Plan[] = [FREE, CORE, PRO, BUSINESS];

/** Resolve a user's tier (nullable) to its Plan. Unknown/absent → Free. */
export function planFor(tier: SubscriptionTier | string | null | undefined): Plan {
    if (tier && tier in PLANS) return PLANS[tier as SubscriptionTier];
    return FREE;
}

/** Whether a tier includes a given boolean feature. */
export function tierAllows(tier: SubscriptionTier | string | null | undefined, feature: keyof PlanFeatures): boolean {
    const v = planFor(tier).features[feature];
    return v === true; // string-valued features (copilot/templates) are not booleans
}

// ── Back-compat shims (keep existing call sites working) ──────────────────────
export const LEAD_CAP_FREE = FREE.leadsStored;
export const LEAD_CAP_PAID = CORE.leadsStored; // lowest paid; real cap comes from planFor

/** Max leads a user on this tier may store. */
export function leadCapForTier(tier: SubscriptionTier | string | null | undefined): number {
    return planFor(tier).leadsStored;
}

// ── Razorpay price catalog (Phase 1) ─────────────────────────────────────────
// One Razorpay Plan ID per paid tier × billing cycle, created in the Razorpay
// dashboard and supplied via env (keeps price IDs out of source and lets test
// vs live use different plans). Naming: RAZORPAY_PLAN_<TIERLABEL>_<CYCLE>, e.g.
// RAZORPAY_PLAN_CORE_MONTHLY, RAZORPAY_PLAN_BUSINESS_ANNUAL. Free has no plan.
export function razorpayPlanId(
    tier: SubscriptionTier | string | null | undefined,
    cycle: BillingCycle,
): string | null {
    const plan = planFor(tier);
    if (plan.key === 'FREE') return null;
    const envKey = `RAZORPAY_PLAN_${plan.label.toUpperCase()}_${cycle}`;
    return process.env[envKey] || null;
}
