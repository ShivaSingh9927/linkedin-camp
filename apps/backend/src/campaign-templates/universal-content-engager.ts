import { TemplateDefinition } from './types';
import { followAndNurture } from './shapes';

export const universalContentEngagerTemplate: TemplateDefinition = {
    id: 'universal-content-engager',
    name: 'Content Engager',
    description:
        'Lightweight presence-building: follow + two rounds of AI-crafted like + comment, 5 days apart. No DMs. Works across any role that benefits from being on the radar of a target list.',
    useCase: 'Anyone who wants steady passive presence without active outreach.',
    bestFor:
        'Best for: anyone building soft awareness with a target list. Also useful for: candidates pre-application, sellers softening accounts before outbound, partners warming up channel reps.',
    recommendedFor: [
        'Candidates pre-application warming',
        'AEs softening account pre-outbound',
        'Partner / BD leads warming channel reps',
    ],
    group: 'objective-based',
    category: 'linkedin',
    audience: 'mixed',
    icp: 'universal',
    icon: '👋',
    color: 'from-blue-500 to-sky-600',
    durationDays: 11,
    stepCount: 8,
    delayCount: 2,
    aiStrategyHint: {
        objective:
            'Establish lightweight recognition with a target list so that later, direct outreach has context.',
        description:
            'Every interaction must add value — a question, a counter-perspective, a related data point. Avoid bland approval. The goal is name recognition with substance behind it.',
        cta: 'build soft awareness',
        toneOverride: 'thoughtful',
    },
    workflow: followAndNurture({ betweenEngageDays: 5, engageRounds: 2 }),
};
