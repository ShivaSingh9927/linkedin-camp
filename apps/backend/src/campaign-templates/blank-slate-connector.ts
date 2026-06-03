import { TemplateDefinition } from './types';
import { node, edge } from './helpers';

export const blankSlateConnectorTemplate: TemplateDefinition = {
    id: 'blank-slate-connector',
    name: 'Blank Slate Connector',
    description:
        'A minimal two-step sequence for cold prospects: visit their profile, wait a day, then send a connection request. No note, no follow-up — just the lowest-friction path to a first-degree link.',
    useCase: 'Simple connect sequence for cold prospects',
    recommendedFor: [
        'SDRs building pipeline in a new territory',
        'Batch outreach where individual personalization is impractical',
    ],
    group: 'out-of-network',
    category: 'linkedin',
    icon: '🔌',
    color: 'from-slate-500 to-gray-600',
    durationDays: 2,
    stepCount: 2,
    delayCount: 1,
    aiStrategyHint: {
        objective: 'Establish a first-degree connection with a cold prospect.',
        description:
            'Visit the profile to signal interest, then send a blank connection request the next day. No note — relies on profile-visit familiarity to drive acceptance.',
        cta: 'connect',
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
            node('n2', 200, 'DELAY', 'WAIT', 'Wait 1 day', { delayDays: 1 }),
            node('n3', 300, 'ACTION', 'CONNECT', 'Send Invite', {
                message: '',
            }),
        ],
        edges: [
            edge('trigger', 'n1'),
            edge('n1', 'n2'),
            edge('n2', 'n3'),
        ],
    },
};
