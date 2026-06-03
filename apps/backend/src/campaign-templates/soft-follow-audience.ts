import { TemplateDefinition } from './types';
import { node, edge } from './helpers';

export const softFollowAudienceTemplate: TemplateDefinition = {
    id: 'soft-follow-audience',
    name: 'Soft Follow Audience Builder',
    description:
        'Visit a lead\'s profile to signal attention, then follow the next day. Builds audience silently without direct outreach pressure.',
    useCase: 'Build audience silently by following',
    recommendedFor: [
        'Content creators growing audience silently',
        'Sales professionals warming accounts before outreach',
        'Building initial touchpoints without a hard ask',
    ],
    group: 'action-triggered',
    category: 'linkedin',
    icon: '👣',
    color: 'from-gray-400 to-slate-500',
    durationDays: 2,
    stepCount: 2,
    delayCount: 1,
    aiStrategyHint: {
        objective:
            'Build silent audience awareness through non-intrusive profile visits and follows.',
        description:
            'Zero-pressure audience building. Visit the lead\'s profile to enrich data and signal attention, then follow after a one-day delay. No connection request, no message — purely warming the relationship for future touchpoints.',
        cta: 'follow',
        toneOverride: 'professional',
    },
    workflow: {
        nodes: [
            node('trigger', 0, 'TRIGGER', 'START', 'Trigger: Lead Added'),
            node('n1', 100, 'ACTION', 'PROFILE_VISIT', 'Visit Profile'),
            node('n2', 200, 'DELAY', 'WAIT', 'Wait 1 day', { delayDays: 1 }),
            node('n3', 300, 'ACTION', 'FOLLOW', 'Follow'),
        ],
        edges: [
            edge('trigger', 'n1'),
            edge('n1', 'n2'),
            edge('n2', 'n3'),
        ],
    },
};
