import { TemplateDefinition } from './types';
import { reactivation } from './shapes';

export const creatorLapsedSubscriberWinbackTemplate: TemplateDefinition = {
    id: 'creator-lapsed-subscriber-winback',
    name: 'Lapsed Subscriber Win-back',
    description:
        'Win back newsletter subscribers, community members, or course alumni who went quiet. Visit, like a recent post of theirs to soften the approach, then a two-message reactivation: what\'s new, then a specific ask.',
    useCase: 'Creator reactivating audience who stopped engaging — newsletter unsubscribes, dormant community members, course alumni.',
    bestFor:
        'Best for: newsletter operators with churned subscribers. Also useful for: course creators with completed-but-quiet alumni, community managers reviving inactive members.',
    recommendedFor: [
        'Newsletter operators with churn',
        'Course creators reviving alumni',
        'Community managers with dormant members',
    ],
    group: 'my-network',
    category: 'linkedin',
    audience: 'connected',
    icp: 'creator',
    icon: '🌅',
    color: 'from-orange-400 to-yellow-500',
    durationDays: 8,
    stepCount: 6,
    delayCount: 2,
    aiStrategyHint: {
        objective:
            'Re-engage a dormant audience member by acknowledging the gap honestly and offering one specific reason to come back.',
        description:
            'Message 1: name the silence directly — "I noticed you haven\'t opened the newsletter in a while" — then share one specific change or new direction. Message 2: offer a concrete asset (a top-read issue, a new format, an invite to a member-only post) — no guilt, no "we miss you" mass-email tone.',
        cta: 're-engage with a single specific value-add',
        toneOverride: 'sincere',
    },
    workflow: reactivation({ beforeFirstMsgDays: 1, betweenMsgsDays: 6, messageCount: 2 }),
};
