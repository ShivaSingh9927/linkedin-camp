import { TemplateDefinition } from './types';
import { coldInvite } from './shapes';

export const recruiterPassiveCandidateReachTemplate: TemplateDefinition = {
    id: 'recruiter-passive-candidate-reach',
    name: 'Passive Candidate Reach',
    description:
        'Faster cadence (1d/2d/4d) because hiring has a clock. Connect with a role-fit note, then two messages: one role pitch, one nudge that respects their time.',
    useCase: 'Recruiter sourcing passive candidates for an open role.',
    bestFor:
        'Best for: in-house and agency recruiters sourcing candidates. Also useful for: hiring managers DIY-sourcing for a key role, founders hiring early team.',
    recommendedFor: [
        'In-house TA sourcing specialists',
        'Agency recruiters working contingent searches',
        'Hiring managers hiring directly',
    ],
    group: 'out-of-network',
    category: 'linkedin',
    audience: 'cold',
    icp: 'recruiter',
    icon: '🧲',
    color: 'from-indigo-500 to-blue-600',
    durationDays: 7,
    stepCount: 6,
    delayCount: 3,
    aiStrategyHint: {
        objective:
            'Get a passive candidate to take an exploratory call about a specific role by leading with role-fit, not a generic recruiter pitch.',
        description:
            'Connect note names one specific signal from their headline or projects that maps to the role. Welcome message describes the role in two sentences (mission, scope, comp band if known) and asks if it is worth 20 minutes. Follow-up offers to send the JD instead of pushing for a call. Never use "exciting opportunity".',
        cta: 'book a 20-min role chat',
        toneOverride: 'respectful',
    },
    workflow: coldInvite({ beforeConnectDays: 1, afterAcceptDays: 2, betweenMsgsDays: 4, messageCount: 2 }),
};
