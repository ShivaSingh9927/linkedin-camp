export type TemplateCategory = 'linkedin' | 'email' | 'multi-channel';

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
    category: TemplateCategory;
    icon: string;
    color: string;
    durationDays: number;
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
