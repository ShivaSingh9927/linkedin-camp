import { TemplateDefinition } from './types';
import { coldInvite } from './shapes';

export const saasTrialActivationTemplate: TemplateDefinition = {
    id: 'saas-trial-activation',
    name: 'Trial Activation',
    description:
        'Turn free-trial signups into active, paying users with a founder-led LinkedIn touch. A warm "thanks for trying us" invite, a low-pressure offer to help them get set up, then a nudge toward the feature that drives the aha moment. Product-led growth, but human.',
    useCase: 'New self-serve trial or freemium signups you want to activate before the trial lapses — driven by a real person, not just lifecycle email.',
    bestFor:
        'Best for: founders and PLG teams personally onboarding early users. Also useful for: customer-success reps rescuing stalled trials, indie SaaS owners closing annual plans.',
    recommendedFor: [
        'Founders personally onboarding trial users',
        'PLG / growth teams lifting trial→paid conversion',
        'Customer success rescuing stalled trials',
    ],
    group: 'action-triggered',
    category: 'linkedin',
    audience: 'cold',
    icp: 'founder',
    icon: '🎯',
    color: 'from-violet-500 to-purple-600',
    durationDays: 11,
    stepCount: 7,
    delayCount: 4,
    aiStrategyHint: {
        objective:
            'Help a new trial user reach their activation moment and feel personally supported, so the trial converts to a paid plan — without sounding like an automated upsell.',
        description:
            'The invite thanks them genuinely for trying the product and offers help, no ask. The first message is purely about getting them unstuck (offer a setup tip or a quick Loom), referencing the specific value they likely signed up for. The next touch points them at the one feature or action that correlates with becoming a paying user — framed as "most people who get value do X". A final, optional nudge can surface a time-bound reason to upgrade. Stay in helpful-founder voice throughout; pressure kills activation.',
        cta: 'help them activate and move toward a paid plan',
        toneOverride: 'friendly',
    },
    workflow: coldInvite({ beforeConnectDays: 1, afterAcceptDays: 2, betweenMsgsDays: 4, messageCount: 3 }),
};
