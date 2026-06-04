import { TemplateDefinition } from './types';
import { multiChannelDrip } from './shapes';

export const salesEnterpriseMultiThreadTemplate: TemplateDefinition = {
    id: 'sales-enterprise-multi-thread',
    name: 'Enterprise Multi-Thread',
    description:
        'Designed to run against multiple buyers inside one account: LinkedIn first (champion or user level), then email (decision-maker level) as fallback. The AI keeps messaging consistent across threads while varying angle per role.',
    useCase: 'Enterprise AE working a named-account list and threading multiple personas per account.',
    bestFor:
        'Best for: enterprise AEs running named-account selling. Also useful for: partnership leads at platform companies, customer success expansion plays.',
    recommendedFor: [
        'Enterprise AEs running ABM',
        'AEs working a 50-account list',
        'CS reps expanding inside an existing customer logo',
    ],
    group: 'out-of-network',
    category: 'multi-channel',
    audience: 'cold',
    icp: 'sales',
    icon: '🏢',
    color: 'from-slate-500 to-zinc-700',
    durationDays: 9,
    stepCount: 8,
    delayCount: 3,
    requires: ['email-finder', 'email'],
    aiStrategyHint: {
        objective:
            'Open multiple coordinated threads inside a target account so the buying conversation can converge across roles.',
        description:
            'Vary the angle by role inferred from the headline: champions/users get an outcome story, managers get a metric story, executives get a strategic frame. LinkedIn is for relationship-building, email is for the explicit CTA. Avoid pitching the platform — pitch the change-of-state it creates.',
        cta: 'request 25-min exploratory call',
        toneOverride: 'executive',
    },
    workflow: multiChannelDrip({ beforeConnectDays: 1, afterAcceptDays: 3, beforeEmailDays: 5 }),
};
