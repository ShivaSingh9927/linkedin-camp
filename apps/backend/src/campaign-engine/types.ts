import { Page, BrowserContext } from 'playwright';

// ---- Campaign Config ----

export interface CampaignFlowNode {
    node: NodeType;
    text?: string;
    n?: number;
    hours?: number;
    requireConnection?: boolean;
    aiEnabled?: boolean;
    condition?: IfElseCondition;
    trueBranch?: CampaignFlowNode[];
    falseBranch?: CampaignFlowNode[];
    [key: string]: any;
}

export interface IfElseCondition {
    field: 'connectionStatus' | 'connected' | 'connectionDegree';
    operator: 'equals' | 'not_equals' | 'is_true' | 'is_false';
    value?: string | boolean;
}

export interface SessionContext {
    cookies: any[] | null;
    userAgent: string | null;
    localStorage: Record<string, string> | null;
    proxy?: {
        server: string;
        username?: string;
        password?: string;
    } | null;
}

export interface CampaignConfig {
    flow: CampaignFlowNode[];
    campaignId?: string;
    objective?: string;
    campaignDescription?: string;
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
    | 'inbox-sync'
    | 'if-else'
    | 'check-connection';

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
    headline: string | null;
    location: string | null;
    company: string | null;
    jobTitle: string | null;
    companyUrl: string | null;
    about: string | null;
    email: string | null;
    phone: string | null;
    connected: boolean;
    connectedDate: string | null;
    experience: Experience[];
    education: Education[];
}

export interface Experience {
    jobTitle: string | null;
    company: string | null;
    employmentType: string | null;
    duration: string | null;
    yearsExp: string | null;
    location: string | null;
    mode: string | null;
}

export interface Education {
    school: string | null;
    degree: string | null;
    field: string | null;
    dates: string | null;
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

export interface IfElseOutput {
    branch: 'true' | 'false';
    executed: boolean;
}

export interface CheckConnectionOutput {
    connectionStatus: 'not_connected' | 'pending' | 'connected';
    connected: boolean;
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
    connectionStatus?: 'not_connected' | 'pending' | 'connected';
    campaign?: {
        objective?: string;
        campaignDescription?: string;
        cta?: string;
        toneOverride?: string;
        persona?: string;
        valueProp?: string;
    };
    // Loaded once per campaign run from BusinessProfile so every per-action
    // LLM call ('/ai/message', '/ai/comment') gets the user's strategy +
    // company context — keeps voice/positioning consistent across leads.
    aiContext?: {
        aiStrategy?: any;
        userContext?: {
            persona?: string | null;
            company?: string | null;
            companyDescription?: string | null;
            products?: string | null;
            differentiators?: string | null;
            caseStudies?: string | null;
            targetAudience?: string | null;
            industry?: string | null;
            mainPainPoint?: string | null;
            usp?: string | null;
            valueProp?: string | null;
            communicationStyle?: string | null;
            writingSamples?: any;
            tonePreferences?: any;
        };
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
