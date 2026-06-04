import { TemplateDefinition } from './types';
import { channelSplitter } from './shapes';

export const salesChannelSplitterTemplate: TemplateDefinition = {
    id: 'sales-channel-splitter',
    name: 'Channel Splitter',
    description:
        'Send a LinkedIn invite. If accepted, run two AI messages on LinkedIn. If rejected, switch to email: find the address and run two emails. One channel per lead, decided at runtime — saves email-finder credits on accepted invites.',
    useCase: 'Outbound where you want one channel per lead, automatically chosen based on whether the invite lands.',
    bestFor:
        'Best for: AEs running cost-conscious multi-channel outbound. Also useful for: agencies where every email-finder call costs money, founders tightening unit economics.',
    recommendedFor: [
        'AEs running cost-conscious outbound',
        'Agencies with metered enrichment budget',
        'Founders running tight unit economics',
    ],
    group: 'out-of-network',
    category: 'multi-channel',
    audience: 'cold',
    icp: 'sales',
    icon: '🔀',
    color: 'from-cyan-500 to-blue-600',
    durationDays: 12,
    stepCount: 9,
    delayCount: 4,
    requires: ['email-finder', 'email'],
    aiStrategyHint: {
        objective:
            'Reach the prospect on whichever channel is actually available — LinkedIn if they accept the invite, email if they don\'t.',
        description:
            'The LinkedIn path assumes acceptance is the signal of interest; messages can be relatively warm. The email path assumes LinkedIn was rejected, so emails must open with substance and a concrete reason to reply — no familiar tone. Same value proposition, different framing per channel.',
        cta: 'open a conversation on whichever channel responds',
        toneOverride: 'professional',
    },
    workflow: channelSplitter({ beforeConnectDays: 1, afterAcceptDays: 3, betweenMsgsDays: 5 }),
};
