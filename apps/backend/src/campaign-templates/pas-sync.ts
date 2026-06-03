import { TemplateDefinition } from './types';
import { node, edge } from './helpers';

export const pasSyncTemplate: TemplateDefinition = {
    id: 'pas-sync',
    name: 'PAS Sync',
    description:
        'Problem-Agitation-Solution email sequence with automatic CRM logging. Visit the profile, find the email, wait a day, then send the PAS email. Every lifecycle event syncs to your CRM automatically.',
    useCase: 'Problem-Agitation-Solution email sequence with CRM sync',
    recommendedFor: [
        'B2B SaaS sales running structured email sequences',
        'Revenue teams that need CRM-visible outreach',
    ],
    group: 'out-of-network',
    category: 'email',
    icon: '📊',
    color: 'from-indigo-500 to-violet-600',
    durationDays: 2,
    stepCount: 3,
    delayCount: 1,
    requires: ['email-finder', 'email', 'crm-sync'],
    aiStrategyHint: {
        objective: 'Deliver a Problem-Agitation-Solution email with full CRM logging.',
        description:
            'Enrich the lead via profile visit, find their email, wait a day, then send an AI-crafted PAS email. CRM sync is automatic on every lifecycle event.',
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
            node('n3', 300, 'DELAY', 'WAIT', 'Wait 1 day', { delayDays: 1 }),
            node('n4', 400, 'ACTION', 'EMAIL', 'Send PAS Email', { aiEnabled: true, message: '',
            }),
        ],
        edges: [
            edge('trigger', 'n1'),
            edge('n1', 'n2'),
            edge('n2', 'n3'),
            edge('n3', 'n4'),
        ],
    },
};
