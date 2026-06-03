import { TemplateDefinition } from './types';
import { node, edge } from './helpers';

export const technicalTruthDripTemplate: TemplateDefinition = {
    id: 'technical-truth-drip',
    name: 'Technical Truth Drip',
    description:
        'A slow educational drip for technical buyers. Follow, visit profile, and connect with context. Three carefully spaced messages over 11 days deliver value without pressure.',
    useCase: 'Educational drip sequence for technical buyers',
    recommendedFor: [
        'Technical buyer education sequences',
        'Long sales cycle nurture campaigns',
        'Developer / engineering audience outreach',
    ],
    group: 'action-triggered',
    category: 'linkedin',
    icon: '🏗️',
    color: 'from-stone-500 to-zinc-600',
    durationDays: 11,
    stepCount: 6,
    delayCount: 3,
    aiStrategyHint: {
        objective:
            'Educate technical buyers through a measured, value-first LinkedIn sequence.',
        description:
            'Slow-burn educational outreach. Follow to begin the relationship, visit their profile for enrichment, then connect with a personalized note referencing their work. Two spaced-out educational messages follow — share insight, then share a resource. No hard pitch; designed for technical audiences who need multiple touches before engaging.',
        cta: 'engage',
        toneOverride: 'technical',
    },
    workflow: {
        nodes: [
            node('trigger', 0, 'TRIGGER', 'START', 'Trigger: Lead Added'),
            node('n1', 100, 'ACTION', 'FOLLOW', 'Follow'),
            node('n2', 200, 'DELAY', 'WAIT', 'Wait 2 days', { delayDays: 2 }),
            node('n3', 300, 'ACTION', 'PROFILE_VISIT', 'Visit Profile'),
            node('n4', 400, 'ACTION', 'CONNECT', 'Send Invite (AI note)', {
                message: '',
            }),
            node('n5', 500, 'DELAY', 'WAIT', 'Wait 3 days', { delayDays: 3 }),
            node('n6', 600, 'ACTION', 'MESSAGE', 'Message 1 — Insight (AI)', { aiEnabled: true, message: '',
            }),
            node('n7', 700, 'DELAY', 'WAIT', 'Wait 5 days', { delayDays: 5 }),
            node('n8', 800, 'ACTION', 'MESSAGE', 'Message 2 — Resource (AI)', { aiEnabled: true, message: '',
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
