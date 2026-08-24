import axios from 'axios';

const AI_SERVICE_URL = process.env.AI_SERVICE_URL || 'http://localhost:8001';

// Load-test mode: return canned output after a realistic delay instead of
// calling the AI service, so queue-throughput tests don't incur DeepSeek spend.
// Independent of MOCK_LINKEDIN — set MOCK_AI=false in the AI-concurrency test to
// measure the real LLM ceiling. See docs/load-testing-step0-design.md.
const isMockAI = (): boolean => process.env.MOCK_AI === 'true';
const MOCK_AI_MS = parseInt(process.env.MOCK_AI_MS || '1500', 10);
const mockAiWait = () => new Promise(res => setTimeout(res, MOCK_AI_MS));

export interface ThreadMessage {
    sender: string;
    text: string;
}

export interface Experience {
    jobTitle?: string;
    company?: string;
    duration?: string;
}

export interface Education {
    school?: string;
    degree?: string;
}

export interface AIGenerateOptions {
    // Profile data
    profileName: string;
    profileHeadline?: string;
    company?: string;
    jobTitle?: string;
    location?: string;
    about?: string;
    experience?: Experience[];
    education?: Education[];
    
    // Campaign context
    connectionContext?: string;
    campaignDescription?: string;
    tone?: string;
    cta?: string;
    persona?: string;
    valueProposition?: string;
    
    // Thread/context
    postContent?: string;
    threadHistory?: ThreadMessage[];
    draftReply?: string;
    originalMessage?: string;

    // Strategy + business context (loaded once per campaign run from
    // BusinessProfile.aiStrategy). The ai-service prompts thread these
    // through get_brand_context / get_strategy_context helpers so every
    // message respects the user's GTM positioning + ICP outreach angles.
    aiStrategy?: any;
    userContext?: Record<string, any>;

    // Phase C — sequence awareness + per-step controls.
    //
    // channel: 'linkedin' (DM, returns {message}) or 'email' (returns
    // {message, subject} from a single LLM call). LinkedIn-specific
    // rules (short, "Hi {name}") vs email-specific rules (subject line,
    // 4-7 sentences, no "Dear") are picked server-side from this flag.
    channel?: 'linkedin' | 'email';
    // Per-step user instructions ("This is the opener, no asks yet").
    // Layered on top of campaign + business context with the highest
    // priority short of the STRICT RULES.
    aiPrompt?: string;
    // Where this lead sits in the multi-step sequence — lets the model
    // shift register (intro → nudge → final close) instead of generating
    // every step as a fresh first touch.
    campaignProgress?: {
        stepNumber: number;
        totalSteps: number;
        thisStepLabel?: string;
        completedSteps: Array<{ type: string; at?: string; status?: string }>;
        pendingSteps: string[];
        daysSinceFirstTouch?: number;
    };
    // Prior SENT messages to this lead in this campaign (both LinkedIn
    // DMs and emails). Full body — Groq is cheap and the anti-repetition
    // instruction works better with the exact phrasing the model used
    // before.
    messageHistory?: Array<{
        channel: 'linkedin' | 'email';
        sentAt: string;
        subject?: string;
        body: string;
    }>;
}

export interface AIGenerateResult {
    message: string;
    subject?: string;
}

export async function generateAIComment(options: AIGenerateOptions): Promise<string> {
    if (isMockAI()) {
        await mockAiWait();
        return `[MOCK] Great point, ${options.profileName || 'there'} — thanks for sharing this.`;
    }
    try {
        const response = await axios.post(`${AI_SERVICE_URL}/ai/comment`, {
            // Profile data
            profile_name: options.profileName,
            profile_headline: options.profileHeadline,
            company: options.company,
            job_title: options.jobTitle,
            location: options.location,
            about: options.about,
            
            // Post data
            post_content: options.postContent,
            
            // Campaign context
            campaign_description: options.campaignDescription,
            tone: options.tone || 'professional',
            persona: options.persona,
            value_proposition: options.valueProposition,

            // Strategy + business context
            ai_strategy: options.aiStrategy,
            user_context: options.userContext,
            ai_prompt: options.aiPrompt,
        }, { timeout: 30000 });

        return response.data.comment;
    } catch (error: any) {
        console.error('[AI-SERVICE] Error generating comment:', error.message);
        throw new Error('Failed to generate AI comment');
    }
}

