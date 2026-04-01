import { Router } from 'express';
import { authMiddleware, AuthRequest } from '../middleware/auth.middleware';
import { prisma } from '@repo/db';
import { mailService } from '../services/mail.service';

const router = Router();

router.use(authMiddleware);

router.get('/me', async (req: AuthRequest, res) => {
    try {
        const user = await prisma.user.findUnique({
            where: { id: req.user!.id },
            include: { businessProfile: true },
        });
        
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        const { passwordHash, linkedinCookie, linkedinFingerprint, ...userWithoutSensitive } = user;
        
        res.json({
            ...userWithoutSensitive,
            businessProfile: user.businessProfile || null,
        });
    } catch (error: any) {
        console.error('[USER-ROUTES] Error fetching user:', error.message);
        res.status(500).json({ error: 'Failed to fetch user' });
    }
});

router.put('/business-profile', async (req: AuthRequest, res) => {
    try {
        const { name, company, persona, valueProp, style, keywords, targetAudience, industry } = req.body;
        
        const businessProfile = await prisma.businessProfile.upsert({
            where: { userId: req.user!.id },
            update: {
                name,
                company,
                persona,
                valueProp,
                style,
                keywords: keywords || [],
                targetAudience,
                industry,
            },
            create: {
                userId: req.user!.id,
                name,
                company,
                persona,
                valueProp,
                style,
                keywords: keywords || [],
                targetAudience,
                industry,
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
            firstName, 
            lastName, 
            jobTitle, 
            linkedinUrl, 
            company, 
            website, 
            targetAudience, 
            mainPainPoint, 
            valueProp, 
            heardFrom,
            industry 
        } = req.body;
        
        const userId = req.user!.id;

        // 1. Update User basic info & status
        await prisma.user.update({
            where: { id: userId },
            data: {
                firstName: firstName || undefined,
                lastName: lastName || undefined,
                registrationStep: 'COMPLETED',
                linkedinUrl: linkedinUrl || undefined
            }
        });

        // 2. Upsert BusinessProfile with GTM data
        const businessProfile = await prisma.businessProfile.upsert({
            where: { userId: userId },
            update: {
                company,
                persona: jobTitle,
                website,
                targetAudience,
                mainPainPoint,
                valueProp,
                heardFrom,
                industry,
            },
            create: {
                userId: userId,
                company,
                persona: jobTitle,
                website,
                targetAudience,
                mainPainPoint,
                valueProp,
                heardFrom,
                industry,
            },
        });

        // 3. Send Onboarding Success Email
        await mailService.sendOnboardingSuccessEmail(req.user!.email);

        res.json({ success: true, profile: businessProfile });
    } catch (error: any) {
        console.error('[USER-ROUTES] Onboarding error:', error.message);
        res.status(500).json({ error: 'Failed to complete onboarding' });
    }
});

export default router;
