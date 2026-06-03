import { TemplateDefinition } from './types';
import { node, edge } from './helpers';

export const omniChannelAidaTemplate: TemplateDefinition = {
    id: 'omni-channel-aida',
    name: 'Omni-Channel AIDA',
    description:
        'Attention-Interest-Desire-Action across LinkedIn and email. Connect on LinkedIn, wait 5 days for acceptance, find their email, then send a sequence email. CRM sync is automatic.',
    useCase: 'Attention-Interest-Desire-Action across LinkedIn + email',
    recommendedFor: [
        'Enterprise sales with long, multi-touch cycles',
        'ABM campaigns targeting named accounts',
    ],
    group: 'out-of-network',
    category: 'multi-channel',
    audience: 'cold',
    icon: '🌐',
    color: 'from-purple-500 to-fuchsia-600',
    durationDays: 6,
    stepCount: 4,
    delayCount: 1,
    requires: ['email-finder', 'email', 'crm-sync'],
    aiStrategyHint: {
        objective: 'Guide a prospect through the AIDA funnel using LinkedIn + email.',
        description:
            'Send a connection request to grab Attention, wait for acceptance, then use Interest-Desire-Action email content. The email finder and CRM sync complete the omni-channel loop.',
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
            node('n2', 200, 'ACTION', 'CONNECT', 'Send Invite (AI note)', {
                message: '',
            }),
            node('n3', 300, 'DELAY', 'WAIT', 'Wait 5 days', { delayDays: 5 }),
            node('n4', 400, 'ACTION', 'EMAIL_FINDER', 'Find Email', {}),
            node('n5', 500, 'ACTION', 'EMAIL', 'Send AIDA Email', { aiEnabled: true, message: '',
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
