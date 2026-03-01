// Pre-built campaign workflow templates
// Each template defines React Flow nodes/edges that match the CampaignBuilder format

export interface WorkflowTemplate {
    id: string;
    name: string;
    description: string;
    category: 'linkedin' | 'email' | 'multi-channel';
    icon: string; // emoji
    color: string; // tailwind color class
    nodes: any[];
    edges: any[];
}

const makeNode = (id: string, y: number, type: string, subType: string, label: string, extra: any = {}) => ({
    id,
    position: { x: 250, y },
    data: { label, type, subType, ...extra },
});

const makeEdge = (source: string, target: string) => ({
    id: `e_${source}_${target}`,
    source,
    target,
});

export const PREBUILT_TEMPLATES: WorkflowTemplate[] = [
    {
        id: 'linkedin-classic',
        name: 'LinkedIn Classic',
        description: 'Invite (no note) → Wait → 3 Follow-up messages with delays. Simple and effective.',
        category: 'linkedin',
        icon: '🚀',
        color: 'from-blue-500 to-indigo-600',
        nodes: [
            makeNode('trigger', 0, 'TRIGGER', 'START', 'Trigger: Lead Added'),
            makeNode('n1', 100, 'ACTION', 'INVITE', 'Send Invite (No Note)'),
            makeNode('n2', 200, 'DELAY', 'WAIT', 'Wait 1 day', { delayDays: 1 }),
            makeNode('n3', 300, 'ACTION', 'MESSAGE', 'Follow-up Message 1', { message: 'Hi {firstName}, thanks for connecting! I noticed you work at {company} as {jobTitle}. Would love to exchange insights.' }),
            makeNode('n4', 400, 'DELAY', 'WAIT', 'Wait 3 days', { delayDays: 3 }),
            makeNode('n5', 500, 'ACTION', 'MESSAGE', 'Follow-up Message 2', { message: 'Hi {firstName}, just wanted to follow up on my previous message. I think we could have an interesting conversation about your work at {company}.' }),
            makeNode('n6', 600, 'DELAY', 'WAIT', 'Wait 5 days', { delayDays: 5 }),
            makeNode('n7', 700, 'ACTION', 'MESSAGE', 'Final Follow-up', { message: 'Hi {firstName}, I understand you might be busy. Just wanted to share one last thought — feel free to reach out whenever you have time. Best regards!' }),
        ],
        edges: [
            makeEdge('trigger', 'n1'),
            makeEdge('n1', 'n2'),
            makeEdge('n2', 'n3'),
            makeEdge('n3', 'n4'),
            makeEdge('n4', 'n5'),
            makeEdge('n5', 'n6'),
            makeEdge('n6', 'n7'),
        ],
    },
    {
        id: 'linkedin-personal-note',
        name: 'LinkedIn + Personal Note',
        description: 'Visit profile first, then send invite with a personal note, followed by a message sequence.',
        category: 'linkedin',
        icon: '✍️',
        color: 'from-purple-500 to-pink-600',
        nodes: [
            makeNode('trigger', 0, 'TRIGGER', 'START', 'Trigger: Lead Added'),
            makeNode('n1', 100, 'ACTION', 'PROFILE_VISIT', 'Visit Profile'),
            makeNode('n2', 200, 'DELAY', 'WAIT', 'Wait 1 day', { delayDays: 1 }),
            makeNode('n3', 300, 'ACTION', 'INVITE', 'Send Invite (With Note)', { message: 'Hi {firstName}, I came across your profile and was impressed by your work at {company}. Would love to connect!' }),
            makeNode('n4', 400, 'DELAY', 'WAIT', 'Wait 2 days', { delayDays: 2 }),
            makeNode('n5', 500, 'ACTION', 'MESSAGE', 'Welcome Message', { message: 'Thanks for accepting, {firstName}! I noticed your role as {jobTitle} — I think we have some common interests. Would you be open to a quick chat?' }),
            makeNode('n6', 600, 'DELAY', 'WAIT', 'Wait 5 days', { delayDays: 5 }),
            makeNode('n7', 700, 'ACTION', 'MESSAGE', 'Follow-up', { message: 'Hi {firstName}, just circling back. I have some ideas that might be relevant to {company}. Let me know if you\'d like to hear more!' }),
        ],
        edges: [
            makeEdge('trigger', 'n1'),
            makeEdge('n1', 'n2'),
            makeEdge('n2', 'n3'),
            makeEdge('n3', 'n4'),
            makeEdge('n4', 'n5'),
            makeEdge('n5', 'n6'),
            makeEdge('n6', 'n7'),
        ],
    },
    {
        id: 'ai-outreach',
        name: 'AI-Powered Outreach',
        description: 'Uses AI to generate personalized icebreakers before connecting. Maximum personalization.',
        category: 'linkedin',
        icon: '🤖',
        color: 'from-indigo-500 to-violet-600',
        nodes: [
            makeNode('trigger', 0, 'TRIGGER', 'START', 'Trigger: Lead Added'),
            makeNode('n1', 100, 'ACTION', 'PROFILE_VISIT', 'Visit Profile'),
            makeNode('n2', 200, 'ACTION', 'AI_PERSONALIZE', 'AI Personalize'),
            makeNode('n3', 300, 'ACTION', 'INVITE', 'Send Invite (AI Icebreaker)', { message: '{icebreaker}' }),
            makeNode('n4', 400, 'DELAY', 'WAIT', 'Wait 3 days', { delayDays: 3 }),
            makeNode('n5', 500, 'ACTION', 'MESSAGE', 'Personalized Message', { message: 'Hi {firstName}, {icebreaker}\n\nI\'d love to chat about how we can collaborate. What do you think?' }),
            makeNode('n6', 600, 'DELAY', 'WAIT', 'Wait 5 days', { delayDays: 5 }),
            makeNode('n7', 700, 'ACTION', 'MESSAGE', 'Final Follow-up', { message: 'Hi {firstName}, just wanted to check in one more time. No pressure — just thought our work might align well. Best!' }),
        ],
        edges: [
            makeEdge('trigger', 'n1'),
            makeEdge('n1', 'n2'),
            makeEdge('n2', 'n3'),
            makeEdge('n3', 'n4'),
            makeEdge('n4', 'n5'),
            makeEdge('n5', 'n6'),
            makeEdge('n6', 'n7'),
        ],
    },
    {
        id: 'email-drip',
        name: 'Email Drip Campaign',
        description: '3-step email sequence with increasing delays between messages.',
        category: 'email',
        icon: '📧',
        color: 'from-emerald-500 to-teal-600',
        nodes: [
            makeNode('trigger', 0, 'TRIGGER', 'START', 'Trigger: Lead Added'),
            makeNode('n1', 100, 'ACTION', 'EMAIL', 'Email 1 — Introduction', { message: 'Hi {firstName},\n\nI hope this email finds you well. I came across {company} and was intrigued by your approach to the market.\n\nI\'d love to share some insights that could be valuable for your team.\n\nBest,\nYour Name' }),
            makeNode('n2', 200, 'DELAY', 'WAIT', 'Wait 2 days', { delayDays: 2 }),
            makeNode('n3', 300, 'ACTION', 'EMAIL', 'Email 2 — Value Add', { message: 'Hi {firstName},\n\nFollowing up on my previous email. I wanted to share a quick case study relevant to {company}.\n\nWould you be open to a 15-minute call this week?\n\nBest,\nYour Name' }),
            makeNode('n4', 400, 'DELAY', 'WAIT', 'Wait 4 days', { delayDays: 4 }),
            makeNode('n5', 500, 'ACTION', 'EMAIL', 'Email 3 — Final Touch', { message: 'Hi {firstName},\n\nI know your inbox must be busy, so I\'ll keep this brief. If now isn\'t the right time, no worries at all.\n\nFeel free to reach out whenever it makes sense.\n\nBest,\nYour Name' }),
        ],
        edges: [
            makeEdge('trigger', 'n1'),
            makeEdge('n1', 'n2'),
            makeEdge('n2', 'n3'),
            makeEdge('n3', 'n4'),
            makeEdge('n4', 'n5'),
        ],
    },
    {
        id: 'multi-channel',
        name: 'Multi-Channel (LinkedIn + Email)',
        description: 'Combines LinkedIn invites and messages with email follow-ups for maximum reach.',
        category: 'multi-channel',
        icon: '🔗',
        color: 'from-amber-500 to-orange-600',
        nodes: [
            makeNode('trigger', 0, 'TRIGGER', 'START', 'Trigger: Lead Added'),
            makeNode('n1', 100, 'ACTION', 'PROFILE_VISIT', 'Visit Profile'),
            makeNode('n2', 200, 'ACTION', 'INVITE', 'Send LinkedIn Invite', { message: 'Hi {firstName}, I\'d love to connect and share some insights relevant to your work at {company}.' }),
            makeNode('n3', 300, 'DELAY', 'WAIT', 'Wait 2 days', { delayDays: 2 }),
            makeNode('n4', 400, 'ACTION', 'MESSAGE', 'LinkedIn Message', { message: 'Thanks for connecting, {firstName}! Quick question — are you currently looking at ways to improve your outreach strategy?' }),
            makeNode('n5', 500, 'DELAY', 'WAIT', 'Wait 3 days', { delayDays: 3 }),
            makeNode('n6', 600, 'ACTION', 'EMAIL', 'Email Follow-up', { message: 'Hi {firstName},\n\nWe connected on LinkedIn recently. I wanted to follow up with some additional details via email.\n\nWould a quick call work for you this week?\n\nBest,\nYour Name' }),
            makeNode('n7', 700, 'DELAY', 'WAIT', 'Wait 5 days', { delayDays: 5 }),
            makeNode('n8', 800, 'ACTION', 'MESSAGE', 'Final LinkedIn Message', { message: 'Hi {firstName}, just one last nudge — I\'d love to hear your thoughts. If not the right time, totally understand!' }),
        ],
        edges: [
            makeEdge('trigger', 'n1'),
            makeEdge('n1', 'n2'),
            makeEdge('n2', 'n3'),
            makeEdge('n3', 'n4'),
            makeEdge('n4', 'n5'),
            makeEdge('n5', 'n6'),
            makeEdge('n6', 'n7'),
            makeEdge('n7', 'n8'),
        ],
    },
    {
        id: 'warm-up-connect',
        name: 'Warm-up & Connect',
        description: 'Warm up prospects with profile visits before connecting. Builds familiarity first.',
        category: 'linkedin',
        icon: '🔥',
        color: 'from-red-500 to-rose-600',
        nodes: [
            makeNode('trigger', 0, 'TRIGGER', 'START', 'Trigger: Lead Added'),
            makeNode('n1', 100, 'ACTION', 'PROFILE_VISIT', 'Visit Profile (1st)'),
            makeNode('n2', 200, 'DELAY', 'WAIT', 'Wait 1 day', { delayDays: 1 }),
            makeNode('n3', 300, 'ACTION', 'PROFILE_VISIT', 'Visit Profile (2nd)'),
            makeNode('n4', 400, 'DELAY', 'WAIT', 'Wait 2 days', { delayDays: 2 }),
            makeNode('n5', 500, 'ACTION', 'INVITE', 'Send Invite', { message: 'Hi {firstName}, I\'ve been following your work at {company} and would love to connect!' }),
            makeNode('n6', 600, 'DELAY', 'WAIT', 'Wait 3 days', { delayDays: 3 }),
            makeNode('n7', 700, 'ACTION', 'MESSAGE', 'Welcome Message', { message: 'Great to connect, {firstName}! I noticed you\'re a {jobTitle} — I\'d love to learn more about what you\'re working on.' }),
        ],
        edges: [
            makeEdge('trigger', 'n1'),
            makeEdge('n1', 'n2'),
            makeEdge('n2', 'n3'),
            makeEdge('n3', 'n4'),
            makeEdge('n4', 'n5'),
            makeEdge('n5', 'n6'),
            makeEdge('n6', 'n7'),
        ],
    },
];
