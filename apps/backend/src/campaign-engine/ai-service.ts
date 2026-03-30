import axios from 'axios';

const AI_SERVICE_URL = process.env.AI_SERVICE_URL || 'http://ai-service:8001';

export interface ThreadMessage {
    sender: string;
    text: string;
}

export interface AIGenerateOptions {
    profileName: string;
    profileHeadline?: string;
    postContent?: string;
    connectionContext?: string;
    tone?: string;
    cta?: string;
    persona?: string;
    valueProposition?: string;
    threadHistory?: ThreadMessage[];
    draftReply?: string;
    originalMessage?: string;
}

export async function generateAIComment(options: AIGenerateOptions): Promise<string> {
    try {
        const response = await axios.post(`${AI_SERVICE_URL}/ai/comment`, {
            profile_name: options.profileName,
            profile_headline: options.profileHeadline,
            post_content: options.postContent,
            tone: options.tone || 'professional',
            persona: options.persona,
            value_proposition: options.valueProposition
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

export async function generateAIMessage(options: AIGenerateOptions): Promise<string> {
    try {
        const response = await axios.post(`${AI_SERVICE_URL}/ai/message`, {
            recipient_name: options.profileName,
            recipient_headline: options.profileHeadline,
            connection_context: options.connectionContext,
            tone: options.tone || 'professional',
            cta: options.cta || 'connect',
            persona: options.persona,
            value_proposition: options.valueProposition
        }, { timeout: 30000 });
        
        const raw = response.data.message;
        const cleaned = cleanAIOutput(raw, options.profileName);
        return cleaned || raw;
    } catch (error: any) {
        console.error('[AI-SERVICE] Error generating message:', error.message);
        throw new Error('Failed to generate AI message');
    }
}

export async function generateAIEnhance(options: AIGenerateOptions): Promise<string> {
    try {
        const response = await axios.post(`${AI_SERVICE_URL}/ai/enhance`, {
            thread_history: options.threadHistory,
            draft_reply: options.draftReply,
            original_message: options.originalMessage,
            tone: options.tone || 'professional',
            persona: options.persona,
            value_proposition: options.valueProposition
        }, { timeout: 30000 });
        
        const raw = response.data.enhanced;
        const cleaned = cleanAIOutput(raw, options.profileName);
        return cleaned || raw;
    } catch (error: any) {
        console.error('[AI-SERVICE] Error enhancing message:', error.message);
        throw new Error('Failed to enhance AI message');
    }
}
