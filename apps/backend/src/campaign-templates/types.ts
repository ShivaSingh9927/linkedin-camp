export type TemplateCategory = 'linkedin' | 'email' | 'multi-channel';

export type TemplateGroup = 'my-network' | 'out-of-network' | 'action-triggered' | 'objective-based';

/**
 * Who this template is designed for, in terms of the lead list's
 * connection-degree mix:
 *   - 'connected'   = 1st-degree only (re-engagement, dormant network).
 *                     Templates that lead with MESSAGE without a CONNECT
 *                     gate live here.
 *   - 'cold'        = 2nd / 3rd-degree only (prospecting). Templates that
 *                     start with CONNECT or FOLLOW.
 *   - 'mixed'       = handles both via degree-based IF_ELSE branching at
 *                     the top of the flow. Fast path for 1st-degree, cold
 *                     path for everyone else.
 *
 * Surfaced in the gallery as a filter pill so users pick a template that
 * matches their actual lead list.
 */
export type TemplateAudience = 'connected' | 'cold' | 'mixed';

export type TemplatePersona = 'job-seeker' | 'recruiter' | 'vc-founder' | 'enterprise-sales' | null;

/**
 * The user role this template is designed for. Surfaced as the primary
 * filter row in the gallery (`/campaigns/templates`). A user picks their
 * ICP at onboarding (future) and the gallery defaults to their bucket.
 *   - 'founder'     — solo operator / early-stage CEO selling, raising, hiring
 *   - 'sales'       — BD / AE / SDR running outbound at volume
 *   - 'agency'      — service business pitching new clients or reactivating old ones
 *   - 'recruiter'   — in-house TA or agency recruiter sourcing candidates
 *   - 'job-seeker'  — individual looking for roles or referrals
 *   - 'creator'     — newsletter, course, community builder growing audience
 *   - 'universal'   — works across roles; safe defaults
 */
export type TemplateICP =
    | 'founder'
    | 'sales'
    | 'agency'
    | 'recruiter'
    | 'job-seeker'
    | 'creator'
    | 'universal';

export interface TemplateNode {
    id: string;
    type: 'TRIGGER' | 'ACTION' | 'DELAY' | 'CONDITION';
    subType: string;
    data: Record<string, any>;
    position: { x: number; y: number };
}

export interface TemplateEdge {
    id: string;
    source: string;
    target: string;
    sourceHandle?: string | null;
}

export interface TemplateDefinition {
    id: string;
    name: string;
    description: string;
    useCase: string;
    recommendedFor: string[];
    group: TemplateGroup;
    category: TemplateCategory;
    audience: TemplateAudience;
    icp: TemplateICP;
    bestFor?: string;
    persona?: TemplatePersona;
    icon: string;
    color: string;
    durationDays: number;
    stepCount: number;
    delayCount: number;
    requires?: string[];
    aiStrategyHint: {
        objective: string;
        description: string;
        cta: string;
        toneOverride: string;
    };
    workflow: {
        nodes: TemplateNode[];
        edges: TemplateEdge[];
    };
}
