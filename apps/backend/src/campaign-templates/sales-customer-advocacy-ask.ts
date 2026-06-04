import { TemplateDefinition } from './types';
import { warmDM } from './shapes';

export const salesCustomerAdvocacyAskTemplate: TemplateDefinition = {
    id: 'sales-customer-advocacy-ask',
    name: 'Customer Advocacy Ask',
    description:
        'Reach existing 1st-degree customers to request a case study, testimonial, or G2 review. Two messages: the ask, then a polite follow-up if the first goes unanswered. No pitching — pure advocacy ask.',
    useCase: 'Sales/CS asking happy customers for advocacy assets that fuel the next round of outbound.',
    bestFor:
        'Best for: customer success and sales gathering social proof. Also useful for: marketing collecting case studies, founders building reference call lists.',
    recommendedFor: [
        'CS teams running advocacy programs',
        'Marketing collecting case studies',
        'Founders building reference lists',
    ],
    group: 'my-network',
    category: 'linkedin',
    audience: 'connected',
    icp: 'sales',
    icon: '🏆',
    color: 'from-yellow-500 to-orange-500',
    durationDays: 6,
    stepCount: 4,
    delayCount: 2,
    aiStrategyHint: {
        objective:
            'Get a concrete advocacy commitment (review, testimonial, case study) from a happy customer with minimum friction.',
        description:
            'Message 1: lead with gratitude for their continued partnership, then make a single specific ask (G2 review, 20-min case study chat, quote for landing page). Message 2: gentle nudge, no guilt — "I know you\'re busy, here\'s a 30-second version if helpful." Never blanket-pitch.',
        cta: 'request a specific advocacy commitment',
        toneOverride: 'warm',
    },
    workflow: warmDM({ beforeFirstMsgDays: 1, betweenMsgsDays: 5, messageCount: 2 }),
};
