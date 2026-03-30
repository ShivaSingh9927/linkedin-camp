import { Page, BrowserContext } from 'playwright';

// ---- Campaign Config ----

export interface CampaignFlowNode {
    node: NodeType;
    text?: string;
    n?: number;
    hours?: number;
    requireConnection?: boolean;
    aiEnabled?: boolean;
    [key: string]: any;
}

export interface SessionContext {
    cookies: any[] | null;
    userAgent: string | null;
    localStorage: Record<string, string> | null;
    proxy: {
        server: string;
        username: string;
        password: string;
    };
}

export interface CampaignConfig {
    flow: CampaignFlowNode[];
    campaignId?: string;
    objective?: string;
    cta?: string;
    toneOverride?: string;
    persona?: string;
    valueProp?: string;
    sessionContext?: SessionContext;
}

export type NodeType =
    | 'warmup'
    | 'profile-visit'
    | 'connect'
    | 'like-nth-post'
    | 'comment-nth-post'
    | 'send-message'
    | 'delay'
    | 'inbox-sync';

// ---- Node Output ----

export interface NodeExecution {
    node: NodeType;
    status: 'success' | 'failed';
    output?: Record<string, any>;
    error?: string;
    at: string;
}

export interface ProfileVisitOutput {
    name: string | null;
    company: string | null;
    jobTitle: string | null;
    companyUrl: string | null;
    about: string | null;
    email: string | null;
    phone: string | null;
    connected: boolean;
}

export interface ConnectOutput {
    status: 'sent' | 'pending' | 'already_connected' | 'failed';
}

export interface PostOutput {
    postUrl: string | null;
    postContent: string | null;
    liked?: boolean;
    commented?: boolean;
    commentText?: string;
}

export interface SendMessageOutput {
    messageText: string;
    sent: boolean;
}

export interface DelayOutput {
    waitedUntil: string;
}

// ---- Context passed to each node ----

export interface NodeContext {
    page: Page;
    context: BrowserContext;
    lead: {
        id: string;
        linkedinUrl: string;
        firstName: string | null;
        lastName: string | null;
    };
    userId: string;
    campaignId: string;
    storedOutputs: Record<string, Record<string, any>>;
    campaign?: {
        objective?: string;
        cta?: string;
        toneOverride?: string;
        persona?: string;
        valueProp?: string;
    };
}

// ---- Node result ----

export interface NodeResult {
    success: boolean;
    output?: Record<string, any>;
    error?: string;
}

// ---- Node handler signature ----

export type NodeHandler = (ctx: NodeContext, config: CampaignFlowNode) => Promise<NodeResult>;

// ---- Campaign execution result ----

export interface LeadExecutionResult {
    leadId: string;
    leadName: string;
    status: 'completed' | 'failed';
    nodesExecuted: NodeExecution[];
    failedAt?: string;
}

export interface CampaignSummary {
    campaignId: string;
    totalLeads: number;
    succeeded: number;
    failed: number;
    leadResults: LeadExecutionResult[];
    startedAt: string;
    completedAt: string;
}
