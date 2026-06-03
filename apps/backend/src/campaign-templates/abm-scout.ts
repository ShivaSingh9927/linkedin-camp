import { TemplateDefinition } from './types';
import { node, edge } from './helpers';

export const abmScoutTemplate: TemplateDefinition = {
    id: 'abm-scout',
    name: 'ABM Scout',
    description:
        'Account-based scouting sequence. Visit profile, follow, wait 2 days, then find email. Routes to email send if found, or ends silently.',
    useCase: 'Account-based scouting with follow + email fallback',
    recommendedFor: [
        'ABM teams targeting named accounts',
        'SDRs doing multi-channel prospecting',
        'Outreach sequences requiring email fallback',
    ],
    group: 'action-triggered',
    category: 'linkedin',
    audience: 'cold',
    icon: '🔍',
    color: 'from-blue-500 to-cyan-500',
    durationDays: 3,
    stepCount: 4,
    delayCount: 1,
    requires: ['email-finder', 'email'],
    aiStrategyHint: {
        objective:
            'Enrich lead data and capture email for multi-channel outbound reach.',
        description:
            'Begin with enrichment and a follow for presence, wait 2 days, then attempt email extraction. If a valid email is found, send an email; otherwise end the workflow silently to avoid burning the lead.',
        cta: 'email',
        toneOverride: 'professional',
    },
    workflow: {
        nodes: [
            node('trigger', 0, 'TRIGGER', 'START', 'Trigger: Lead Added'),
            node('n1', 100, 'ACTION', 'PROFILE_VISIT', 'Visit Profile'),
            node('n2', 200, 'ACTION', 'FOLLOW', 'Follow'),
            node('n3', 300, 'DELAY', 'WAIT', 'Wait 2 days', { delayDays: 2 }),
            node('n4', 400, 'ACTION', 'EMAIL_FINDER', 'Find Email'),
            node('n5', 500, 'CONDITION', 'IF_ELSE', 'Email Found?', {
                condition: {
                    source: 'storedOutputs',
                    field: 'email-finder.email',
                    operator: 'is_not_null',
                },
            }),
            node('n6', 600, 'ACTION', 'EMAIL', 'Send Email', { aiEnabled: true }),
            node('n7', 700, 'ACTION', 'END', 'End'),
        ],
        edges: [
            edge('trigger', 'n1'),
            edge('n1', 'n2'),
            edge('n2', 'n3'),
            edge('n3', 'n4'),
            edge('n4', 'n5'),
            { ...edge('n5', 'n6'), sourceHandle: 'true' },
            { ...edge('n5', 'n7'), sourceHandle: 'false' },
        ],
    },
};
