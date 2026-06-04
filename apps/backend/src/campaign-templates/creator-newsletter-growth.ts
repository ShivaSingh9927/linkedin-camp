import { TemplateDefinition } from './types';
import { engageThenInvite } from './shapes';

export const creatorNewsletterGrowthTemplate: TemplateDefinition = {
    id: 'creator-newsletter-growth',
    name: 'Newsletter Growth',
    description:
        'Engage authentically, then invite to connect, then send a brief AI-crafted note that mentions your newsletter — only if the lead\'s recent posts suggest topical fit. Soft, content-led acquisition.',
    useCase: 'Creator growing a niche newsletter by warming up target subscribers before mentioning the publication.',
    bestFor:
        'Best for: newsletter operators in a clear vertical. Also useful for: podcast hosts inviting guests, course creators with a free-to-paid funnel.',
    recommendedFor: [
        'Newsletter operators with a vertical focus',
        'Podcast hosts sourcing guests',
        'Course creators with a free tier',
    ],
    group: 'out-of-network',
    category: 'linkedin',
    audience: 'cold',
    icp: 'creator',
    icon: '✉️',
    color: 'from-pink-500 to-rose-600',
    durationDays: 7,
    stepCount: 7,
    delayCount: 2,
    aiStrategyHint: {
        objective:
            'Convert relevant LinkedIn engagement into newsletter subscribers by mentioning the publication only after rapport, and only when topical fit is clear.',
        description:
            'The comment must engage with the substance of their post. The connect note should reference that engagement and what you write about. The welcome message should describe the newsletter in one line (audience, value, cadence) and end with "happy to send a recent issue if you want a look" — the user opts in.',
        cta: 'invite to subscribe',
        toneOverride: 'friendly',
    },
    workflow: engageThenInvite({ beforeConnectDays: 2, afterAcceptDays: 5, withMessage: true }),
};
