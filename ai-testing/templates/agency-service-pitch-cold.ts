import { TemplateDefinition } from './types';
import { coldInvite } from './shapes';

export const agencyServicePitchColdTemplate: TemplateDefinition = {
    id: 'agency-service-pitch-cold',
    name: 'Agency Service Pitch',
    description:
        'For service businesses pitching cold accounts. Longer cadence (2d/4d/7d) and a case-study angle on the second touch — trust beats urgency in services sales.',
    useCase: 'Agency owner or freelancer building a steady inbound pipeline from outbound activity.',
    bestFor:
        'Best for: agency owners pitching new client work. Also useful for: independent consultants, fractional execs, freelance specialists.',
    recommendedFor: [
        'Agency founders / business developers',
        'Fractional CFOs/CMOs/CTOs',
        'Independent consultants pitching retainer work',
    ],
    group: 'out-of-network',
    category: 'linkedin',
    audience: 'cold',
    icp: 'agency',
    icon: '🤝',
    color: 'from-cyan-500 to-blue-600',
    durationDays: 13,
    stepCount: 6,
    delayCount: 3,
    aiStrategyHint: {
        objective:
            'Earn the right to a discovery call by demonstrating relevant outcomes before asking for time.',
        description:
            'The connect note should reference one concrete signal that this account has the problem you solve. The welcome message should describe a similar engagement and the outcome in metrics. The follow-up should propose a 30-minute call to walk through the playbook applied to their context. Never lead with deliverables or pricing.',
        cta: 'book a 30-min strategy call',
        toneOverride: 'consultative',
    },
    workflow: coldInvite({ beforeConnectDays: 2, afterAcceptDays: 4, betweenMsgsDays: 7, messageCount: 2 }),
};
