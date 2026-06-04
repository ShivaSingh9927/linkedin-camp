import { TemplateDefinition } from './types';
import { multiChannelDrip } from './shapes';

export const recruiterHiringFunnelDripTemplate: TemplateDefinition = {
    id: 'recruiter-hiring-funnel-drip',
    name: 'Hiring Funnel Drip',
    description:
        'Multi-channel sourcing — LinkedIn first, then email when the candidate goes quiet on LinkedIn. AI keeps the role pitch consistent across channels but varies the angle.',
    useCase: 'Recruiter running a steady pipeline against multiple roles and wanting email as a fallback channel.',
    bestFor:
        'Best for: recruiters running multi-role pipelines. Also useful for: talent agencies, executive search, embedded recruiters at fast-growth companies.',
    recommendedFor: [
        'In-house TA running multiple reqs',
        'Executive search consultants',
        'Embedded / fractional recruiters',
    ],
    group: 'out-of-network',
    category: 'multi-channel',
    audience: 'cold',
    icp: 'recruiter',
    icon: '🎣',
    color: 'from-purple-500 to-fuchsia-600',
    durationDays: 7,
    stepCount: 8,
    delayCount: 3,
    requires: ['email-finder', 'email'],
    aiStrategyHint: {
        objective:
            'Move passive candidates from awareness to an exploratory call by following up across channels without becoming a nuisance.',
        description:
            'Each touch must add new information, never repeat the role pitch. LinkedIn message is short and warm. Email expands with comp range, team context, and an explicit "if not now, when?". Both channels close with respect for their current role.',
        cta: 'book a 20-min role chat',
        toneOverride: 'respectful',
    },
    workflow: multiChannelDrip({ beforeConnectDays: 1, afterAcceptDays: 2, beforeEmailDays: 4 }),
};
