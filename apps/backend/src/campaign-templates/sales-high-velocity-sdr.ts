import { TemplateDefinition } from './types';
import { coldInvite } from './shapes';

export const salesHighVelocitySdrTemplate: TemplateDefinition = {
    id: 'sales-high-velocity-sdr',
    name: 'High-Velocity SDR',
    description:
        'Aggressive cadence for SDRs working a large cold list. 1d / 2d / 3d delays — gets through more leads per week than the standard cold prospecting template. Two short messages, no fluff.',
    useCase: 'SDRs whose KPI is meetings booked per week and who need volume more than per-lead depth.',
    bestFor:
        'Best for: high-volume SDR teams. Also useful for: early-stage startups testing ICP fit fast, agencies running rapid outbound experiments.',
    recommendedFor: [
        'High-volume SDR teams',
        'Startups validating ICPs quickly',
        'Agencies running outbound experiments',
    ],
    group: 'out-of-network',
    category: 'linkedin',
    audience: 'cold',
    icp: 'sales',
    icon: '🏎️',
    color: 'from-red-500 to-pink-500',
    durationDays: 6,
    stepCount: 6,
    delayCount: 3,
    aiStrategyHint: {
        objective:
            'Book meetings at volume with a fast cadence that respects the lead\'s time and qualifies hard.',
        description:
            'Both messages must be under three sentences. Message 1: one-line problem statement framed as a question. Message 2: one-line proposal of a 15-minute call, no follow-up. If they don\'t respond after this template, move on — don\'t bury them in nurture.',
        cta: 'book or move on',
        toneOverride: 'direct',
    },
    workflow: coldInvite({ beforeConnectDays: 1, afterAcceptDays: 2, betweenMsgsDays: 3, messageCount: 2 }),
};