function cleanAIOutput(text: string, name: string): string {
    if (!text) return '';
    
    text = text.trim();
    
    const hasPlaceholders = /\[.*?\]/.test(text);
    if (hasPlaceholders) {
        console.log('[AI-SERVICE] Output contains placeholders, using fallback message');
        return '';
    }
    
    const firstLine = text.split('\n')[0];
    if (firstLine.includes('personalized') || firstLine.includes('Here') || firstLine.includes('example')) {
        const match = text.match(new RegExp(`Hi\\s+${name}[^]*?(?:\\n\\n|\\n\\n\\n)`, 'i'));
        if (match) {
            text = match[0];
        }
    }
    
    text = text.replace(/^\*\*.*?\*\*\s*\n?/g, '');
    text = text.replace(/^Here[^]*?:/gi, '');
    text = text.replace(/\*\*Customize[^]*$/gi, '');
    text = text.replace(/\*\*Example[^]*$/gi, '');
    text = text.replace(/Customize[^]*$/gi, '');
    text = text.replace(/Example[^]*$/gi, '');
    text = text.replace(/Replace[^]*$/gi, '');
    
    const lines = text.split('\n').filter(line => {
        const lower = line.toLowerCase();
        return !lower.includes('example') && !lower.includes('customize') && !lower.includes('replace');
    });
    text = lines.join('\n');
    
    return text.trim();
}

export async function generateAIMessage(options: AIGenerateOptions): Promise<AIGenerateResult> {
    if (isMockAI()) {
        await mockAiWait();
        return {
            message: `[MOCK] Hi ${options.profileName || 'there'}, this is a load-test message.`,
            subject: options.channel === 'email' ? '[MOCK] Quick question' : undefined,
        };
    }
    try {
        const response = await axios.post(`${AI_SERVICE_URL}/ai/message`, {
            // Profile data
            recipient_name: options.profileName,
            recipient_headline: options.profileHeadline,
            company: options.company,
            job_title: options.jobTitle,
            location: options.location,
            about: options.about,
            experience: options.experience,
            education: options.education,
            post_content: options.postContent,

            // Campaign context
            connection_context: options.connectionContext,
            campaign_description: options.campaignDescription,
            tone: options.tone || 'professional',
            cta: options.cta || 'connect',
            persona: options.persona,
            value_proposition: options.valueProposition,

            // Strategy + business context
            ai_strategy: options.aiStrategy,
            user_context: options.userContext,

            // Phase C — sequence awareness + per-step controls.
            channel: options.channel || 'linkedin',
            ai_prompt: options.aiPrompt,
            campaign_progress: options.campaignProgress,
            message_history: options.messageHistory,
        }, { timeout: 30000 });

        const rawMessage = response.data.message;
        const cleaned = cleanAIOutput(rawMessage, options.profileName);
        return {
            message: cleaned || rawMessage,
            subject: response.data.subject || undefined,
        };
    } catch (error: any) {
        console.error('[AI-SERVICE] Error generating message:', error.message);
        throw new Error('Failed to generate AI message');
    }
}

export interface SelfProfileSummaryInput {
    name?: string | null;
    headline?: string | null;
    about?: string | null;
    company?: string | null;
    jobTitle?: string | null;
    location?: string | null;
    posts?: string[];
    // Extended fields from Voyager API (richer context for the AI)
    industry?: string | null;
    geoLocation?: string | null;
    premium?: boolean | null;
    pronouns?: string | null;
    vanity?: string | null;
    memberId?: string | null;
    profilePictureUrl?: string | null;
}

export interface SelfProfileSummaryResult {
    summary: string;
    communicationStyle: string;
    tonePreferences: string[];
}

/**
 * Summarize the user's OWN scraped profile + posts into a structured profile
 * the rest of the system can use (dashboard summary + voice for message gen).
 */
