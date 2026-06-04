import { TemplateDefinition } from './types';
import { coldInvite } from './shapes';

export const founderDesignPartnerHuntTemplate: TemplateDefinition = {
    id: 'founder-design-partner-hunt',
    name: 'Design Partner Hunt',
    description:
        'High-personalization cold outreach to find your first 5-10 design partners. Visit, then a personalized invite, then two AI follow-ups that ask for 20 minutes of their time, not a pitch.',
    useCase: 'Early-stage founder validating a problem or recruiting design partners for a v0/v1 product.',
    bestFor:
        'Best for: founders pre-launch or in private beta. Also useful for: any operator running discovery interviews, researchers recruiting practitioners.',
    recommendedFor: [
        'Pre-seed / seed founders running customer discovery',
        'PMs validating a new product line internally',
        'Solo builders sourcing early adopters',
    ],
    group: 'out-of-network',
    category: 'linkedin',
    audience: 'cold',
    icp: 'founder',
    icon: '🧪',
    color: 'from-violet-500 to-purple-600',
    durationDays: 12,
    stepCount: 5,
    delayCount: 3,
    aiStrategyHint: {
        objective:
            'Open a conversation with a prospective design partner by referencing one concrete detail from their work and asking for a low-commitment chat.',
        description:
            'These are not pitches — they are discovery requests. The connect note should name a specific signal from their headline or recent post that suggests they hit the pain you are solving. The follow-ups should offer something asymmetric (early access, a finding, a relevant resource), never a calendar link.',
        cta: 'request 20 minutes',
        toneOverride: 'curious',
    },
    workflow: coldInvite({ beforeConnectDays: 2, afterAcceptDays: 4, betweenMsgsDays: 6, messageCount: 2 }),
};
