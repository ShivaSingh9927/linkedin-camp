import { TemplateDefinition } from './types';
import { followAndNurture } from './shapes';

export const creatorAudienceBuilderTemplate: TemplateDefinition = {
    id: 'creator-audience-builder',
    name: 'Audience Builder',
    description:
        'Pure brand presence — no DMs. Follow + repeated AI-crafted engagement (like + comment) over three rounds spaced 7 days apart. Builds passive awareness without burning trust.',
    useCase: 'Creator or community builder growing audience by consistent presence in target accounts\' notifications.',
    bestFor:
        'Best for: newsletter writers, course creators, community builders. Also useful for: brand-led founders, anyone whose channel is content + presence rather than direct sales.',
    recommendedFor: [
        'Newsletter / podcast operators',
        'Course creators building authority',
        'Community-led GTM operators',
    ],
    group: 'objective-based',
    category: 'linkedin',
    audience: 'mixed',
    icp: 'creator',
    icon: '📣',
    color: 'from-yellow-500 to-amber-600',
    durationDays: 21,
    stepCount: 11,
    delayCount: 3,
    aiStrategyHint: {
        objective:
            'Build sustained presence in target accounts by engaging substantively over weeks, with no DMs and no asks.',
        description:
            'Every comment must add something — a question, a counterpoint, a related observation. Never just "great post". Across rounds, vary the angle so the same name does not show up saying the same thing three times. The goal is recognition, not conversion.',
        cta: 'build recognition',
        toneOverride: 'curious',
    },
    workflow: followAndNurture({ betweenEngageDays: 7, engageRounds: 3 }),
};
