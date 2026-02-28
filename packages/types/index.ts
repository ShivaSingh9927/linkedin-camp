export enum LeadStatus {
    UNCONNECTED = 'UNCONNECTED',
    INVITE_PENDING = 'INVITE_PENDING',
    CONNECTED = 'CONNECTED',
    REPLIED = 'REPLIED',
    BOUNCED = 'BOUNCED',
}

export enum CampaignStatus {
    DRAFT = 'DRAFT',
    ACTIVE = 'ACTIVE',
    PAUSED = 'PAUSED',
    COMPLETED = 'COMPLETED',
}

export enum ActionType {
    PROFILE_VISIT = 'PROFILE_VISIT',
    INVITE = 'INVITE',
    MESSAGE = 'MESSAGE',
    EMAIL = 'EMAIL',
    CHECK_REPLY = 'CHECK_REPLY',
}

export interface WorkflowNode {
    id: string;
    type: 'TRIGGER' | 'ACTION' | 'DELAY' | 'CONDITION';
    subType?: string;
    data: any;
}

export interface WorkflowEdge {
    id: string;
    source: string;
    target: string;
    sourceHandle?: string;
}

export interface WorkflowJson {
    nodes: WorkflowNode[];
    edges: WorkflowEdge[];
}
