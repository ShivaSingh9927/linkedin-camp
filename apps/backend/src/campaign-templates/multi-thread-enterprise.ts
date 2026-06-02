import { TemplateDefinition } from './types';
import { node, edge } from './helpers';

export const multiThreadEnterpriseTemplate: TemplateDefinition = {
    id: 'multi-thread-enterprise',
    name: 'Multi-Threading Enterprise Swarm',
    description:
        'Orchestrate multi-stakeholder outreach. Visit profile, follow, resolve email, then send a coordinated email after a 2-day delay. CRM sync is automatic on every lifecycle event.',
    useCase: 'Enterprise sales with multi-stakeholder outreach',
    recommendedFor: ['Enterprise sales teams', 'Account executives'],
    group: 'objective-based',
    category: 'multi-channel',
    persona: 'enterprise-sales',
    icon: '🏢',
    color: 'from-slate-600 to-gray-700',
    durationDays: 3,
    stepCount: 4,
    delayCount: 1,
    requires: ['email-finder', 'email', 'crm-sync'],
    aiStrategyHint: {
        objective:
            'Get a meeting with an enterprise stakeholder by establishing presence on LinkedIn and following up via email.',
        description:
            'Enterprise deals require multiple touchpoints across stakeholders. This sequence builds LinkedIn presence (profile visit + follow), resolves contact data, syncs to CRM for pipeline tracking, then sends a tailored email. The AI should align messaging with the stakeholder\'s role and the broader deal narrative.',
        cta: 'reply-to-email',
        toneOverride: 'professional',
    },
    workflow: {
        nodes: [
            node('trigger', 0, 'TRIGGER', 'START', 'Trigger: Lead Added'),
            node('n1', 100, 'ACTION', 'PROFILE_VISIT', 'Visit Profile', {
                enrichCompany: true,
                enrichAbout: true,
                enrichContact: false,
                enrichPosts: false,
            }),
            node('n2', 200, 'ACTION', 'FOLLOW', 'Follow'),
            node('n3', 300, 'ACTION', 'EMAIL_FINDER', 'Find Email'),
            node('n4', 400, 'DELAY', 'WAIT', 'Wait 2 days', { delayDays: 2 }),
            node('n5', 500, 'ACTION', 'EMAIL', 'Send Email', {
                subject: '',
                message: '',
            }),
        ],
        edges: [
            edge('trigger', 'n1'),
            edge('n1', 'n2'),
            edge('n2', 'n3'),
            edge('n3', 'n4'),
            edge('n4', 'n5'),
        ],
    },
};
