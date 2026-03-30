import { Router } from 'express';
import { authMiddleware, AuthRequest } from '../middleware/auth.middleware';
import { prisma } from '@repo/db';

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

        const { password, linkedinCookie, linkedinFingerprint, ...userWithoutSensitive } = user;
        
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

export default router;
