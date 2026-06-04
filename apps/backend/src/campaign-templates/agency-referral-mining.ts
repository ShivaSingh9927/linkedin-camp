import { TemplateDefinition } from './types';
import { warmDM } from './shapes';

export const agencyReferralMiningTemplate: TemplateDefinition = {
    id: 'agency-referral-mining',
    name: 'Referral Mining',
    description:
        'Mine your past-client network for warm intros. Two messages aimed not at re-engagement but at intros: ask for one or two specific names. Different from past-client reactivation — this isn\'t about restarting work with them, it\'s about who they can introduce.',
    useCase: 'Agency asking happy past clients for warm intros to their network.',
    bestFor:
        'Best for: agencies sourcing pipeline via past-client referrals. Also useful for: consultants building a steady intro-driven pipeline, recruiters asking placements for referrals.',
    recommendedFor: [
        'Agencies running referral-driven pipeline',
        'Consultants building intro-led growth',
        'Recruiters mining successful placements',
    ],
    group: 'my-network',
    category: 'linkedin',
    audience: 'connected',
    icp: 'agency',
    icon: '🫱🏻‍🫲🏼',
    color: 'from-teal-500 to-cyan-600',
    durationDays: 9,
    stepCount: 4,
    delayCount: 2,
    aiStrategyHint: {
        objective:
            'Get one or two specific intros from a past client by being direct about what kind of intro is useful.',
        description:
            'Message 1: acknowledge the prior work, then state the specific kind of intro you\'re asking for (ideal company profile, ideal role, what problem they help solve). Be concrete — vague asks return vague results. Message 2: a polite nudge that says "no pressure" and offers to do the same for them.',
        cta: 'ask for two specific intros',
        toneOverride: 'familiar',
    },
    workflow: warmDM({ beforeFirstMsgDays: 2, betweenMsgsDays: 7, messageCount: 2 }),
};
