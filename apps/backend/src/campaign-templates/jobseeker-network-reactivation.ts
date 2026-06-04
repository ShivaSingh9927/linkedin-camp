import { TemplateDefinition } from './types';
import { warmDM } from './shapes';

export const jobseekerNetworkReactivationTemplate: TemplateDefinition = {
    id: 'jobseeker-network-reactivation',
    name: 'Network Reactivation',
    description:
        'Re-engage your 1st-degree network for referrals or warm intros. Visit, wait, then a direct two-message sequence that says you are exploring, names the kind of role, and asks for a 15-minute call.',
    useCase: 'Job seeker tapping the part of their network that already knows them.',
    bestFor:
        'Best for: job seekers leveraging an existing professional network. Also useful for: returning-to-work parents, post-sabbatical operators, anyone re-entering the market.',
    recommendedFor: [
        'Job seekers with an active 1st-degree network',
        'Returning-to-work professionals',
        'Operators re-entering the market after a sabbatical',
    ],
    group: 'my-network',
    category: 'linkedin',
    audience: 'connected',
    icp: 'job-seeker',
    icon: '👥',
    color: 'from-teal-500 to-emerald-600',
    durationDays: 6,
    stepCount: 4,
    delayCount: 2,
    aiStrategyHint: {
        objective:
            'Activate dormant 1st-degree connections for referrals or warm intros by being direct about what you are looking for.',
        description:
            'First message: name the gap honestly ("I am exploring my next role and thought of you because..."), state the kind of role in one sentence, ask for any companies/people they would point you toward. Follow-up: thank them, share a one-line update on the search so far, ask if anyone new comes to mind. Brief is best.',
        cta: 'ask for referrals or intros',
        toneOverride: 'sincere',
    },
    workflow: warmDM({ beforeFirstMsgDays: 1, betweenMsgsDays: 5, messageCount: 2 }),
};
