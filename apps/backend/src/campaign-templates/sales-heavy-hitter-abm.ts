import { TemplateDefinition } from './types';
import { heavyHitter } from './shapes';

export const salesHeavyHitterAbmTemplate: TemplateDefinition = {
    id: 'sales-heavy-hitter-abm',
    name: 'Heavy Hitter ABM',
    description:
        'No stone unturned. After a LinkedIn invite is accepted, send three AI-crafted LinkedIn messages over two weeks, then find their email and send three more emails. Reserved for top-20 named accounts where every touchpoint counts.',
    useCase: 'ABM motions targeting a small, high-value named-account list where you can afford 6 personalized touches per lead.',
    bestFor:
        'Best for: enterprise AEs running a top-20 named-account list. Also useful for: founders pursuing strategic partnerships, agencies pitching flagship clients.',
    recommendedFor: [
        'Enterprise AEs working top-20 accounts',
        'Founders chasing strategic partners',
        'Agencies pitching flagship deals',
    ],
    group: 'out-of-network',
    category: 'multi-channel',
    audience: 'cold',
    icp: 'sales',
    icon: '🎖️',
    color: 'from-amber-600 to-red-700',
    durationDays: 30,
    stepCount: 12,
    delayCount: 5,
    requires: ['email-finder', 'email'],
    aiStrategyHint: {
        objective:
            'Convert a named-account lead into an exploratory call through sustained, well-spaced, varied touches across LinkedIn and email — never repeating the same angle.',
        description:
            'Each of the six messages must take a distinct angle: opener (relationship), insight (data point), outcome (case story), question (qualification), resource (gift), close (direct ask). No message should restate the pitch — every one should earn the next reply on its own merit.',
        cta: 'book a 25-min discovery call',
        toneOverride: 'executive',
    },
    workflow: heavyHitter({ beforeConnectDays: 1, afterAcceptDays: 3, betweenLIDays: 5, betweenEmailDays: 5 }),
};
