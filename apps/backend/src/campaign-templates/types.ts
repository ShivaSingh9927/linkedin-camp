export type TemplateCategory = 'linkedin' | 'email' | 'multi-channel';

export type TemplateGroup = 'my-network' | 'out-of-network' | 'action-triggered' | 'objective-based';

export type TemplatePersona = 'job-seeker' | 'recruiter' | 'vc-founder' | 'enterprise-sales' | null;

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
