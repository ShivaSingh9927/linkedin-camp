import { TemplateDefinition } from './types';
import { node, edge } from './helpers';

export const passiveTalentPoacherTemplate: TemplateDefinition = {
    id: 'passive-talent-poacher',
    name: 'Passive Talent Poacher',
    description:
        'Build familiarity before connecting. Visit their profile, follow them to show interest, wait 2 days, then send a connection request the prospect will recognize.',
    useCase: 'Subtly engage passive candidates before connecting',
    recommendedFor: ['Recruiters sourcing passive talent', 'HR professionals'],
    group: 'objective-based',
    category: 'linkedin',
    persona: 'recruiter',
    icon: '🎣',
    color: 'from-teal-500 to-emerald-600',
    durationDays: 3,
    stepCount: 3,
    delayCount: 1,
    aiStrategyHint: {
        objective:
            "Get a passive candidate to accept a connection request by warming them up before the invite arrives.",
        description:
            'Passive talent ignores cold InMails. This sequence warms them with a profile visit and follow first. When the connection request arrives 2 days later, they remember your name. The AI should personalize the invite note referencing their recent role or project.',
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
            node('n2', 200, 'ACTION', 'FOLLOW', 'Follow'),
            node('n3', 300, 'DELAY', 'WAIT', 'Wait 2 days', { delayDays: 2 }),
            node('n4', 400, 'ACTION', 'CONNECT', 'Send Invite (AI note)', {
                message: '',
            }),
        ],
        edges: [
            edge('trigger', 'n1'),
            edge('n1', 'n2'),
            edge('n2', 'n3'),
            edge('n3', 'n4'),
        ],
    },
};