export async function generateSelfProfileSummary(
    input: SelfProfileSummaryInput
): Promise<SelfProfileSummaryResult> {
    const response = await axios.post(
        `${AI_SERVICE_URL}/ai/profile-summary`,
        {
            name: input.name,
            headline: input.headline,
            about: input.about,
            company: input.company,
            job_title: input.jobTitle,
            location: input.location,
            posts: input.posts || [],
            // Voyager extended fields
            industry: input.industry || undefined,
            geo_location: input.geoLocation || undefined,
            premium: input.premium ?? undefined,
            pronouns: input.pronouns || undefined,
            vanity: input.vanity || undefined,
            member_id: input.memberId || undefined,
            profile_picture_url: input.profilePictureUrl || undefined,
        },
        { timeout: 45000 }
    );
    return {
        summary: response.data.summary || '',
        communicationStyle: response.data.communicationStyle || '',
        tonePreferences: Array.isArray(response.data.tonePreferences) ? response.data.tonePreferences : [],
    };
}

export async function generateAIEnhance(options: AIGenerateOptions): Promise<string> {
    if (isMockAI()) {
        await mockAiWait();
        return options.draftReply || '[MOCK] enhanced reply';
    }
    try {
        const response = await axios.post(`${AI_SERVICE_URL}/ai/enhance`, {
            thread_history: options.threadHistory,
            draft_reply: options.draftReply,
            original_message: options.originalMessage,
            tone: options.tone || 'professional',
            persona: options.persona,
            value_proposition: options.valueProposition,
            ai_strategy: options.aiStrategy,
            // Reply-awareness — who replied + why we're reaching out.
            profile_name: options.profileName,
            profile_headline: options.profileHeadline,
            company: options.company,
            campaign_objective: options.campaignDescription,
        }, { timeout: 30000 });
        
        const raw = response.data.enhanced;
        const cleaned = cleanAIOutput(raw, options.profileName);
        return cleaned || raw;
    } catch (error: any) {
        console.error('[AI-SERVICE] Error enhancing message:', error.message);
        throw new Error('Failed to enhance AI message');
    }
}

export interface ReplySuggestion {
    label: string;
    text: string;
}

export interface ReplySuggestionsResult {
    situation: { stage: string; intent: string; sentiment: string; summary: string };
    recommendedNext: string;
    variations: ReplySuggestion[];
}

export interface ReplySuggestionsOptions {
    threadHistory?: ThreadMessage[];
    tone?: string;
    persona?: string;
    valueProposition?: string;
    aiStrategy?: any;
    profileName?: string;
    profileHeadline?: string;
    company?: string;
    profileAbout?: string;
    campaignObjective?: string;
}

/**
 * Reply copilot: returns the conversation situation + a recommended next move +
 * 2-3 distinct reply drafts (structured JSON from /ai/reply-suggestions). Unlike
 * generateAIEnhance (which polishes one string), this returns the whole object
 * for the inbox popover to render.
 */
export async function generateReplySuggestions(options: ReplySuggestionsOptions): Promise<ReplySuggestionsResult> {
    if (isMockAI()) {
        await mockAiWait();
        return {
            situation: { stage: 'interested', intent: 'exploring fit', sentiment: 'positive', summary: '[MOCK] They replied with interest.' },
            recommendedNext: '[MOCK] Propose a quick call.',
            variations: [
                { label: 'Propose a call', text: '[MOCK] Great to hear — would a quick 15-min call this week work?' },
                { label: 'Add value', text: '[MOCK] Happy to share a relevant example first — want me to send it over?' },
            ],
        };
    }
    try {
        const response = await axios.post(`${AI_SERVICE_URL}/ai/reply-suggestions`, {
            thread_history: options.threadHistory,
            tone: options.tone || 'professional',
            persona: options.persona,
            value_proposition: options.valueProposition,
            ai_strategy: options.aiStrategy,
            profile_name: options.profileName,
            profile_headline: options.profileHeadline,
            company: options.company,
            profile_about: options.profileAbout,
            campaign_objective: options.campaignObjective,
        }, { timeout: 30000 });
        return response.data as ReplySuggestionsResult;
    } catch (error: any) {
        console.error('[AI-SERVICE] Error generating reply suggestions:', error.message);
        throw new Error('Failed to generate reply suggestions');
    }
}

// ─── Activation copilot ───────────────────────────────────────────────────────

