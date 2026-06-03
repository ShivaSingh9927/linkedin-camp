import { TemplateDefinition } from './types';
import { node, edge } from './helpers';

export const directEmailRouteTemplate: TemplateDefinition = {
    id: 'direct-email-route',
    name: 'Direct Email Route',
    description:
        'Skip LinkedIn entirely: visit the profile, find the prospect\'s email, and send a message directly if found — otherwise end the workflow cleanly.',
    useCase: 'Skip LinkedIn connection, go direct to email',
    recommendedFor: [
        'Enterprise sales targeting C-suite with known email patterns',
        'Outreach where LinkedIn connection is less valuable than email',
    ],
    group: 'out-of-network',
    category: 'email',
    audience: 'connected',
    icon: '📧',
    color: 'from-emerald-500 to-teal-600',
    durationDays: 1,
    stepCount: 3,
    delayCount: 0,
    requires: ['email-finder', 'email'],
    aiStrategyHint: {
        objective: 'Deliver a cold email to a prospect without requiring a LinkedIn connection.',
        description:
            'Visit the profile for enrichment, attempt to find an email address, then send a cold email if found. If no email is discovered the workflow terminates gracefully.',
        cta: 'email-reply',
        toneOverride: 'professional',
    },
    workflow: {
        nodes: [
            node('trigger', 0, 'TRIGGER', 'START', 'Trigger: Lead Added'),
            node('n1', 100, 'ACTION', 'PROFILE_VISIT', 'Visit Profile', {
                enrichCompany: true,
                enrichAbout: true,
                enrichContact: true,
                enrichPosts: false,
            }),
            node('n2', 200, 'ACTION', 'EMAIL_FINDER', 'Find Email', {}),
            node('n3', 300, 'CONDITION', 'IF_ELSE', 'Email Found?', {
                condition: {
                    source: 'storedOutputs',
                    field: 'email-finder.email',
                    operator: 'is_not_null',
                },
            }),
            node('n4', 400, 'ACTION', 'EMAIL', 'Send Cold Email', { aiEnabled: true, message: '',
            }),
            node('n5', 500, 'TRIGGER', 'END', 'End'),
        ],
        edges: [
            edge('trigger', 'n1'),
            edge('n1', 'n2'),
            edge('n2', 'n3'),
            { id: 'e_n3_n4', source: 'n3', target: 'n4', sourceHandle: 'true' },
            { id: 'e_n3_n5', source: 'n3', target: 'n5', sourceHandle: 'false' },
        ],
    },
};
