import { TemplateDefinition } from './types';
import { emailOnlyDrip } from './shapes';

export const agencyEmailOnlyDirectTemplate: TemplateDefinition = {
    id: 'agency-email-only-direct',
    name: 'Email-Only Direct',
    description:
        'Zero LinkedIn write actions. Visit the profile for enrichment, find their email, then send two AI-crafted emails spaced 5 days apart. Protects your LinkedIn account from any DM/invite risk while still running real outbound.',
    useCase: 'Outreach where the user wants to protect their LinkedIn account or has been flagged before.',
    bestFor:
        'Best for: agencies and consultants whose LinkedIn account is irreplaceable. Also useful for: anyone post-LinkedIn-warning, regulated industries with strict outreach rules, multi-account operators consolidating risk.',
    recommendedFor: [
        'Agencies protecting an irreplaceable LinkedIn account',
        'Operators post-LinkedIn-warning',
        'Regulated-industry outbound (financial advisors, etc.)',
    ],
    group: 'out-of-network',
    category: 'email',
    audience: 'cold',
    icp: 'agency',
    icon: '🛡️',
    color: 'from-stone-500 to-amber-600',
    durationDays: 6,
    stepCount: 5,
    delayCount: 1,
    requires: ['email-finder', 'email'],
    aiStrategyHint: {
        objective:
            'Open a conversation via email only, using LinkedIn purely as an enrichment source for personalization.',
        description:
            'The first email leads with a single concrete reference from their profile and ends with one specific question. The follow-up adds a relevant outcome story and asks whether the question still resonates. Both emails must read as 1:1; if either could be a template, the campaign has failed.',
        cta: 'reply by email',
        toneOverride: 'professional',
    },
    workflow: emailOnlyDrip({ betweenEmailsDays: 5 }),
};
