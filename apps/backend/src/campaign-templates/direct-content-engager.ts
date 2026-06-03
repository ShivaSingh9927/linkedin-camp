import { TemplateDefinition } from './types';
import { node, edge } from './helpers';

export const directContentEngagerTemplate: TemplateDefinition = {
    id: 'direct-content-engager',
    name: 'Direct Content Engager',
    description:
        'Like a connection\'s post to surface on their radar, then send a message that references the engagement to start a natural conversation.',
    useCase: 'Engage via content interaction first',
    recommendedFor: [
        'Professionals looking for a natural conversation starter',
        'Sales reps using content engagement as a warm intro',
        'Founders wanting to build presence before messaging',
    ],
    group: 'my-network',
    category: 'linkedin',
    audience: 'connected',
    icon: '💡',
    color: 'from-amber-400 to-orange-500',
    durationDays: 2,
    stepCount: 3,
    delayCount: 1,
    aiStrategyHint: {
        objective:
            'Start a conversation by first engaging with their content (like), then messaging with a comment reference.',
        description:
            'Like a recent post to get on their radar. After a short delay, send a message that references the liked post — ask a thoughtful question or share a relevant take to spark a reply.',
        cta: 'engage',
        toneOverride: 'conversational',
    },
    workflow: {
        nodes: [
            node('trigger', 0, 'TRIGGER', 'START', 'Trigger: Lead Added'),
            node('n1', 100, 'ACTION', 'LIKE', 'Like Recent Post', {}),
            node('n2', 200, 'DELAY', 'WAIT', 'Wait 1 day', { delayDays: 1 }),
            node('n3', 300, 'ACTION', 'MESSAGE', 'Send Message (AI)', { aiEnabled: true, message: '',
            }),
        ],
        edges: [
            edge('trigger', 'n1'),
            edge('n1', 'n2'),
            edge('n2', 'n3'),
        ],
    },
};
