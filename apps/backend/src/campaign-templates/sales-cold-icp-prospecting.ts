import { TemplateDefinition } from './types';
import { coldInvite } from './shapes';

export const salesColdIcpProspectingTemplate: TemplateDefinition = {
    id: 'sales-cold-icp-prospecting',
    name: 'Cold ICP Prospecting',
    description:
        'Volume-friendly cold outbound: visit, connect with AI note, then three sequenced messages that build context before asking for time. Safe cadence: 1d / 3d / 5d.',
    useCase: 'BD / SDR / AE running outbound against a tight ICP and willing to let the sequence do the qualification.',
    bestFor:
        'Best for: SDRs and AEs in B2B SaaS doing top-of-funnel pipeline generation. Also useful for: agency owners pitching service work, partnerships leads.',
    recommendedFor: [
        'B2B SaaS SDRs / AEs',
        'Sales engineers prospecting technical buyers',
        'Anyone whose KPI is meetings booked',
    ],
    group: 'out-of-network',
    category: 'linkedin',
    audience: 'cold',
    icp: 'sales',
    icon: '🎯',
    color: 'from-blue-500 to-indigo-600',
    durationDays: 9,
    stepCount: 7,
    delayCount: 3,
    aiStrategyHint: {
        objective:
            'Book a discovery call with a cold ICP-fit prospect by sequencing three short messages that each earn the next reply.',
        description:
            'Message 1: introduce the why behind the outreach in one sentence and ask if they are the right person. Message 2: share a single relevant outcome or insight, no pitch. Message 3: propose a 15-minute call with a concrete agenda. Each message must reference detail from the lead profile or company so it cannot be mistaken for a template.',
        cta: 'book a 15-min discovery call',
        toneOverride: 'professional',
    },
    workflow: coldInvite({ beforeConnectDays: 1, afterAcceptDays: 3, betweenMsgsDays: 5, messageCount: 3 }),
};
