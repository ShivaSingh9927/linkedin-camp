import { TemplateDefinition } from './types';
import { node, edge } from './helpers';

export const fluffFreeIntroTemplate: TemplateDefinition = {
    id: 'fluff-free-intro',
    name: 'Fluff-Free Intro',
    description:
        'Visit the prospect\'s profile, then immediately send a personalized connection note. No delays, no follow-ups — just a direct, human intro.',
    useCase: 'Direct connect with personalized note, no delays',
    recommendedFor: [
        'Founders reaching out to potential partners',
        'Sales reps with a strong, specific reason to connect',
    ],
    group: 'out-of-network',
    category: 'linkedin',
    icon: '⚡',
    color: 'from-amber-500 to-red-500',
    durationDays: 1,
    stepCount: 2,
    delayCount: 0,
    aiStrategyHint: {
        objective: 'Get a connection acceptance through a highly personalized note.',
        description:
            'Visit the profile for enrichment, then send a connection request with an AI-written note that references a specific detail from the lead\'s profile or activity. No waiting — strike while the iron is warm.',
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
            node('n2', 200, 'ACTION', 'CONNECT', 'Send Invite (AI note)', {
                message: '',
            }),
        ],
        edges: [
            edge('trigger', 'n1'),
            edge('n1', 'n2'),
        ],
    },
};
