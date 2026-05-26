const AI_SERVICE_URL = process.env.AI_SERVICE_URL || 'http://localhost:8001';

export const generateIcebreaker = async (lead: any, userContext?: any) => {
    const { firstName, jobTitle, company, headline, aboutInfo } = lead;

    if (!firstName) {
        return `Hi there, I noticed your profile and would love to connect!`;
    }

    try {
        const payload = {
            recipient_name: firstName,
            recipient_headline: headline || jobTitle || '',
            company: company || '',
            job_title: jobTitle || '',
            about: aboutInfo || '',
            connection_context: `Interested in connecting with ${firstName}`,
            tone: 'professional',
            cta: 'connect',
            persona: userContext?.persona || '',
            value_proposition: userContext?.valueProp || '',
            ai_strategy: userContext?.aiStrategy || null,
            user_context: userContext || null,
        };

        const response = await fetch(`${AI_SERVICE_URL}/ai/message`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
        });

        if (!response.ok) {
            throw new Error(`AI service error: ${response.statusText}`);
        }

        const data = await response.json() as { message: string };
        return data.message?.trim() || `Hi ${firstName}, I'm impressed by your work at ${company || 'your company'}!`;
    } catch (error) {
        console.error('AI Icebreaker error:', error);
        return `Hi ${firstName}, I came across your profile and was impressed by your experience${company ? ` at ${company}` : ''}.`;
    }
};

export const generateComment = async (params: {
    profile_name: string;
    profile_headline?: string;
    company?: string;
    job_title?: string;
    post_content: string;
    campaign_description?: string;
    tone?: string;
    persona?: string;
    value_proposition?: string;
    ai_strategy?: any;
    user_context?: any;
}) => {
    try {
        const response = await fetch(`${AI_SERVICE_URL}/ai/comment`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(params),
        });

        if (!response.ok) {
            throw new Error(`AI service error: ${response.statusText}`);
        }

        const data = await response.json() as { comment: string };
        return data.comment?.trim() || '';
    } catch (error) {
        console.error('AI Comment error:', error);
        return '';
    }
};

export const enhanceReply = async (params: {
    original_message?: string;
    thread_history?: Array<{ sender: string; text: string }>;
    draft_reply?: string;
    tone?: string;
    persona?: string;
    value_proposition?: string;
    ai_strategy?: any;
}) => {
    try {
        const response = await fetch(`${AI_SERVICE_URL}/ai/enhance`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(params),
        });

        if (!response.ok) {
            throw new Error(`AI service error: ${response.statusText}`);
        }

        const data = await response.json() as { enhanced: string };
        return data.enhanced?.trim() || '';
    } catch (error) {
        console.error('AI Enhance error:', error);
        return params.draft_reply || '';
    }
};
