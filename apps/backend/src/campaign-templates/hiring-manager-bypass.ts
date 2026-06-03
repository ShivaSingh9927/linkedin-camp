import { TemplateDefinition } from './types';
import { node, edge } from './helpers';

export const hiringManagerBypassTemplate: TemplateDefinition = {
    id: 'hiring-manager-bypass',
    name: 'Hiring Manager Bypass',
    description:
        'Skip LinkedIn inbox noise and go direct to email. Visit the profile for context, find their email, then send a targeted email the next day. CRM sync is automatic.',
    useCase: 'Direct email to hiring managers bypassing LinkedIn',
    recommendedFor: ['Job seekers targeting specific companies', 'Career changers'],
    group: 'objective-based',
    category: 'multi-channel',
    persona: 'job-seeker',
    icon: '💼',
    color: 'from-blue-600 to-indigo-700',
    durationDays: 2,
    stepCount: 3,
    delayCount: 1,
    requires: ['email-finder', 'email', 'crm-sync'],
    aiStrategyHint: {
        objective:
            "Get a hiring manager's attention via email by referencing their team's work and positioning yourself as a solution to a resourcing gap.",
        description:
            'Go where the hiring manager actually reads messages: their inbox. The profile visit enriches context, the email finder resolves a deliverable address, and the email itself should be concise with a clear ask — not a resume dump.',
        cta: 'reply-to-email',
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
            node('n2', 200, 'ACTION', 'EMAIL_FINDER', 'Find Email'),
            node('n3', 300, 'DELAY', 'WAIT', 'Wait 1 day', { delayDays: 1 }),
            node('n4', 400, 'ACTION', 'EMAIL', 'Send Email', { aiEnabled: true, subject: '',
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
