import { TemplateDefinition } from './types';
import { node, edge } from './helpers';

export const twoStepNurtureTemplate: TemplateDefinition = {
    id: 'two-step-nurture',
    name: 'Two-Step Nurture',
    description:
        'Visit a profile, send an initial message, wait 4 days, then send a follow-up message to re-engage.',
    useCase: 'Nurture with two follow-up messages',
    recommendedFor: [
        'Sales reps running nurture sequences',
        'Recruiters following up with passive candidates',
        'Founders building relationships over time',
    ],
    group: 'my-network',
    category: 'linkedin',
    audience: 'connected',
    icon: '🌱',
    color: 'from-green-400 to-emerald-500',
    durationDays: 5,
    stepCount: 3,
    delayCount: 1,
    aiStrategyHint: {
        objective:
            'Nurture a 1st-degree connection with an initial message and a timed follow-up.',
        description:
            'Visit the profile to gather context, then send an opening message. Wait 4 days — long enough to avoid being pushy but soon enough to stay top-of-mind — then send a follow-up that adds value or asks a specific question.',
        cta: 'nurture',
        toneOverride: 'supportive',
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
            node('n2', 200, 'ACTION', 'MESSAGE', 'First Message (AI)', { aiEnabled: true, message: '',
            }),
            node('n3', 300, 'DELAY', 'WAIT', 'Wait 4 days', { delayDays: 4 }),
            node('n4', 400, 'ACTION', 'MESSAGE', 'Follow-up (AI)', { aiEnabled: true, message: '',
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
