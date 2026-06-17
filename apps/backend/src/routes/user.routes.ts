import { Router } from 'express';
import { authMiddleware, AuthRequest } from '../middleware/auth.middleware';
import { prisma } from '@repo/db';
import { mailService } from '../services/mail.service';
import { encrypt, decrypt } from '../utils/crypto';

const router = Router();
router.use(authMiddleware);

router.get('/me', async (req: AuthRequest, res) => {
    try {
        const user = await prisma.user.findUnique({
            where: { id: req.user!.id },
            include: { BusinessProfile: true },
        });
        
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        const { 
            passwordHash, 
            linkedinCookie, 
            linkedinFingerprint, 
            hubspotToken, 
            pipedriveToken, 
            notionToken,
            notionDatabaseId,
            ...userWithoutSensitive 
        } = user;
        
        const decryptedNotionDatabaseId = user.notionDatabaseId ? (() => {
            try {
                return decrypt(user.notionDatabaseId);
            } catch (e) {
                console.error('[USER-ROUTES] Failed to decrypt Notion Database ID:', e);
                return null;
            }
        })() : null;
        
        res.json({
            ...userWithoutSensitive,
            hasHubspot: !!user.hubspotToken,
            hasPipedrive: !!user.pipedriveToken,
            hasNotion: !!user.notionToken,
            notionDatabaseId: decryptedNotionDatabaseId,
            businessProfile: user.BusinessProfile || null,
        });
    } catch (error: any) {
        console.error('[USER-ROUTES] Error fetching user:', error.message);
        res.status(500).json({ error: 'Failed to fetch user' });
    }
});

// Update the user's own display name. Email is intentionally NOT mutable here
// (it's the login identity); changing it would need a verification flow.
router.put('/profile', async (req: AuthRequest, res) => {
    try {
        const { firstName, lastName } = req.body;
        const user = await prisma.user.update({
            where: { id: req.user!.id },
            data: {
                firstName: typeof firstName === 'string' ? firstName.trim() : undefined,
                lastName: typeof lastName === 'string' ? lastName.trim() : undefined,
            },
        });
        res.json({ success: true, firstName: user.firstName, lastName: user.lastName });
    } catch (error: any) {
        console.error('[USER-ROUTES] Error updating profile:', error.message);
        res.status(500).json({ error: 'Failed to update profile' });
    }
});

router.put('/business-profile', async (req: AuthRequest, res) => {
    try {
        const {
            name, company, persona, valueProp, style, keywords, targetAudience, industry,
            companyDescription, products, differentiators, caseStudies, communicationStyle,
            writingSamples, tonePreferences, website, goalType
        } = req.body;

        // Only persist a recognised goal; undefined leaves the existing value
        // untouched so a normal profile save never clobbers the goal.
        const VALID_GOALS = ['sell', 'job_seeking', 'recruiting', 'fundraising', 'networking'];
        const normalizedGoal = VALID_GOALS.includes(goalType) ? goalType : undefined;

        const businessProfile = await prisma.businessProfile.upsert({
            where: { userId: req.user!.id },
            update: {
                name, company, persona, valueProp, style,
                keywords: keywords || [],
                targetAudience, industry, website,
                companyDescription, products, differentiators, caseStudies,
                communicationStyle, writingSamples,
                tonePreferences: tonePreferences || [],
                goalType: normalizedGoal,
            },
            create: {
                userId: req.user!.id,
                name, company, persona, valueProp, style,
                keywords: keywords || [],
                targetAudience, industry, website,
                companyDescription, products, differentiators, caseStudies,
                communicationStyle, writingSamples,
                tonePreferences: tonePreferences || [],
                goalType: normalizedGoal || 'sell',
            },
        });

        res.json(businessProfile);
    } catch (error: any) {
        console.error('[USER-ROUTES] Error saving business profile:', error.message);
        res.status(500).json({ error: 'Failed to save business profile' });
    }
});

