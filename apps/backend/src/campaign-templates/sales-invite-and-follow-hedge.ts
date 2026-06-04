import { TemplateDefinition } from './types';
import { node, edge } from './helpers';

export const salesInviteAndFollowHedgeTemplate: TemplateDefinition = {
    id: 'sales-invite-and-follow-hedge',
    name: 'Invite-and-Follow Hedge',
    description:
        'Visit, follow (so they see your content regardless of what happens), then send the invite. If accepted, send a welcome DM. If ignored, the follow remains — they keep seeing you in their feed. Reduces "rejected = wasted" outcomes.',
    useCase: 'Cold prospecting where invite-acceptance is uncertain and ongoing content presence matters.',
    bestFor:
        'Best for: AEs running outbound where content-led nurture is part of the long game. Also useful for: founders building both pipeline and audience, agencies pairing outbound with inbound brand.',
    recommendedFor: [
        'AEs with a content-led nurture motion',
        'Founders building pipeline + audience together',
        'Agencies running outbound + brand',
    ],
    group: 'out-of-network',
    category: 'linkedin',
    audience: 'cold',
    icp: 'sales',
    icon: '🪝',
    color: 'from-purple-500 to-indigo-600',
    durationDays: 5,
    stepCount: 6,
    delayCount: 2,
    aiStrategyHint: {
        objective:
            'Convert cold prospects to conversations AND keep them in your content orbit even if they decline the invite.',
        description:
            'Connect note should be personalized to one detail from their profile. The post-accept welcome should be brief and lead with a single question, not a pitch. The follow is silent insurance — write nothing about it.',
        cta: 'connect or stay in feed',
        toneOverride: 'professional',
    },
    workflow: {
        nodes: [
            node('trigger', 0, 'TRIGGER', 'START', 'Trigger: Lead Added'),
            node('n1', 100, 'ACTION', 'PROFILE_VISIT', 'Visit Profile', {
                enrichCompany: true, enrichAbout: true,
            }),
            node('n2', 200, 'ACTION', 'FOLLOW', 'Follow First'),
            node('n3', 300, 'DELAY', 'WAIT', 'Wait 1d', { delayDays: 1 }),
            node('n4', 400, 'ACTION', 'CONNECT', 'Send Invite (AI)', { aiEnabled: true, message: '' }),
            node('n5', 500, 'DELAY', 'WAIT', 'Wait 3d', { delayDays: 3 }),
            node('n6', 600, 'ACTION', 'CHECK_CONNECTION', 'Confirm Accepted'),
            node('n7', 700, 'CONDITION', 'IF_ELSE', 'Connected?', {
                condition: { source: 'connectionState', field: 'connected', operator: 'is_true', probeOnNull: true },
            }),
            node('n8', 800, 'ACTION', 'MESSAGE', 'Welcome (AI)', { aiEnabled: true, message: '' }),
            node('end_ok', 900, 'ACTION', 'END', 'End'),
            node('end_follow_only', 1000, 'ACTION', 'END', 'Following — stays in feed'),
        ],
        edges: [
            edge('trigger', 'n1'), edge('n1', 'n2'), edge('n2', 'n3'),
            edge('n3', 'n4'), edge('n4', 'n5'), edge('n5', 'n6'), edge('n6', 'n7'),
            { ...edge('n7', 'n8'), sourceHandle: 'true' },
            edge('n8', 'end_ok'),
            { ...edge('n7', 'end_follow_only'), sourceHandle: 'false' },
        ],
    },
};
