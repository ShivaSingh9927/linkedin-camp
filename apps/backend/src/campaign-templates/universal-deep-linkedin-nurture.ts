import { TemplateDefinition } from './types';
import { coldInvite } from './shapes';

export const universalDeepLinkedinNurtureTemplate: TemplateDefinition = {
    id: 'universal-deep-linkedin-nurture',
    name: 'Deep LinkedIn Nurture',
    description:
        'Connect, then four spaced AI-crafted LinkedIn messages over three weeks. No email at all — pure LinkedIn nurture for users who don\'t want to use email-finder credits or whose audience prefers the platform.',
    useCase: 'LinkedIn-native nurture for users who want depth without involving email channels.',
    bestFor:
        'Best for: anyone with no email tooling or a LinkedIn-only audience. Also useful for: creators selling to LinkedIn-active buyers, recruiters whose candidates prefer LinkedIn.',
    recommendedFor: [
        'Users without email-finder access',
        'Creators selling to LinkedIn-native buyers',
        'Recruiters working passive LinkedIn talent',
    ],
    group: 'out-of-network',
    category: 'linkedin',
    audience: 'cold',
    icp: 'universal',
    icon: '🧶',
    color: 'from-indigo-500 to-blue-700',
    durationDays: 20,
    stepCount: 8,
    delayCount: 4,
    aiStrategyHint: {
        objective:
            'Convert a cold LinkedIn invite into a conversation through four well-spaced messages that build a real relationship.',
        description:
            'Messages should escalate: open (one-line introduction tying to their work), provide (a relevant insight or resource), question (an open-ended ask about their world), propose (a concrete next step). Each is single-purpose and short — never a wall of text.',
        cta: 'open a real LinkedIn conversation',
        toneOverride: 'conversational',
    },
    workflow: coldInvite({ beforeConnectDays: 1, afterAcceptDays: 3, betweenMsgsDays: 5, messageCount: 4 }),
};
