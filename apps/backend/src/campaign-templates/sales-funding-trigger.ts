import { TemplateDefinition } from './types';
import { coldInvite } from './shapes';

export const salesFundingTriggerTemplate: TemplateDefinition = {
    id: 'sales-funding-trigger',
    name: 'Funding Trigger',
    description:
        'Reach decision-makers at companies that just announced funding, while the news is fresh. A genuine congratulations invite, then a message that connects the raise to a problem you solve (scaling the team, new tooling spend), then a proof-led bump. Timing is the whole edge — run it within days of the announcement.',
    useCase: 'Working a list scraped from a funding-announcement source (Crunchbase, news, "we raised" posts) where the company now has budget and urgency.',
    bestFor:
        'Best for: AEs selling into recently-funded startups. Also useful for: recruiters pitching scaling support, agencies offering post-raise execution help.',
    recommendedFor: [
        'AEs selling into newly-funded companies',
        'Agencies offering post-raise execution capacity',
        'Recruiters pitching rapid scaling support',
    ],
    group: 'action-triggered',
    category: 'linkedin',
    audience: 'cold',
    icp: 'sales',
    icon: '💰',
    color: 'from-emerald-500 to-green-600',
    durationDays: 9,
    stepCount: 6,
    delayCount: 3,
    aiStrategyHint: {
        objective:
            'Use the funding announcement as a timely, sincere reason to connect, then tie the raise to a concrete need the capital creates and that you can help with.',
        description:
            'The invite note congratulates them on the raise specifically and carries no pitch — pure goodwill is what earns the accept. Adapt the depth of the pitch to seniority: for a CEO / founder, keep it light and relationship-first (they get pitched constantly post-raise); for a VP / department head, get concrete about the scaling pain the raise implies (hiring fast, new budget, standing up a function). The follow-up leads with a relevant proof point — someone similar you helped right after their raise. Never imply you only reached out because of the money.',
        cta: 'start a relationship and surface a post-raise need',
        toneOverride: 'professional',
    },
    workflow: coldInvite({ beforeConnectDays: 1, afterAcceptDays: 3, betweenMsgsDays: 5, messageCount: 2 }),
};
