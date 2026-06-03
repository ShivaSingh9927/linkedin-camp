import { TemplateDefinition } from './types';
import { node, edge } from './helpers';

export const contextualReactivationTemplate: TemplateDefinition = {
    id: 'contextual-reactivation',
    name: 'Contextual Reactivation',
    description:
        'Visit a dormant connection\'s profile to signal intent, then send a personalized message referencing their recent activity or your shared history.',
    useCase: 'Re-engage dormant 1st-degree connections',
    recommendedFor: [
        'Networkers with a large dormant 1st-degree network',
        'Sales professionals re-engaging past leads',
        'Job seekers reconnecting with former colleagues',
    ],
    group: 'my-network',
    category: 'linkedin',
    audience: 'connected',
    icon: '🔄',
    color: 'from-blue-400 to-cyan-500',
    durationDays: 2,
    stepCount: 2,
    delayCount: 1,
    aiStrategyHint: {
        objective:
            'Re-engage a dormant connection by referencing a specific detail from their recent activity or your shared history.',
        description:
            'Profile visit warms the lead before a direct message. The message should reference something concrete — a recent post, a shared group, or past collaboration — to justify the unexpected outreach after silence.',
        cta: 'reconnect',
        toneOverride: 'warm',
    },
    workflow: {
        nodes: [
            node('trigger', 0, 'TRIGGER', 'START', 'Trigger: Lead Added'),
            node('n1', 100, 'ACTION', 'PROFILE_VISIT', 'Visit Profile', {
                enrichCompany: true,
                enrichAbout: true,
                enrichContact: false,
                enrichPosts: true,
            }),
            node('n2', 200, 'DELAY', 'WAIT', 'Wait 1 day', { delayDays: 1 }),
            node('n3', 300, 'ACTION', 'MESSAGE', 'Send Message (AI)', { aiEnabled: true, message: '',
            }),
        ],
        edges: [
            edge('trigger', 'n1'),
            edge('n1', 'n2'),
            edge('n2', 'n3'),
        ],
    },
};
