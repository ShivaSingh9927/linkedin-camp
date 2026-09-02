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
//     Business  → ADVANCED
// The enum still carries three legacy values (PLUS/EXPERT/ULTIMATE) from an
// earlier 7-tier design; they alias to Business so no data migration is needed.
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
}

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
    features: { crmSync: false, multichannel: false, team: false, copilot: 'limited', templates: 'starter' },
    supportSla: 'community',
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
    features: { crmSync: true, multichannel: false, team: false, copilot: 'full', templates: 'all' },
    supportSla: 'email-48h',
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
    features: { crmSync: true, multichannel: false, team: true, copilot: 'full', templates: 'all' },
    supportSla: 'priority-4h',
};

const BUSINESS: Plan = {
    key: 'ADVANCED',
    label: 'Business',
    monthlyInvites: 500,
    dailyInviteCap: SAFETY_DAILY_CONNECT,
    dailyMessageCap: SAFETY_DAILY_MESSAGE,
    leadsStored: 5000,
    emailFinderCredits: 500,
    emailFinderRecurring: true,
    features: { crmSync: true, multichannel: true, team: true, copilot: 'full', templates: 'all' },
    supportSla: 'priority-4h',
};

// Every enum value resolves to a Plan. Legacy PLUS/EXPERT/ULTIMATE map to
// Business so old rows and any future top-tier naming keep working.
const PLANS: Record<SubscriptionTier, Plan> = {
    FREE,
    CORE,
    PRO,
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
