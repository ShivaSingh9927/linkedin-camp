import { TemplateDefinition } from './types';
import { node, edge } from './helpers';

export const warmEngagerLoopTemplate: TemplateDefinition = {
    id: 'warm-engager-loop',
    name: 'Warm Engager Loop',
    description:
        'Like and comment on a post, wait 3 days, then like and comment on another post. Wait 1 more day, then send a message referencing the engagement history.',
    useCase: 'Double content engagement before messaging',
    recommendedFor: [
        'Professionals wanting maximum familiarity before outreach',
        'Sales reps warming leads through sustained content interaction',
        'Brand builders engaging with key accounts over time',
    ],
    group: 'my-network',
    category: 'linkedin',
    audience: 'mixed',
    icon: '♻️',
    color: 'from-teal-400 to-cyan-500',
    durationDays: 5,
    stepCount: 4,
    delayCount: 2,
    aiStrategyHint: {
        objective:
            'Build deep familiarity through two rounds of content engagement before messaging.',
        description:
            'Like and comment on a post to start building rapport. Wait 3 days, then engage with another post — liking and leaving a thoughtful comment. After 1 more day, send a message that ties both interactions together.',
        cta: 'engage',
        toneOverride: 'conversational',
    },
    workflow: {
        nodes: [
            node('trigger', 0, 'TRIGGER', 'START', 'Trigger: Lead Added'),
            node('n1', 100, 'ACTION', 'LIKE', 'Like Recent Post', {}),
            node('n2', 200, 'ACTION', 'COMMENT', 'Comment on Post', {
                message: '',
            }),
            node('n3', 300, 'DELAY', 'WAIT', 'Wait 3 days', { delayDays: 3 }),
            node('n4', 400, 'ACTION', 'LIKE', 'Like Another Post', {}),
            node('n5', 500, 'ACTION', 'COMMENT', 'Comment on Post', {
                message: '',
            }),
            node('n6', 600, 'DELAY', 'WAIT', 'Wait 1 day', { delayDays: 1 }),
            node('n7', 700, 'ACTION', 'MESSAGE', 'Send Message (AI)', { aiEnabled: true, message: '',
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
        ],
    },
};