export interface ActivationGrounding {
    goalType?: string;
    senderName?: string;
    selfHeadline?: string;
    selfAbout?: string;
    selfIndustry?: string;
    selfLocation?: string;
    company?: string;
    companyDescription?: string;
    products?: string;
    differentiators?: string;
    targetAudience?: string;
    industry?: string;
    mainPainPoint?: string;
    valueProp?: string;
    persona?: string;
    aiStrategy?: any;
}

export interface ActivationUnderstand {
    youAre: string;
    yourGoal: string;
    bestFitBuyer: string;
    confidence: 'high' | 'medium' | 'low';
}

export interface SearchRecommendation {
    label: string;
    keywords: string;
    filters: { title: string; location: string; industry: string; degree: string };
    rationale: string;
}

// Map the camelCase grounding to the ai-service snake_case request body.
function activationPayload(g: ActivationGrounding) {
    return {
        goal_type: g.goalType,
        sender_name: g.senderName,
        self_headline: g.selfHeadline,
        self_about: g.selfAbout,
        self_industry: g.selfIndustry,
        self_location: g.selfLocation,
        company: g.company,
        company_description: g.companyDescription,
        products: g.products,
        differentiators: g.differentiators,
        target_audience: g.targetAudience,
        industry: g.industry,
        main_pain_point: g.mainPainPoint,
        value_prop: g.valueProp,
        persona: g.persona,
        ai_strategy: g.aiStrategy,
    };
}

// The copilot's "here's how I understand you" card.
export async function generateActivationUnderstand(g: ActivationGrounding): Promise<ActivationUnderstand> {
    if (isMockAI()) {
        await mockAiWait();
        return { youAre: '[MOCK] You run a B2B SaaS startup.', yourGoal: '[MOCK] Book demos with data teams.', bestFitBuyer: '[MOCK] Heads of Data at mid-market companies.', confidence: 'medium' };
    }
    try {
        const response = await axios.post(`${AI_SERVICE_URL}/ai/activation/understand`, activationPayload(g), { timeout: 30000 });
        return response.data as ActivationUnderstand;
    } catch (error: any) {
        console.error('[AI-SERVICE] Error generating activation understanding:', error.message);
        throw new Error('Failed to generate activation understanding');
    }
}

export interface CopilotRouted {
    intent: string;
    params: { keywords: string; templateId: string };
    reply: string;
    needsConfirm: boolean;
}

// Route a free-text copilot message → one closed intent + reply. The contract
// (allowed actions + rules + live state) is composed by the caller from the
// capability manifest and passed as systemContext.
export async function routeCopilotMessage(opts: {
    message: string;
    systemContext: string;
    allowedIntents: string[];
    history?: ThreadMessage[];
}): Promise<CopilotRouted> {
    if (isMockAI()) {
        await mockAiWait();
        return { intent: 'off_topic', params: { keywords: '', templateId: '' }, reply: '[MOCK] I help with LinkedIn outreach — try “find data leaders”.', needsConfirm: false };
    }
    try {
        const response = await axios.post(`${AI_SERVICE_URL}/ai/copilot/route`, {
            message: opts.message,
            system_context: opts.systemContext,
            allowed_intents: opts.allowedIntents,
            history: opts.history,
        }, { timeout: 30000 });
        return response.data as CopilotRouted;
    } catch (error: any) {
        console.error('[AI-SERVICE] Error routing copilot message:', error.message);
        throw new Error('Failed to route copilot message');
    }
}

// 2-3 recommended LinkedIn people-searches for the copilot to offer as chips.
export async function generateActivationSearchRecs(g: ActivationGrounding): Promise<{ recommendations: SearchRecommendation[] }> {
    if (isMockAI()) {
        await mockAiWait();
        return {
            recommendations: [
                { label: 'Heads of Data', keywords: '("head of data" OR "VP analytics") AND SaaS', filters: { title: 'Head of Data', location: '', industry: 'Software', degree: '2nd' }, rationale: '[MOCK] Reaches your best-fit buyer.' },
            ],
        };
    }
    try {
        const response = await axios.post(`${AI_SERVICE_URL}/ai/activation/recommend-search`, activationPayload(g), { timeout: 30000 });
        return response.data as { recommendations: SearchRecommendation[] };
    } catch (error: any) {
        console.error('[AI-SERVICE] Error generating search recommendations:', error.message);
        throw new Error('Failed to generate search recommendations');
    }
}
