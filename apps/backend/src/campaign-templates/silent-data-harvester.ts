import { TemplateDefinition } from './types';
import { node, edge } from './helpers';

export const silentDataHarvesterTemplate: TemplateDefinition = {
    id: 'silent-data-harvester',
    name: 'Silent Data Harvester',
    description:
        'Visit a profile to enrich lead data. If an email is found via the email-finder, the enriched data automatically syncs to your CRM — silently, without any direct message to the lead.',
    useCase: 'Enrich leads silently without direct outreach',
    recommendedFor: [
        'SDRs building lead lists before outbound campaigns',
        'Marketers enriching CRM data at scale',
        'Recruiters gathering intel before reaching out',
    ],
    group: 'my-network',
    category: 'linkedin',
    icon: '🎯',
    color: 'from-emerald-400 to-teal-500',
    durationDays: 0,
    stepCount: 2,
    delayCount: 0,
    requires: ['email-finder', 'crm-sync'],
    aiStrategyHint: {
        objective:
            'Enrich lead data silently by visiting the profile and extracting contact info — CRM sync is automatic and event-driven.',
        description:
            'Profile visit triggers data enrichment. The email-finder attempts to resolve a contact email. The lead is automatically pushed to your connected CRM the moment they enter the campaign and on every lifecycle event after. No outreach occurs — this is purely a data pipeline.',
        cta: 'none',
        toneOverride: 'neutral',
    },
    workflow: {
        nodes: [
            node('trigger', 0, 'TRIGGER', 'START', 'Trigger: Lead Added'),
            node('n1', 100, 'ACTION', 'PROFILE_VISIT', 'Visit Profile', {
                enrichCompany: true,
                enrichAbout: true,
                enrichContact: true,
                enrichPosts: false,
            }),
            node('n2', 200, 'ACTION', 'END', 'End', {}),
        ],
        edges: [
            edge('trigger', 'n1'),
            edge('n1', 'n2'),
        ],
    },
};
