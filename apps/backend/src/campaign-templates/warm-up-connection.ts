import { TemplateDefinition } from './types';
import { node, edge } from './helpers';

export const warmUpConnectionTemplate: TemplateDefinition = {
    id: 'warm-up-connection',
    name: 'Warm-Up Connection',
    description:
        'Build familiarity before connecting: visit the profile, like and comment on a recent post to get on their radar, wait a day, then send a connection request.',
    useCase: 'Build familiarity before sending connection request',
    recommendedFor: [
        'Sales reps targeting engaged content creators',
        'BD professionals entering a new vertical',
    ],
    group: 'out-of-network',
    category: 'linkedin',
    audience: 'mixed',
    icon: '🔥',
    color: 'from-red-500 to-rose-600',
    durationDays: 2,
    stepCount: 3,
    delayCount: 1,
    aiStrategyHint: {
        objective: 'Increase connection acceptance by engaging with the prospect\'s content first.',
        description:
            'Visit the profile, then like and comment on a recent post to build recognition. Wait a day before sending the connection request so the engagement feels organic.',
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
                enrichPosts: true,
            }),
            node('n2', 200, 'ACTION', 'LIKE', 'Like Recent Post', {}),
            node('n3', 300, 'ACTION', 'COMMENT', 'Comment on Post', {
                message: '',
            }),
            node('n4', 400, 'DELAY', 'WAIT', 'Wait 1 day', { delayDays: 1 }),
            node('n5', 500, 'ACTION', 'CONNECT', 'Send Invite', {
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
