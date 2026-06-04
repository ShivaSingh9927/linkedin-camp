import { TemplateDefinition } from './types';
import { warmDM } from './shapes';

export const universalLeadMagnetShareTemplate: TemplateDefinition = {
    id: 'universal-lead-magnet-share',
    name: 'Lead Magnet Share',
    description:
        'Share a valuable asset (report, template, guide) with your 1st-degree network. Two messages: one introduces the asset, one follows up with a question that opens a real conversation if they engaged.',
    useCase: 'Anyone with a 1st-degree list and a high-quality resource to distribute.',
    bestFor:
        'Best for: GTM and content teams distributing reports. Also useful for: solo creators sharing a guide, consultants leading with a checklist.',
    recommendedFor: [
        'Content / demand-gen teams',
        'Founders publishing benchmarks or guides',
        'Consultants leading with frameworks',
    ],
    group: 'my-network',
    category: 'linkedin',
    audience: 'connected',
    icp: 'universal',
    icon: '🎁',
    color: 'from-lime-500 to-green-600',
    durationDays: 6,
    stepCount: 4,
    delayCount: 2,
    aiStrategyHint: {
        objective:
            'Distribute a substantive asset to a relevant 1st-degree audience and use it as a conversation starter, not a download metric.',
        description:
            'First message describes the asset in one line and offers it directly, no gate. Follow-up asks one specific question about what they would change about it — this is the conversation starter. Never ask for a meeting in either touch.',
        cta: 'share the asset, start a conversation',
        toneOverride: 'friendly',
    },
    workflow: warmDM({ beforeFirstMsgDays: 1, betweenMsgsDays: 5, messageCount: 2 }),
};
