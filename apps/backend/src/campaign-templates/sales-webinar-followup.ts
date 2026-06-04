import { TemplateDefinition } from './types';
import { warmDM } from './shapes';

export const salesWebinarFollowupTemplate: TemplateDefinition = {
    id: 'sales-webinar-followup',
    name: 'Webinar Follow-up',
    description:
        'Convert webinar / virtual event attendees into qualified pipeline. Two messages: one references the webinar and a specific topic, the second offers a relevant resource and proposes a call. Assumes connection was made post-event.',
    useCase: 'Sales following up on a webinar attendee list to convert engaged audience into pipeline.',
    bestFor:
        'Best for: SDRs and AEs running webinar-driven pipeline. Also useful for: marketing converting MQLs to SQLs post-event.',
    recommendedFor: [
        'SDRs / AEs converting webinar attendees',
        'Marketing post-event MQL→SQL handoff',
        'Field marketing post-virtual-event',
    ],
    group: 'my-network',
    category: 'linkedin',
    audience: 'connected',
    icp: 'sales',
    icon: '🎤',
    color: 'from-blue-500 to-cyan-600',
    durationDays: 6,
    stepCount: 4,
    delayCount: 2,
    aiStrategyHint: {
        objective:
            'Convert webinar attendance into a qualified discovery call by referencing the shared event context first.',
        description:
            'Message 1: thank them for joining the webinar, reference one specific topic or question from the session (use the strategy hint or event context). Message 2: share a related resource the audience asked for, and propose a 20-minute call. Never re-pitch the webinar topic.',
        cta: 'book a 20-min discovery from webinar interest',
        toneOverride: 'professional',
    },
    workflow: warmDM({ beforeFirstMsgDays: 1, betweenMsgsDays: 4, messageCount: 2 }),
};
