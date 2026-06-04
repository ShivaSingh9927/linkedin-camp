import { TemplateDefinition } from './types';
import { coldInvite } from './shapes';

export const founderInvestorCadenceDripTemplate: TemplateDefinition = {
    id: 'founder-investor-cadence-drip',
    name: 'Investor Cadence Drip',
    description:
        'Patient three-message investor sequence at a deliberate pace (2d / 4d / 7d delays). Connect with a specific reason, then three messages over three weeks: update, traction, ask. Built for investors who pattern-match on consistency.',
    useCase: 'Founder building investor relationships before, during, or between fundraises.',
    bestFor:
        'Best for: founders running long-cycle investor relationship-building. Also useful for: operators networking for future raises, advisors maintaining LP relationships.',
    recommendedFor: [
        'Founders running long-cycle investor outreach',
        'Operators networking pre-future-raise',
        'Advisors maintaining LP relationships',
    ],
    group: 'out-of-network',
    category: 'linkedin',
    audience: 'cold',
    icp: 'founder',
    icon: '📈',
    color: 'from-emerald-600 to-teal-700',
    durationDays: 16,
    stepCount: 8,
    delayCount: 4,
    aiStrategyHint: {
        objective:
            'Get on the investor\'s radar through a measured cadence of substantive updates, never asking for a meeting until the third message.',
        description:
            'Message 1: introduce who you are and one specific reason this investor matters to your space. Message 2: share one quantitative traction signal or insight. Message 3: ask whether they are taking intro calls this quarter. No decks, no urgency, no follow-the-up "just bumping this".',
        cta: 'open a relationship that converts at the next raise',
        toneOverride: 'thoughtful',
    },
    workflow: coldInvite({ beforeConnectDays: 2, afterAcceptDays: 4, betweenMsgsDays: 7, messageCount: 3 }),
};
