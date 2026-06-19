import { TemplateDefinition } from './types';
import { warmDM } from './shapes';

// Purpose-built for the "Ready for follow-up · No reply" segment: leads you
// connected with (or who accepted an invite) but who never answered your
// first message. They're 1st-degree but cold — so lead with value, not a
// repeat of the same ask, and give it one gentle second touch before stopping.
export const followupNoReplyTemplate: TemplateDefinition = {
    id: 'followup-no-reply-nudge',
    name: 'Follow-up: No Reply',
    description:
        'Gently nudge connections who never replied to your first message. Confirms the connection, then sends a fresh value-led message and one final light touch — without nagging or repeating the original pitch.',
    useCase: 'Following up the leads surfaced under "Ready for follow-up · No reply" who connected but stayed silent.',
    bestFor:
        'Best for: reviving silent connections without being pushy. Also useful for: SDRs working an aged connected list, agencies nudging accepted-but-quiet prospects.',
    recommendedFor: [
        'SDRs working aged connected lists',
        'Agencies nudging silent connections',
        'Founders re-touching quiet network',
    ],
    group: 'my-network',
    category: 'linkedin',
    audience: 'connected',
    icp: 'universal',
    icon: '🔔',
    color: 'from-amber-500 to-orange-600',
    durationDays: 6,
    stepCount: 4,
    delayCount: 2,
    aiStrategyHint: {
        objective:
            'Restart a stalled one-way thread with a connection who never replied — lead with something useful, not a repeat of the original ask.',
        description:
            'This lead connected but never answered your first message. Do not resend the same pitch. Open with a new, genuinely useful angle (an insight, a resource, a relevant observation about their work) and a single low-friction question. The second touch should be even lighter — a short, no-pressure close that leaves the door open.',
        cta: 'start a conversation',
        toneOverride: 'friendly',
    },
    workflow: warmDM({ beforeFirstMsgDays: 1, betweenMsgsDays: 5, messageCount: 2 }),
};
