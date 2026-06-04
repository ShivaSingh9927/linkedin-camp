import { TemplateDefinition } from './types';
import { warmDM } from './shapes';

export const founderConferenceConnectorTemplate: TemplateDefinition = {
    id: 'founder-conference-connector',
    name: 'Conference Connector',
    description:
        'Convert in-person event leads into real conversations. Two messages: one references the specific event and what you discussed; the follow-up proposes a concrete next step. Assumes leads are already connected post-event.',
    useCase: 'Founder following up on a stack of business cards or LinkedIn connections from an event.',
    bestFor:
        'Best for: founders after a conference, summit, or trade show. Also useful for: BD reps post-industry event, recruiters post-hiring fair.',
    recommendedFor: [
        'Founders after a major conference',
        'BD reps post-industry event',
        'Recruiters post-hiring fair',
    ],
    group: 'my-network',
    category: 'linkedin',
    audience: 'connected',
    icp: 'founder',
    icon: '🎟️',
    color: 'from-rose-400 to-pink-500',
    durationDays: 6,
    stepCount: 4,
    delayCount: 2,
    aiStrategyHint: {
        objective:
            'Convert event-introduction warmth into a substantive follow-up before the lead forgets you.',
        description:
            'The first message must reference one concrete detail from the in-person exchange (a topic, a session, a mutual contact) — generic "great meeting you" gets ignored. The follow-up should propose a specific next step (a call, a resource, an introduction) within five days while memory is fresh.',
        cta: 'lock in a follow-up while memory is fresh',
        toneOverride: 'warm',
    },
    workflow: warmDM({ beforeFirstMsgDays: 1, betweenMsgsDays: 5, messageCount: 2 }),
};
