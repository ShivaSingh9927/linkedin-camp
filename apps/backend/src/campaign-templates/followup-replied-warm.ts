import { TemplateDefinition } from './types';
import { warmDM } from './shapes';

// Purpose-built for the "Ready for follow-up · Replied" segment: leads who
// answered you once and then went quiet. They're already 1st-degree and warm,
// so there's no invite dance — confirm still connected, then send one
// thoughtful continuation that picks the thread back up.
export const followupRepliedTemplate: TemplateDefinition = {
    id: 'followup-replied-warm',
    name: 'Follow-up: Replied',
    description:
        'Re-open a conversation with someone who replied and then went silent. Confirms the connection, then sends a single AI message that references the earlier exchange and moves it one step forward — no generic "just checking in".',
    useCase: 'Following up the leads surfaced under "Ready for follow-up · Replied" who stalled after a first reply.',
    bestFor:
        'Best for: anyone re-engaging warm replies that never converted. Also useful for: founders nudging interested-but-busy prospects, recruiters reviving candidates who showed interest.',
    recommendedFor: [
        'Sellers reviving stalled warm replies',
        'Founders nudging interested prospects',
        'Recruiters re-engaging warm candidates',
    ],
    group: 'my-network',
    category: 'linkedin',
    audience: 'connected',
    icp: 'universal',
    icon: '💬',
    color: 'from-emerald-500 to-teal-600',
    durationDays: 2,
    stepCount: 3,
    delayCount: 1,
    aiStrategyHint: {
        objective:
            'Continue an existing conversation that stalled — acknowledge the prior exchange and move it one concrete step forward.',
        description:
            'This lead already replied to you once. Do NOT reintroduce yourself or pitch from scratch. Reference what was discussed, add one new piece of value or a specific next step, and make it easy to say yes. Keep it short and human — like picking up a chat with someone you know.',
        cta: 'pick the conversation back up',
        toneOverride: 'familiar',
    },
    workflow: warmDM({ beforeFirstMsgDays: 1, betweenMsgsDays: 3, messageCount: 1 }),
};
