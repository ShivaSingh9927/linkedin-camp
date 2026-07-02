import { Router } from 'express';
import { authMiddleware, AuthRequest } from '../middleware/auth.middleware';
import { prisma } from '@repo/db';
import { mailService } from '../services/mail.service';
import { encrypt, decrypt } from '../utils/crypto';

const router = Router();
router.use(authMiddleware);

const AI_SERVICE_URL = process.env.AI_SERVICE_URL || 'http://localhost:8001';

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
            targetAudience, mainPainPoint, valueProp, heardFrom, industry, goalType,
            companyDescription, differentiators
        } = req.body;

        const userId = req.user!.id;

        // Validate + normalize the LinkedIn profile URL. We later read this
        // person's profile via Voyager (post-connect enrichment), so a garbage
        // value here silently breaks that. Accept the common shapes
        // (http/https, www/country subdomain, trailing slash, query string) and
        // canonicalize to https://www.linkedin.com/in/<vanity>. Reject anything
        // that isn't a personal /in/ profile (company pages, feed URLs, typos).
        let normalizedLinkedinUrl: string | undefined;
        if (linkedinUrl && String(linkedinUrl).trim()) {
            const raw = String(linkedinUrl).trim();
            const m = raw.match(/^(?:https?:\/\/)?(?:[\w-]+\.)?linkedin\.com\/in\/([^\/?#\s]+)/i);
            const vanity = m?.[1] ? decodeURIComponent(m[1]).replace(/\/+$/, '') : null;
            if (!vanity) {
                return res.status(400).json({
                    error: "That doesn't look like a LinkedIn profile URL. It should look like https://www.linkedin.com/in/your-name",
                });
            }
            normalizedLinkedinUrl = `https://www.linkedin.com/in/${vanity}`;
        }

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
                linkedinUrl: normalizedLinkedinUrl
            }
        });

        const businessProfile = await prisma.businessProfile.upsert({
            where: { userId: userId },
            update: {
                company, persona: jobTitle, website, targetAudience,
                mainPainPoint, valueProp, heardFrom, industry,
                companyDescription, differentiators,
                goalType: normalizedGoal,
            },
            create: {
                userId: userId,
                company, persona: jobTitle, website, targetAudience,
                mainPainPoint, valueProp, heardFrom, industry,
                companyDescription, differentiators,
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

// Parse the TEXT of a resume / one-pager (extracted client-side in the browser —
// we never receive the file, so zero parsing load or storage on our side) into a
// draft profile the onboarding form pre-fills for the user to review + confirm.
// Just forwards to the ai-service, which does ONE DeepSeek call.
router.post('/parse-document', async (req: AuthRequest, res) => {
    try {
        const { text, goalType, jobTitle } = req.body;
        const clean = typeof text === 'string' ? text.trim() : '';
        if (clean.length < 40) {
            return res.status(400).json({ error: "We couldn't read enough text from that PDF. Try a text-based (not scanned) file." });
        }
        // Hard cap the payload — a 2-page doc is small; anything larger is noise.
        if (clean.length > 20000) {
            return res.status(413).json({ error: 'That document is too long. A 1–2 page resume works best.' });
        }

        const aiRes = await fetch(`${AI_SERVICE_URL}/ai/parse-document`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text: clean, goalType, jobTitle }),
        });
        if (!aiRes.ok) {
            const detail = await aiRes.text().catch(() => '');
            console.error('[USER-ROUTES] parse-document ai-service error:', aiRes.status, detail.slice(0, 200));
            return res.status(502).json({ error: 'Could not analyze the document. Please fill the details manually.' });
        }
        const data = await aiRes.json();
        res.json(data);
    } catch (error: any) {
        console.error('[USER-ROUTES] parse-document error:', error.message);
        res.status(500).json({ error: 'Could not analyze the document. Please fill the details manually.' });
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
