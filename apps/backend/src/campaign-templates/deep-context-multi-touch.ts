import { TemplateDefinition } from './types';
import { node, edge } from './helpers';

export const deepContextMultiTouchTemplate: TemplateDefinition = {
    id: 'deep-context-multi-touch',
    name: 'Deep Context Multi-Touch',
    description:
        'Maximum-touch sequence: visit profile, wait, like + comment on a post, wait, send message, wait 5 days, then send a final follow-up.',
    useCase: 'Maximum touchpoints before conversion',
    recommendedFor: [
        'Enterprise sales reps managing long cycles',
        'Account-based marketing targeting high-value leads',
        'Any scenario requiring deep relationship building over time',
    ],
    group: 'my-network',
    category: 'linkedin',
    icon: '🌊',
    color: 'from-blue-500 to-indigo-600',
    durationDays: 9,
    stepCount: 5,
    delayCount: 3,
    aiStrategyHint: {
        objective:
            'Build maximum context and familiarity through the longest possible pre-message engagement sequence.',
        description:
            'Start with a profile visit to show intent. Wait 1 day, then like and comment on a post. Wait 2 days, then send a message referencing the comment. Wait 5 days — the longest gap in the sequence — then send a final follow-up that adds new value.',
        cta: 'connect',
        toneOverride: 'consultative',
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
            node('n3', 300, 'ACTION', 'LIKE', 'Like Recent Post', {}),
            node('n4', 400, 'ACTION', 'COMMENT', 'Comment on Post', {
                message: '',
            }),
            node('n5', 500, 'DELAY', 'WAIT', 'Wait 2 days', { delayDays: 2 }),
            node('n6', 600, 'ACTION', 'MESSAGE', 'First Message (AI)', {
                message: '',
            }),
            node('n7', 700, 'DELAY', 'WAIT', 'Wait 5 days', { delayDays: 5 }),
            node('n8', 800, 'ACTION', 'MESSAGE', 'Follow-up (AI)', {
                message: '',
            }),
        ],
        edges: [
            edge('trigger', 'n1'),
            edge('n1', 'n2'),
            edge('n2', 'n3'),
            edge('n3', 'n4'),
            edge('n4', 'n5'),
            edge('n5', 'n6'),
            edge('n6', 'n7'),
            edge('n7', 'n8'),
        ],
    },
};
