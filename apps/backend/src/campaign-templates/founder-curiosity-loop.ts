import { TemplateDefinition } from './types';
import { node, edge } from './helpers';

export const founderCuriosityLoopTemplate: TemplateDefinition = {
    id: 'founder-curiosity-loop',
    name: 'Curiosity Loop',
    description:
        'Three spaced profile visits across two weeks. No connect, no DM, no like. LinkedIn shows the recipient "X viewed your profile" each time — three appearances often makes them reach out to you. Subtle, asymmetric, founder-style.',
    useCase: 'Founder running a low-volume curiosity-bait against high-value target profiles.',
    bestFor:
        'Best for: founders making asymmetric bets on a small target list. Also useful for: investors signaling interest pre-pitch, recruiters surfacing names without commitment.',
    recommendedFor: [
        'Founders running curiosity-bait on a top-10 list',
        'Investors signaling pre-pitch interest',
        'Recruiters making themselves visible without an ask',
    ],
    group: 'objective-based',
    category: 'linkedin',
    audience: 'mixed',
    icp: 'founder',
    icon: '🔭',
    color: 'from-amber-400 to-yellow-500',
    durationDays: 12,
    stepCount: 3,
    delayCount: 2,
    aiStrategyHint: {
        objective:
            'Trigger curiosity-driven inbound by appearing in the target\'s "Who viewed your profile" three times across two weeks, with no other touch.',
        description:
            'No AI message generation happens in this template — there is no message. The strategy hint exists so that if the user later runs a follow-up campaign, the AI knows the context: this lead has already seen your name three times.',
        cta: 'trigger inbound curiosity',
        toneOverride: 'neutral',
    },
    workflow: {
        nodes: [
            node('trigger', 0, 'TRIGGER', 'START', 'Trigger: Lead Added'),
            node('n1', 100, 'ACTION', 'PROFILE_VISIT', 'Visit #1', { enrichAbout: true }),
            node('n2', 200, 'DELAY', 'WAIT', 'Wait 6d', { delayDays: 6 }),
            node('n3', 300, 'ACTION', 'PROFILE_VISIT', 'Visit #2'),
            node('n4', 400, 'DELAY', 'WAIT', 'Wait 6d', { delayDays: 6 }),
            node('n5', 500, 'ACTION', 'PROFILE_VISIT', 'Visit #3'),
            node('end_ok', 600, 'ACTION', 'END', 'End'),
        ],
        edges: [
            edge('trigger', 'n1'), edge('n1', 'n2'), edge('n2', 'n3'),
            edge('n3', 'n4'), edge('n4', 'n5'), edge('n5', 'end_ok'),
        ],
    },
};
