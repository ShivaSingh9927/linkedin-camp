import { TemplateDefinition } from './types';
import { multiLikePresence } from './shapes';

export const universalTripleLikePresenceTemplate: TemplateDefinition = {
    id: 'universal-triple-like-presence',
    name: 'Triple-Like Presence',
    description:
        'Three spaced likes on three of their recent posts. No comments, no DMs. Each like surfaces your name in their notifications — gentle, repeated presence with zero ask.',
    useCase: 'Building name recognition with a target list before any direct outreach.',
    bestFor:
        'Best for: anyone warming an account list without sending DMs. Also useful for: candidates pre-application, AEs softening enterprise accounts, creators in stealth audience-building.',
    recommendedFor: [
        'Account-based softening before outbound',
        'Candidate warming pre-application',
        'Anyone who wants presence without commitment',
    ],
    group: 'objective-based',
    category: 'linkedin',
    audience: 'mixed',
    icp: 'universal',
    icon: '👍',
    color: 'from-sky-400 to-blue-500',
    durationDays: 11,
    stepCount: 4,
    delayCount: 2,
    aiStrategyHint: {
        objective:
            'Generate three lightweight presence touchpoints in the target lead\'s notification stream with no explicit ask.',
        description:
            'There is no message generation here — the AI only matters when this template is followed by a connect or DM campaign. This one is silent presence: three likes, spaced.',
        cta: 'build presence',
        toneOverride: 'neutral',
    },
    workflow: multiLikePresence({ likeCount: 3, betweenLikesDays: 5 }),
};