router.put('/onboarding', async (req: AuthRequest, res) => {
    try {
        const {
            firstName, lastName, jobTitle, linkedinUrl, company, website,
            targetAudience, mainPainPoint, valueProp, heardFrom, industry, goalType
        } = req.body;

        const userId = req.user!.id;

        // Only persist a recognised goal; anything else falls back to the
        // sales default so a bad client value never breaks prompt resolution.
        const VALID_GOALS = ['sell', 'job_seeking', 'recruiting', 'fundraising', 'networking'];
        const normalizedGoal = VALID_GOALS.includes(goalType) ? goalType : undefined;

        await prisma.user.update({
            where: { id: userId },
            data: {
                firstName: firstName || undefined,
                lastName: lastName || undefined,
                registrationStep: 'COMPLETED',
                linkedinUrl: linkedinUrl || undefined
            }
        });

        const businessProfile = await prisma.businessProfile.upsert({
            where: { userId: userId },
            update: {
                company, persona: jobTitle, website, targetAudience,
                mainPainPoint, valueProp, heardFrom, industry,
                goalType: normalizedGoal,
            },
            create: {
                userId: userId,
                company, persona: jobTitle, website, targetAudience,
                mainPainPoint, valueProp, heardFrom, industry,
                goalType: normalizedGoal,
            },
        });

        // Fire-and-forget: the success email is non-critical and must never block
        // (or fail) the onboarding response. SMTP stalls would otherwise hang the
        // request past the client timeout and surface as "Failed to complete onboarding".
        void mailService.sendOnboardingSuccessEmail(req.user!.email).catch((mailError: any) => {
            console.error('[USER-ROUTES] Failed to send onboarding success email:', mailError?.message);
        });

        res.json({ success: true, profile: businessProfile });
    } catch (error: any) {
        console.error('[USER-ROUTES] Onboarding error:', error.message);
        res.status(500).json({ error: 'Failed to complete onboarding' });
    }
});

router.put('/crm-tokens', async (req: AuthRequest, res) => {
    try {
        const { hubspotToken, pipedriveToken, notionToken, notionDatabaseId } = req.body;
        const updateData: any = {};

        if (hubspotToken !== undefined) {
            updateData.hubspotToken = hubspotToken ? encrypt(hubspotToken) : null;
        }

        if (pipedriveToken !== undefined) {
            updateData.pipedriveToken = pipedriveToken ? encrypt(pipedriveToken) : null;
        }

        if (notionToken !== undefined) {
            updateData.notionToken = notionToken ? encrypt(notionToken) : null;
        }

        if (notionDatabaseId !== undefined) {
            updateData.notionDatabaseId = notionDatabaseId ? encrypt(notionDatabaseId) : null;
        }

        await prisma.user.update({
            where: { id: req.user!.id },
            data: updateData
        });

        res.json({ success: true, message: 'CRM tokens updated successfully' });
    } catch (error: any) {
        console.error('[USER-ROUTES] Error saving CRM tokens:', error.message);
        res.status(500).json({ error: 'Failed to save CRM tokens' });
    }
});

router.delete('/crm-tokens', async (req: AuthRequest, res) => {
    try {
        const { provider } = req.body;

        if (!provider || (provider !== 'hubspot' && provider !== 'pipedrive' && provider !== 'notion')) {
            return res.status(400).json({ error: "Provider must be 'hubspot', 'pipedrive' or 'notion'" });
        }

        const updateData: any = {};
        if (provider === 'hubspot') {
            updateData.hubspotToken = null;
        } else if (provider === 'pipedrive') {
            updateData.pipedriveToken = null;
        } else if (provider === 'notion') {
            updateData.notionToken = null;
            updateData.notionDatabaseId = null;
        }

        await prisma.user.update({
            where: { id: req.user!.id },
            data: updateData
        });

        res.json({ success: true, message: `Disconnected ${provider} integration successfully` });
    } catch (error: any) {
        console.error('[USER-ROUTES] Error deleting CRM tokens:', error.message);
        res.status(500).json({ error: 'Failed to delete CRM tokens' });
    }
});

export default router;
