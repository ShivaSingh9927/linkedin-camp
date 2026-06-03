import { TemplateDefinition } from './types';
import { node, edge } from './helpers';

export const vcAttentionGrabberTemplate: TemplateDefinition = {
    id: 'vc-attention-grabber',
    name: 'VC Attention Grabber',
    description:
        'Multi-touch investor outreach. Follow, engage with their content, find their email, and conditionally send a pitch only when a valid address is resolved.',
    useCase: 'Multi-touch outreach to investors',
    recommendedFor: ['Founders seeking funding', 'Startup CEOs'],
    group: 'objective-based',
    category: 'multi-channel',
    persona: 'vc-founder',
    icon: '🚀',
    color: 'from-amber-500 to-orange-600',
    durationDays: 5,
    stepCount: 5,
    delayCount: 2,
    requires: ['email-finder', 'email'],
    aiStrategyHint: {
        objective:
            "Get a warm introduction to an investor's inbox by engaging with their content first, then emailing a concise pitch.",
        description:
            'VCs are inundated with cold pitches. This sequence builds familiarity by following and engaging with their recent posts before reaching out via email. The AI should craft post comments that add genuine value (not just "great post!"), and the email should be tight — problem, traction, ask.',
        cta: 'reply-to-email',
        toneOverride: 'professional',
    },
    workflow: {
        nodes: [
            node('trigger', 0, 'TRIGGER', 'START', 'Trigger: Lead Added'),
            node('n1', 100, 'ACTION', 'FOLLOW', 'Follow'),
            node('n2', 200, 'DELAY', 'WAIT', 'Wait 2 days', { delayDays: 2 }),
            {
                id: 'n3',
                type: 'ACTION',
                subType: 'LIKE',
                position: { x: 150, y: 300 },
                data: {
                    label: 'Like 1st Post',
                    type: 'ACTION',
                    subType: 'LIKE',
                    postIndex: 0,
                },
            },
            {
                id: 'n4',
                type: 'ACTION',
                subType: 'COMMENT',
                position: { x: 350, y: 300 },
                data: {
                    label: 'Comment on 1st Post',
                    type: 'ACTION',
                    subType: 'COMMENT',
                    postIndex: 0,
                    message: '',
                },
            },
            node('n5', 400, 'DELAY', 'WAIT', 'Wait 2 days', { delayDays: 2 }),
            node('n6', 500, 'ACTION', 'EMAIL_FINDER', 'Find Email'),
            node('n7', 600, 'CONDITION', 'IF_ELSE', 'Email Found?', {
                condition: {
                    source: 'storedOutputs',
                    field: 'email-finder.email',
                    operator: 'is_not_null',
                },
            }),
            node('n8', 700, 'ACTION', 'EMAIL', 'Send Email', {
                subject: '',
                message: '',
            }),
            node('n9', 800, 'ACTION', 'END', 'End'),
        ],
        edges: [
            edge('trigger', 'n1'),
            edge('n1', 'n2'),
            edge('n2', 'n3'),
            edge('n2', 'n4'),
            edge('n3', 'n5'),
            edge('n4', 'n5'),
            edge('n5', 'n6'),
            edge('n6', 'n7'),
            { id: 'e_n7_n8', source: 'n7', target: 'n8', sourceHandle: 'true' },
            { id: 'e_n7_n9', source: 'n7', target: 'n9', sourceHandle: 'false' },
        ],
    },
};
