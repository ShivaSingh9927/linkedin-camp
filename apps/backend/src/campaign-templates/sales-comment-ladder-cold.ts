import { TemplateDefinition } from './types';
import { commentLadderColdInvite } from './shapes';

export const salesCommentLadderColdTemplate: TemplateDefinition = {
    id: 'sales-comment-ladder-cold',
    name: 'Comment Ladder Cold',
    description:
        'Three AI-crafted substantive comments on three of their posts, spaced 3 days apart, BEFORE the connect invite arrives. By the time the invite lands, the lead recognizes your name from a week of thoughtful presence on their content.',
    useCase: 'High-value cold prospecting where invite acceptance matters more than volume.',
    bestFor:
        'Best for: AEs and BDs targeting a small list of high-value accounts. Also useful for: founders pursuing strategic partners, agency owners pitching premier accounts.',
    recommendedFor: [
        'AEs working a top-20 named-account list',
        'Founders pursuing strategic partners',
        'Anyone willing to trade volume for quality',
    ],
    group: 'out-of-network',
    category: 'linkedin',
    audience: 'cold',
    icp: 'sales',
    icon: '🪜',
    color: 'from-emerald-500 to-green-600',
    durationDays: 11,
    stepCount: 7,
    delayCount: 3,
    aiStrategyHint: {
        objective:
            'Earn an extraordinary invite-acceptance rate by establishing three rounds of substantive presence on the lead\'s own content before the connect lands.',
        description:
            'Every comment must add a perspective, question, or related insight — never approval. The three comments should not feel like the same voice repeating itself; vary the angle (a question, a counterpoint, a related story). When the connect note lands, reference the comment thread, not your own offering.',
        cta: 'connect after established familiarity',
        toneOverride: 'thoughtful',
    },
    workflow: commentLadderColdInvite({ commentCount: 3, betweenCommentsDays: 3, afterAcceptDays: 3, withMessage: true }),
};
