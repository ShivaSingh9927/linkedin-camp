import { DAILY_CAPS } from './quota';

// Roughly what a campaign costs per lead: invite (connect) + 1-2 follow-up
// messages on average. Some sequences are message-only (no invite). Treat
// 2.5 as the conservative blended average for ETA — leans toward
// over-estimating, which is what we want for user expectation-setting.
const AVG_ACTIONS_PER_LEAD = 2.5;
const BUSINESS_DAYS_PER_WEEK = 5;

export interface CampaignEta {
    estimatedActions: number;
    dailyBudget: number;
    businessDays: number;
    calendarDays: number;
    completionDate: Date;
}

/**
 * Estimate when a campaign will finish, given a lead count.
 *
 * Math: total actions = leads × avg-actions-per-lead. Divide by the safe
 * daily LinkedIn budget (invites + messages summed) to get business days,
 * then translate to calendar days at 5/7 working ratio.
 *
 * This is intentionally rough — real campaigns drift due to reply
 * branches, deferrals, working-hour windows. The point is to set
 * expectations, not promise a delivery date.
 */
export function estimateCampaignEta(leadCount: number, fromDate: Date = new Date()): CampaignEta {
    const dailyBudget = (DAILY_CAPS['connect'] ?? 0) + (DAILY_CAPS['send-message'] ?? 0);
    const estimatedActions = Math.ceil(leadCount * AVG_ACTIONS_PER_LEAD);
    const businessDays = Math.max(1, Math.ceil(estimatedActions / Math.max(1, dailyBudget)));
    const calendarDays = Math.ceil(businessDays * (7 / BUSINESS_DAYS_PER_WEEK));

    const completionDate = new Date(fromDate.getTime() + calendarDays * 24 * 60 * 60 * 1000);

    return { estimatedActions, dailyBudget, businessDays, calendarDays, completionDate };
}
