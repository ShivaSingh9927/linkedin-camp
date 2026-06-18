import { TemplateDefinition } from './types';
import { multiChannelDrip } from './shapes';

export const salesCompetitorConquestTemplate: TemplateDefinition = {
    id: 'sales-competitor-conquest',
    name: 'Competitor Conquest',
    description:
        'Win over prospects already engaged with a competitor. LinkedIn invite that references their interest in the competitor\'s space, a pain-validation message, then a switch case-study — with email as fallback if the invite is ignored. The whole sequence assumes the lead already knows the category, so it leads with a sharper point of view.',
    useCase: 'Targeting people who follow, engage with, or already buy from a named competitor and could be switched with the right wedge.',
    bestFor:
        'Best for: AEs running competitive-displacement plays against an incumbent. Also useful for: founders positioning a modern alternative, PMMs activating a "switch from X" campaign.',
    recommendedFor: [
        'AEs running competitive-displacement outbound',
        'Founders positioning against an incumbent',
        'PMMs activating a "switch from X" motion',
    ],
    group: 'out-of-network',
    category: 'multi-channel',
    audience: 'cold',
    icp: 'sales',
    icon: '⚔️',
    color: 'from-rose-500 to-red-600',
    durationDays: 12,
    stepCount: 8,
    delayCount: 3,
    requires: ['email-finder', 'email'],
    aiStrategyHint: {
        objective:
            'Convert a prospect who is already invested in a competitor by validating a specific pain they likely feel with that tool, then offering a credible reason to evaluate a switch.',
        description:
            'The invite note references the competitor / category by name as the shared context — never a generic "great profile" line. The first message after connecting probes one concrete limitation of the incumbent as an open question (validate, don\'t attack). The follow-up leads with proof: a customer who switched and what changed. The email fallback (when the invite is ignored) opens cold with the same wedge but more substance, since there is no prior rapport. Stay respectful of the competitor — the angle is "a better fit for your situation", not "they are bad".',
        cta: 'open a conversation about evaluating an alternative',
        toneOverride: 'direct',
    },
    workflow: multiChannelDrip({ beforeConnectDays: 2, afterAcceptDays: 4, beforeEmailDays: 6 }),
};
