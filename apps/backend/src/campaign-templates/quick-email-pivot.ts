import { TemplateDefinition } from './types';
import { node, edge } from './helpers';

export const quickEmailPivotTemplate: TemplateDefinition = {
    id: 'quick-email-pivot',
    name: 'Quick Email Pivot',
    description:
        'Visit a profile, attempt to find their email, and immediately send an email if found — bypassing LinkedIn messaging entirely.',
    useCase: 'Skip LinkedIn, go straight to email',
    recommendedFor: [
        'Sales reps targeting inbox-heavy decision-makers',
        'Recruiters who prefer email-first outreach',
        'Founders wanting a direct channel with higher response rates',
    ],
    group: 'my-network',
    category: 'email',
    icon: '📨',
    color: 'from-violet-400 to-purple-500',
    durationDays: 1,
    stepCount: 3,
    delayCount: 0,
    requires: ['email-finder', 'email'],
    aiStrategyHint: {
        objective:
            'Bypass LinkedIn messaging and reach the lead directly via email after profile enrichment.',
        description:
            'Profile visit enriches lead data, then the email-finder attempts to resolve an email address. If found, an AI-generated email is sent immediately. If no email is found, the workflow ends silently.',
        cta: 'email',
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
            node('n4', 400, 'ACTION', 'EMAIL', 'Send Email (AI)', {
                message: '',
                subject: '',
            }),
            node('n5', 400, 'ACTION', 'END', 'End', {}),
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
