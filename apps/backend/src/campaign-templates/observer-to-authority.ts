import { TemplateDefinition } from './types';
import { node, edge } from './helpers';

export const observerToAuthorityTemplate: TemplateDefinition = {
    id: 'observer-to-authority',
    name: 'Observer to Authority',
    description:
        'Observe from a distance with a profile visit, wait, then engage with their content (like + comment) before sending a personalized message.',
    useCase: 'Build familiarity before direct outreach',
    recommendedFor: [
        'Professionals building credibility before pitching',
        'Consultants wanting to demonstrate expertise via comments',
        'Job seekers engaging with target company employees',
    ],
    group: 'my-network',
    category: 'linkedin',
    icon: '👁️',
    color: 'from-sky-400 to-indigo-500',
    durationDays: 4,
    stepCount: 4,
    delayCount: 2,
    aiStrategyHint: {
        objective:
            'Build familiarity through a sequence of observed interactions before direct messaging.',
        description:
            'Start with a profile visit to signal awareness. Wait 2 days, then like and comment on a recent post to show genuine interest. Wait another day, then send a message that references the comment and deepens the conversation.',
        cta: 'connect',
        toneOverride: 'thoughtful',
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
            node('n2', 200, 'DELAY', 'WAIT', 'Wait 2 days', { delayDays: 2 }),
            node('n3', 300, 'ACTION', 'LIKE', 'Like Recent Post', {}),
            node('n4', 400, 'ACTION', 'COMMENT', 'Comment on Post', {
                message: '',
            }),
            node('n5', 500, 'DELAY', 'WAIT', 'Wait 1 day', { delayDays: 1 }),
            node('n6', 600, 'ACTION', 'MESSAGE', 'Send Message (AI)', { aiEnabled: true, message: '',
            }),
        ],
        edges: [
            edge('trigger', 'n1'),
            edge('n1', 'n2'),
            edge('n2', 'n3'),
            edge('n3', 'n4'),
            edge('n4', 'n5'),
            edge('n5', 'n6'),
        ],
    },
};
