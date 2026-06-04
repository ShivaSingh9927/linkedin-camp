import { TemplateDefinition } from './types';
import { smartAudienceRouter } from './shapes';

export const universalSmartAudienceRouterTemplate: TemplateDefinition = {
    id: 'universal-smart-audience-router',
    name: 'Smart Audience Auto-Router',
    description:
        'One template, any list. Detects each lead\'s connection degree at runtime: 1st-degree leads get a direct two-message warm sequence; 2nd/3rd-degree leads get a full cold connect-then-DM path. Pick this when your list is mixed and you don\'t want to split it.',
    useCase: 'Anyone with a mixed-degree lead list who wants one campaign to handle everyone correctly.',
    bestFor:
        'Best for: imported CSVs of unknown connection state. Also useful for: post-event lead lists, scraper imports, founder rolodex outreach where the network is messy.',
    recommendedFor: [
        'Anyone importing a mixed CSV',
        'Post-event follow-up lists',
        'Founder rolodex outreach',
    ],
    group: 'objective-based',
    category: 'linkedin',
    audience: 'mixed',
    icp: 'universal',
    icon: '🧭',
    color: 'from-indigo-500 to-violet-600',
    durationDays: 10,
    stepCount: 9,
    delayCount: 4,
    aiStrategyHint: {
        objective:
            'Deliver the right opening message for each lead based on connection degree — warm/direct for existing connections, cold/connect-first for prospects.',
        description:
            'Two message tones must coexist in this template. The warm path is direct and familiar — assume the lead recognizes you. The cold path is curious and earns the right to a reply via reference to specific work. The AI should detect which path it is on (the prompt will include connectionDegree) and adjust tone accordingly.',
        cta: 'open the right conversation per lead',
        toneOverride: 'adaptive',
    },
    workflow: smartAudienceRouter({
        coldBeforeConnectDays: 1,
        coldAfterAcceptDays: 3,
        warmBeforeMsgDays: 1,
        betweenMsgsDays: 5,
    }),
};
