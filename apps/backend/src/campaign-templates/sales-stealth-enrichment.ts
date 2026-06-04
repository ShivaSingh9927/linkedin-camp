import { TemplateDefinition } from './types';
import { node, edge } from './helpers';

export const salesStealthEnrichmentTemplate: TemplateDefinition = {
    id: 'sales-stealth-enrichment',
    name: 'Stealth Enrichment',
    description:
        'No outreach. Visit each profile with full enrichment flags on (company, about, contact), then follow as a soft presence signal — that\'s it. Use this to build a high-fidelity CRM target list before launching a human-led campaign.',
    useCase: 'Pre-campaign CRM building — capture company, role, and contact data without any DM risk.',
    bestFor:
        'Best for: SDR/AE teams enriching a target list before outbound. Also useful for: ABM list-building, founders doing market research, recruiters mapping a talent pool.',
    recommendedFor: [
        'SDR / AE pre-campaign enrichment',
        'ABM list building',
        'Recruiter talent-pool mapping',
    ],
    group: 'objective-based',
    category: 'linkedin',
    audience: 'mixed',
    icp: 'sales',
    icon: '🛰️',
    color: 'from-zinc-500 to-slate-600',
    durationDays: 1,
    stepCount: 2,
    delayCount: 0,
    aiStrategyHint: {
        objective:
            'Silently enrich CRM rows with profile data so a later human-led campaign can hit the ground running.',
        description:
            'No messages are generated. This template exists only to populate Lead records with company, role, headline, and contact data — and to leave a soft FOLLOW behind so the user appears in the lead\'s feed.',
        cta: 'enrich, then plan',
        toneOverride: 'neutral',
    },
    workflow: {
        nodes: [
            node('trigger', 0, 'TRIGGER', 'START', 'Trigger: Lead Added'),
            node('n1', 100, 'ACTION', 'PROFILE_VISIT', 'Deep Enrich', {
                enrichCompany: true, enrichAbout: true, enrichContact: true, enrichPosts: true,
            }),
            node('n2', 200, 'ACTION', 'FOLLOW', 'Soft Follow'),
            node('end_ok', 300, 'ACTION', 'END', 'End'),
        ],
        edges: [
            edge('trigger', 'n1'), edge('n1', 'n2'), edge('n2', 'end_ok'),
        ],
    },
};
