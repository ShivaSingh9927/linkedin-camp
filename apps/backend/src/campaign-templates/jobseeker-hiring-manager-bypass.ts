import { TemplateDefinition } from './types';
import { engageThenInvite } from './shapes';

export const jobseekerHiringManagerBypassTemplate: TemplateDefinition = {
    id: 'jobseeker-hiring-manager-bypass',
    name: 'Hiring Manager Bypass',
    description:
        'Skip the ATS — engage with the hiring manager directly. Like and comment on their content first, then connect, then send a brief AI-crafted note that references the role and your relevant work.',
    useCase: 'Job seeker who has identified the actual hiring manager (not the recruiter) and wants to get on their radar.',
    bestFor:
        'Best for: job seekers targeting specific roles at specific companies. Also useful for: career switchers building authentic relationships before applying.',
    recommendedFor: [
        'IC-to-senior IC role applicants',
        'Career switchers bypassing the ATS funnel',
        'Anyone applying to a tight-knit team',
    ],
    group: 'out-of-network',
    category: 'linkedin',
    audience: 'cold',
    icp: 'job-seeker',
    icon: '🛂',
    color: 'from-rose-500 to-red-600',
    durationDays: 4,
    stepCount: 7,
    delayCount: 2,
    aiStrategyHint: {
        objective:
            'Get the hiring manager to read your application or invite you to a conversation by establishing presence before the ask.',
        description:
            'The comment should engage with the substance of their post (a question, a perspective) — not flatter. The connect note must say you noticed the role and one reason it fits. The welcome message states one concrete relevant outcome from your prior work and offers to send your portfolio or resume. Never desperate, never generic.',
        cta: 'open a hiring-manager conversation',
        toneOverride: 'confident',
    },
    workflow: engageThenInvite({ beforeConnectDays: 1, afterAcceptDays: 3, withMessage: true }),
};
