import { TemplateDefinition } from './types';
import { warmDM } from './shapes';

export const agencyPastClientReactivationTemplate: TemplateDefinition = {
    id: 'agency-past-client-reactivation',
    name: 'Past-Client Reactivation',
    description:
        'Re-engage former clients on your 1st-degree network with a new offer or capability. Two-message sequence that leads with what is different on your end, then asks about their current priorities.',
    useCase: 'Agency reactivating past clients to upsell a new service line or restart a paused engagement.',
    bestFor:
        'Best for: agencies upselling new services to existing clients. Also useful for: consultants returning after a sabbatical, contractors with a new specialty.',
    recommendedFor: [
        'Agencies launching a new service line',
        'Consultants returning to active practice',
        'Anyone with a strong 1st-degree client list',
    ],
    group: 'my-network',
    category: 'linkedin',
    audience: 'connected',
    icp: 'agency',
    icon: '🔁',
    color: 'from-fuchsia-500 to-pink-600',
    durationDays: 9,
    stepCount: 4,
    delayCount: 2,
    aiStrategyHint: {
        objective:
            'Reopen a past-client relationship by sharing a substantive update and inviting a low-pressure check-in.',
        description:
            'Lead with appreciation for the prior engagement, then state the specific change on your end (new capability, productized offer, team addition). The second message should ask one direct question about their roadmap. Avoid template-feel — use detail from the prior project.',
        cta: 'reopen the conversation',
        toneOverride: 'warm',
    },
    workflow: warmDM({ beforeFirstMsgDays: 2, betweenMsgsDays: 7, messageCount: 2 }),
};
