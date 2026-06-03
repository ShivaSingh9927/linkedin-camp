import { TemplateDefinition } from './types';
import { node, edge } from './helpers';

// "Warm Connect (with note)" — the safe default for cold LinkedIn outreach.
//
// Flow:
//   1. Visit profile (signals attention, builds familiarity, enriches lead data
//      the AI uses to personalize step 3).
//   2. Wait 1 day (avoids the "visited + connected within 30 seconds" pattern
//      that gets accounts flagged).
//   3. Connect WITH note (the AI fills in `message` from the lead's headline,
//      about, and the user's strategy — see send-message.ts / connect.ts).
//   4. Wait 3 days for acceptance.
//   5. Send welcome message.
//   6. Wait 5 days.
//   7. Send follow-up.
//
// Message bodies are intentionally empty: the message text is generated
// per-lead at runtime from the campaign's aiContext (objective/description/cta
// + business profile + scraped lead enrichment). Leaving them blank tells the
// AI service "no override, use the strategy."
//
// The connect node performs its own "is this already a 1st-degree?" check —
// if the lead is already connected we skip the invite and proceed to message.
// The send-message node verifies the connection state and aborts cleanly if
// the invite was never accepted (rather than blasting an InMail paywall).

export const warmConnectTemplate: TemplateDefinition = {
    id: 'warm-connect-with-note',
    name: 'Warm Connect (with note)',
    description:
        'Visit profile, then send a personalized invite with note. After acceptance, an AI-generated welcome and follow-up. The safe default for cold outreach to your ICP.',
    useCase:
        'Cold outreach where you have a strong reason to connect (shared industry, role, recent post). Highest accept rate when the note is genuinely personalized — which our AI does using the lead\'s headline + your value prop.',
    recommendedFor: [
        'Founder / solo operator doing high-personalization outreach',
        'Agency reaching out on behalf of a client',
        'BD / sales targeting decision-makers in a specific niche',
    ],
    group: 'out-of-network',
    category: 'linkedin',
    audience: 'cold',
    icon: '✍️',
    color: 'from-indigo-500 to-purple-600',
    durationDays: 9,
    stepCount: 6,
    delayCount: 3,
    aiStrategyHint: {
        objective:
            'Open a conversation with a cold prospect by referencing their specific work and connecting our value to a likely pain point.',
        description:
            'First-touch cold outreach. The connection note should feel like a 1-to-1 message — reference one concrete detail from their headline or recent activity, never a generic "I came across your profile." The follow-up should add a single specific reason to reply (a question, a relevant resource, a brief observation), never a pitch.',
        cta: 'connect',
        toneOverride: 'professional',
    },
    workflow: {
        nodes: [
            node('trigger', 0, 'TRIGGER', 'START', 'Trigger: Lead Added'),
            node('n1', 100, 'ACTION', 'PROFILE_VISIT', 'Visit Profile', {
                enrichCompany: true,
                enrichAbout: true,
                enrichContact: false,
                enrichPosts: false,
            }),
            node('n2', 200, 'DELAY', 'WAIT', 'Wait 1 day', { delayDays: 1 }),
            node('n3', 300, 'ACTION', 'CONNECT', 'Send Invite (AI note)', {
                message: '',
            }),
            node('n4', 400, 'DELAY', 'WAIT', 'Wait 3 days', { delayDays: 3 }),
            node('n5', 500, 'ACTION', 'MESSAGE', 'Welcome Message (AI)', { aiEnabled: true, message: '',
            }),
            node('n6', 600, 'DELAY', 'WAIT', 'Wait 5 days', { delayDays: 5 }),
            node('n7', 700, 'ACTION', 'MESSAGE', 'Follow-up (AI)', { aiEnabled: true, message: '',
            }),
        ],
        edges: [
            edge('trigger', 'n1'),
            edge('n1', 'n2'),
            edge('n2', 'n3'),
            edge('n3', 'n4'),
            edge('n4', 'n5'),
            edge('n5', 'n6'),
            edge('n6', 'n7'),
        ],
    },
};
