import { TemplateDefinition } from './types';
import { coldInvite } from './shapes';

export const jobseekerRecruiterReachTemplate: TemplateDefinition = {
    id: 'jobseeker-recruiter-reach',
    name: 'Recruiter Reach',
    description:
        'Approach in-house and agency recruiters directly. Visit, connect with a profile-relevance note, then two messages: one positioning you against active roles, one offering to send your resume on request.',
    useCase: 'Job seeker building relationships with recruiters who source for their target companies.',
    bestFor:
        'Best for: senior ICs and managers who want to be considered by recruiters in their niche. Also useful for: candidates open to multiple companies in the same space.',
    recommendedFor: [
        'Senior IC / manager candidates',
        'Candidates with a flexible target company list',
        'Anyone exploring the market quietly',
    ],
    group: 'out-of-network',
    category: 'linkedin',
    audience: 'cold',
    icp: 'job-seeker',
    icon: '🎯',
    color: 'from-sky-500 to-cyan-600',
    durationDays: 9,
    stepCount: 6,
    delayCount: 3,
    aiStrategyHint: {
        objective:
            'Get on the recruiter\'s shortlist by positioning your background clearly against the kinds of roles they source for.',
        description:
            'Connect note: one line on your area of expertise that matches what this recruiter typically lists. Welcome message: three lines — current state, target role type, comp expectations or location flexibility. Follow-up: offer the resume and ask whether your profile is a fit for anything they are working on now. Confident, not pleading.',
        cta: 'get on the shortlist',
        toneOverride: 'confident',
    },
    workflow: coldInvite({ beforeConnectDays: 1, afterAcceptDays: 3, betweenMsgsDays: 5, messageCount: 2 }),
};
