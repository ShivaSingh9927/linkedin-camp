import { TemplateDefinition } from './types';
import { node, edge } from './helpers';

export const omniChannelSyncTemplate: TemplateDefinition = {
    id: 'omni-channel-sync',
    name: 'Omni-Channel Sync',
    description:
        'Visit a profile, find their email, then send a follow-up email one day later. Every enriched field syncs to your CRM automatically.',
    useCase: 'Multi-channel outreach with CRM sync',
    recommendedFor: [
        'Sales teams that need CRM hygiene alongside outreach',
        'Agencies running coordinated LinkedIn + email campaigns',
        'Revenue operations building integrated lead pipelines',
    ],
    group: 'my-network',
    category: 'multi-channel',
    icon: '🔗',
    color: 'from-fuchsia-400 to-pink-500',
    durationDays: 2,
    stepCount: 3,
    delayCount: 1,
    requires: ['email-finder', 'email', 'crm-sync'],
    aiStrategyHint: {
        objective:
            'Execute multi-channel outreach by enriching lead data, syncing to CRM, and sending a coordinated email.',
        description:
            'Profile visit captures company and contact data. Email-finder resolves a working email. Data is pushed to CRM for pipeline tracking. After a 1-day delay, an AI-generated email is sent to the lead\'s inbox.',
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
            node('n3', 300, 'DELAY', 'WAIT', 'Wait 1 day', { delayDays: 1 }),
            node('n4', 400, 'ACTION', 'EMAIL', 'Send Email (AI)', {
                message: '',
                subject: '',
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
