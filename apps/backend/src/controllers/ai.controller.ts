import { Response } from 'express';
import { prisma } from '@repo/db';
import { AuthRequest } from '../middleware/auth.middleware';
import { 
    generateAIComment, 
    generateAIMessage, 
    generateAIEnhance 
} from '../campaign-engine/ai-service';

export const generateComment = async (req: AuthRequest, res: Response) => {
    try {
        const { profile_name, profile_headline, post_content, tone, campaign_id } = req.body;
        const userId = req.user?.id;

        if (!userId) return res.status(401).json({ error: 'Unauthorized' });

        // Fetch Business Profile for Persona/ValueProp
        const businessProfile = await prisma.businessProfile.findUnique({
            where: { userId }
        });

        // Optionally fetch campaign context
        let campaignCtx = null;
        if (campaign_id) {
            campaignCtx = await prisma.campaign.findUnique({
                where: { id: campaign_id }
            });
        }

        const comment = await generateAIComment({
            profileName: profile_name,
            profileHeadline: profile_headline,
            postContent: post_content,
            tone: tone || campaignCtx?.toneOverride || 'professional',
            persona: businessProfile?.persona || undefined,
            valueProposition: businessProfile?.valueProp || undefined,
        });
        
        res.json({ comment });
    } catch (error: any) {
        console.error('[AI-CONTROLLER] Error generating comment:', error.message);
        res.status(500).json({ error: 'Failed to generate comment' });
    }
};

export const generateMessage = async (req: AuthRequest, res: Response) => {
    try {
        const { recipient_name, recipient_headline, connection_context, tone, cta, campaign_id } = req.body;
        const userId = req.user?.id;

        if (!userId) return res.status(401).json({ error: 'Unauthorized' });

        const businessProfile = await prisma.businessProfile.findUnique({
            where: { userId }
        });

        let campaignCtx = null;
        if (campaign_id) {
            campaignCtx = await prisma.campaign.findUnique({
                where: { id: campaign_id }
            });
        }

        const message = await generateAIMessage({
            profileName: recipient_name,
            profileHeadline: recipient_headline,
            connectionContext: connection_context || campaignCtx?.objective || undefined,
            tone: tone || campaignCtx?.toneOverride || 'professional',
            cta: cta || campaignCtx?.cta || 'connect',
            persona: businessProfile?.persona || undefined,
            valueProposition: businessProfile?.valueProp || undefined,
        });
        
        res.json({ message });
    } catch (error: any) {
        console.error('[AI-CONTROLLER] Error generating message:', error.message);
        res.status(500).json({ error: 'Failed to generate message' });
    }
};

export const enhanceReply = async (req: AuthRequest, res: Response) => {
    try {
        const { original_message, thread_history, draft_reply, tone } = req.body;
        const userId = req.user?.id;

        if (!userId) return res.status(401).json({ error: 'Unauthorized' });

        const businessProfile = await prisma.businessProfile.findUnique({
            where: { userId }
        });

        const enhanced = await generateAIEnhance({
            profileName: 'User', // Generic since it's an inbox reply
            originalMessage: original_message,
            threadHistory: thread_history, // Expecting [{sender, text}]
            draftReply: draft_reply,
            tone: tone || 'professional',
            persona: businessProfile?.persona || undefined,
            valueProposition: businessProfile?.valueProp || undefined,
        });
        
        res.json({ enhanced });
    } catch (error: any) {
        console.error('[AI-CONTROLLER] Error enhancing reply:', error.message);
        res.status(500).json({ error: 'Failed to enhance reply' });
    }
};
