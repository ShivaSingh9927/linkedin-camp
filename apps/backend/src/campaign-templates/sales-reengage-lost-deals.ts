import { TemplateDefinition } from './types';
import { reactivation } from './shapes';

export const salesReengageLostDealsTemplate: TemplateDefinition = {
    id: 'sales-reengage-lost-deals',
    name: 'Re-engage Lost Deals',
    description:
        'Revive closed-lost or stalled opportunities on your existing network. Visit, like a recent post, wait, then send an AI-crafted reconnect message that references a real change in your product or market.',
    useCase: 'Sales team running win-back motions against dormant 1st-degree prospects.',
    bestFor:
        'Best for: AEs reviving last-quarter\'s closed-lost list. Also useful for: customer success doing churn win-back, founders bringing back lapsed waitlist users.',
    recommendedFor: [
        'AEs running quarterly win-back motions',
        'CS reps reactivating churned accounts',
        'Founders nurturing a stale CRM',
    ],
    group: 'my-network',
    category: 'linkedin',
    audience: 'connected',
    icp: 'sales',
    icon: '♻️',
    color: 'from-amber-500 to-orange-600',
    durationDays: 6,
    stepCount: 6,
    delayCount: 2,
    aiStrategyHint: {
        objective:
            'Bring a dormant relationship back into conversation by leading with a concrete update on your side, then asking a low-stakes question.',
        description:
            'Acknowledge the gap directly — no "just circling back". The first message should name what has changed since you last spoke (a new feature, a customer outcome, a market shift). The follow-up should ask whether the original pain is still on their radar. Never re-pitch the same thing they already passed on.',
        cta: 'restart the conversation',
        toneOverride: 'familiar',
    },
    workflow: reactivation({ beforeFirstMsgDays: 1, betweenMsgsDays: 5, messageCount: 2 }),
};
