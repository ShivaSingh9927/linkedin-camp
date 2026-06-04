import { TemplateDefinition } from './types';
import { engageThenInvite } from './shapes';

export const recruiterAlumniNetworkReachTemplate: TemplateDefinition = {
    id: 'recruiter-alumni-network-reach',
    name: 'Alumni Network Reach',
    description:
        'Recruit through shared-school / shared-employer alumni networks. Engage with their content first (most alumni accept based on shared affiliation), then invite, then a brief role pitch. Higher accept rate than cold recruiter outreach.',
    useCase: 'Recruiter sourcing through alumni or shared-company networks for warmer outreach.',
    bestFor:
        'Best for: in-house TA leveraging founder/employee alumni networks. Also useful for: agency recruiters with vertical specialization, hiring managers tapping their network.',
    recommendedFor: [
        'In-house TA with employee alumni networks',
        'Hiring managers leveraging personal alumni',
        'Agency recruiters in a tight vertical',
    ],
    group: 'out-of-network',
    category: 'linkedin',
    audience: 'cold',
    icp: 'recruiter',
    icon: '🎓',
    color: 'from-violet-500 to-purple-600',
    durationDays: 6,
    stepCount: 6,
    delayCount: 2,
    aiStrategyHint: {
        objective:
            'Get a passive candidate to engage by leading with the shared alumni / company affiliation rather than the recruiter pitch.',
        description:
            'The comment on their post should be substantive — about their work, not about the affiliation. The connect note names the shared school or company in one phrase, then states one reason the role connects to their experience. The welcome message is short and offers to send the JD before pushing for a call.',
        cta: 'open a candidate conversation via affiliation',
        toneOverride: 'familiar',
    },
    workflow: engageThenInvite({ beforeConnectDays: 1, afterAcceptDays: 2, withMessage: true }),
};
