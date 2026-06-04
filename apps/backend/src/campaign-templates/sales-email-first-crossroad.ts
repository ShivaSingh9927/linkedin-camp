import { TemplateDefinition } from './types';
import { emailFirstCrossroad } from './shapes';

export const salesEmailFirstCrossroadTemplate: TemplateDefinition = {
    id: 'sales-email-first-crossroad',
    name: 'Email-First Crossroad',
    description:
        'Try email first. If found, run two emails and a LinkedIn connect at the end. If no email can be resolved, fall back to a cold LinkedIn invite. Inverts the usual LinkedIn-first sequence — better for email-rich CRMs.',
    useCase: 'Outbound where the CRM has reliable email coverage and LinkedIn is the backup channel.',
    bestFor:
        'Best for: sales teams whose CRM imports already include verified emails. Also useful for: agency outbound where email is the primary channel and LinkedIn is supplemental.',
    recommendedFor: [
        'Sales teams with email-rich CRM imports',
        'Email-primary outbound motions',
        'Agencies blending email-first with LinkedIn backup',
    ],
    group: 'out-of-network',
    category: 'multi-channel',
    audience: 'cold',
    icp: 'sales',
    icon: '↩️',
    color: 'from-rose-500 to-orange-500',
    durationDays: 11,
    stepCount: 7,
    delayCount: 2,
    requires: ['email-finder', 'email'],
    aiStrategyHint: {
        objective:
            'Lead with email when you have it; fall back to LinkedIn only when you don\'t.',
        description:
            'When email is found, the first email is the opener — single concrete reference, single question. The second is a value-add (an outcome, a relevant resource), no re-pitch. The LinkedIn invite at the end of the email branch should reference the email thread directly. The LinkedIn fallback (no email) reads as a normal cold outreach.',
        cta: 'reply by email or accept the invite',
        toneOverride: 'professional',
    },
    workflow: emailFirstCrossroad({ betweenEmailsDays: 4, afterEmailLIDays: 3 }),
};
