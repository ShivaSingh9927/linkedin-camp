import type { Page, BrowserContext, APIRequestContext } from 'patchright';

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
    source?: 'connectionState' | 'storedOutputs';
    field: string;
    operator: 'equals' | 'not_equals' | 'is_true' | 'is_false' | 'is_null' | 'is_not_null' | 'is_empty' | 'is_not_empty';
    value?: string | boolean | number;
    // When true AND the resolved field value is null AND the engine has
    // a live Page available, run CHECK_CONNECTION first to populate the
    // Lead.connectionDegree column, then re-read. Lets templates branch
    // correctly when scrape-time degree data was missing without forcing
    // users to author an explicit "if null" branch upstream.
    probeOnNull?: boolean;
    // Backend for the probeOnNull connection check. Defaults to 'voyager'
    // (cheap API list-read, no profile navigation); set 'dom' to force the
    // full DOM profile visit when exact degree (2 vs 3) or PENDING-invite
    // state is needed. Overrides the CONNECTION_CHECK_BACKEND env default.
    backend?: 'voyager' | 'dom';
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
    | 'profile-visit-voyager'
    | 'connect'
    | 'like-nth-post'
    | 'comment-nth-post'
    | 'send-message'
    | 'delay'
    | 'inbox-sync'
    | 'inbox-sync-voyager'
    | 'if-else'
    | 'check-connection'
    | 'check-connection-voyager'
    | 'email'
    | 'email-finder'
    | 'follow';

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
    // Clean first/last from Voyager FullProfile (or split from name on the DOM
    // path). Authoritative for the email-finder's permutations — far cleaner
    // than the raw CSV-imported lead.firstName/lastName (pronouns, emojis, etc).
    firstName: string | null;
    lastName: string | null;
    headline: string | null;
    location: string | null;
    company: string | null;
    jobTitle: string | null;
    companyUrl: string | null;
    about: string | null;
    email: string | null;
    phone: string | null;
    connected: boolean;
    // 1 | 2 | 3 | null — from the visible degree badge on the profile.
    // Also persisted to Lead.connectionDegree as a side effect so future
    // campaign runs can branch via IF_ELSE without re-probing.
    connectionDegree?: number | null;
    connectedDate: string | null;
    experience: Experience[];
    education: Education[];
    latestPost: string | null;
    latestPostUrl: string | null;
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
    // When the connection-degree gate trips at runtime (lead never accepted the
    // invite, or LinkedIn put the DM behind an InMail paywall), the node
    // succeeds *without* sending. The engine treats this as a no-op: no
    // Message row, no error log, lead progresses to the next step.
    skipped?: boolean;
    skipReason?: 'not_connected' | 'no_message_ui';
    // True when the body was AI-generated (vs a resolved template). Drives the
    // "AI" badge and rationale on the Messages tab.
    aiGenerated?: boolean;
    // Deterministic "why this message" — the personalization signals fed to the
    // AI. Undefined for template/fallback sends. See ai-rationale.ts.
    rationale?: string;
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
    connectionDegree?: number | null;
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
        // Enrichment fields from the Lead row — used as fallback when no
        // profile-visit step ran earlier in the flow. Without these, an
        // aiEnabled send-message ships with only firstName+lastName to the
        // LLM and personalization collapses to invented stereotypes.
        headline?: string | null;
        jobTitle?: string | null;
        company?: string | null;
        location?: string | null;
        aboutInfo?: string | null;
        // Email is populated by profile-visit enrichment (when LinkedIn
        // exposes it on the contact-info modal) or seeded at lead import.
        // The EMAIL node skips sends when null — no error.
        email?: string | null;
        phone?: string | null;
    };
    userId: string;
    campaignId: string;
    // Browser-free Voyager client (no Chromium). Present for read/check nodes
    // when the engine has deferred the browser launch (lazy launch). Nodes that
    // can run without a page (e.g. check-connection-voyager) should use this
    // when `page` is null. Built once per lead from the saved session.
    apiRequest?: APIRequestContext;
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
    status: 'completed' | 'failed' | 'paused';
    nodesExecuted: NodeExecution[];
    failedAt?: string;
    // Engine-level error message when failedAt is not tied to a specific node
    // (e.g. session missing, proxy snapshot missing, browser launch failure).
    // Node-level errors live on the NodeExecution row inside nodesExecuted.
    error?: string;
    // Set when status === 'paused'. Reasons:
    //   'lead_replied' — engine detected a RECEIVED Message; stop automation.
    //   'daily_cap'    — the next governed action would exceed today's per-user
    //                    cap (see safety/quota.ts). Lead is rescheduled, not
    //                    failed; engine returns paused so the worker can move on.
    //   'off_hours'    — outside the working-hours window; lead deferred to
    //                    next 09:00 IST + jitter.
    //   'stalled'      — exceeded the deferral ceiling; needs human review.
    //   'delay'        — parked at a delay/stage boundary; cron resumes it
    //                    from currentNodeIndex when nextRetryAt matures.
    //   'not_accepted' — resumed into a 1st-degree-only stage but the invite
    //                    was never accepted; sequence gives up (soft terminal,
    //                    recorded as COMPLETED+reason, not FAILED).
    pausedReason?: 'lead_replied' | 'daily_cap' | 'off_hours' | 'stalled' | 'delay' | 'not_accepted';
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
