import { TemplateDefinition } from './types';
import { engageThenInvite } from './shapes';

export const founderInvestorSoftIntroTemplate: TemplateDefinition = {
    id: 'founder-investor-soft-intro',
    name: 'Investor Soft Intro',
    description:
        'Warm an investor before the ask: like a recent post, comment thoughtfully, wait, then send a connection invite that references the post. After acceptance, a brief AI-crafted note positioning your company.',
    useCase: 'Founder lining up investor meetings without an introducer.',
    bestFor:
        'Best for: founders raising pre-seed/seed. Also useful for: anyone trying to get on the radar of a busy senior person before the ask.',
    recommendedFor: [
        'Founders raising a pre-seed or seed round',
        'Founders building relationships ahead of a future raise',
        'Operators networking with angel investors',
    ],
    group: 'out-of-network',
    category: 'linkedin',
    audience: 'cold',
    icp: 'founder',
    icon: '💸',
    color: 'from-emerald-500 to-teal-600',
    durationDays: 8,
    stepCount: 6,
    delayCount: 2,
    aiStrategyHint: {
        objective:
            'Get on the investor\'s radar with substantive engagement before sending a connection request that references that engagement.',
        description:
            'The comment is the hardest part — it must add a perspective or question, never compliment. The connect note should bridge from the comment topic to one sentence about what you are building, ending with familiarity, not pitch. The welcome message should ask whether they are taking intro calls this quarter — no deck attached.',
        cta: 'open the door',
        toneOverride: 'thoughtful',
    },
    workflow: engageThenInvite({ beforeConnectDays: 2, afterAcceptDays: 4, withMessage: true }),
};
