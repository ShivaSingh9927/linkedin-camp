import { TemplateDefinition } from './types';
import { multiChannelDrip } from './shapes';

export const founderEarlyCustomerOutreachTemplate: TemplateDefinition = {
    id: 'founder-early-customer-outreach',
    name: 'Early Customer Outreach',
    description:
        'LinkedIn-first multi-channel sequence to land your first 10 paying customers. Connect, message, then email as fallback. AI personalizes each touch with the lead\'s headline and your value prop.',
    useCase: 'Founder selling to a sharp ICP and willing to do hand-rolled outreach to close the first cohort.',
    bestFor:
        'Best for: founders post-design-partner phase, opening up paid pilots. Also useful for: PMM running a private beta, indie hackers selling annual licenses.',
    recommendedFor: [
        'Seed-stage founders selling first contracts',
        'Indie hackers running quarterly launches',
        'Operators reactivating a waitlist with a real offer',
    ],
    group: 'out-of-network',
    category: 'multi-channel',
    audience: 'cold',
    icp: 'founder',
    icon: '🚀',
    color: 'from-orange-500 to-red-500',
    durationDays: 12,
    stepCount: 8,
    delayCount: 3,
    requires: ['email-finder', 'email'],
    aiStrategyHint: {
        objective:
            'Convert a cold ICP-fit prospect into a paid pilot conversation by stacking LinkedIn and email touches that each add new value, never repeat.',
        description:
            'LinkedIn message references one specific aspect of their work; the email expands with a concrete outcome you have delivered for someone similar; both end with a single-question CTA, not a meeting link. The two channels must not feel like the same person sending the same pitch twice.',
        cta: 'book a 20-min pilot scoping call',
        toneOverride: 'direct',
    },
    workflow: multiChannelDrip({ beforeConnectDays: 2, afterAcceptDays: 4, beforeEmailDays: 6 }),
};
