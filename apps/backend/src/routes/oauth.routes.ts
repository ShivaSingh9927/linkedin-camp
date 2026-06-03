import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { prisma } from '@repo/db';
import { authMiddleware, AuthRequest } from '../middleware/auth.middleware';
import { encrypt } from '../utils/crypto';
import * as google from '../services/oauth/google.service';
import * as microsoft from '../services/oauth/microsoft.service';
import { putState, takeState } from '../services/oauth/state-store';

const router = Router();

const WEB_BASE = process.env.WEB_BASE_URL || 'https://app.qampi.com';

/**
 * connect endpoints are authenticated (we need to know which user owns
 * the soon-to-be-stored refresh token). The browser hits them directly,
 * so the auth token must come via the existing Bearer header — the
 * authMiddleware already supports `?token=` as a fallback, which we
 * use here since the redirect URL can't carry an Authorization header.
 */

router.get('/google/connect', authMiddleware, async (req: AuthRequest, res: Response) => {
    if (!google.isConfigured()) {
        return res.status(503).json({ error: 'Google OAuth is not configured on this server' });
    }
    const state = crypto.randomBytes(24).toString('hex');
    await putState(state, { userId: req.user!.id, provider: 'google', returnTo: req.query.returnTo as string });
    res.redirect(google.buildAuthorizeUrl(state));
});

router.get('/google/callback', async (req: Request, res: Response) => {
    const { code, state, error } = req.query as Record<string, string>;
    if (error) return res.redirect(`${WEB_BASE}/settings?emailConnected=error&reason=${encodeURIComponent(error)}`);
    if (!code || !state) return res.status(400).send('Missing code or state');

    const ctx = await takeState(state);
    if (!ctx || ctx.provider !== 'google') return res.status(400).send('Invalid or expired state');

    try {
        const tokens = await google.exchangeCode(code);
        if (!tokens.refresh_token) {
            // Google omits refresh_token when consent is silently
            // re-granted. Force re-consent and try again.
            return res.redirect(`${WEB_BASE}/settings?emailConnected=error&reason=missing_refresh_token`);
        }
        const email = (tokens.id_token && google.emailFromIdToken(tokens.id_token)) || '';
        if (!email) return res.status(400).send('Could not derive email from ID token');

        const exp = new Date(Date.now() + tokens.expires_in * 1000);
        await prisma.emailAccount.upsert({
            where: { userId: ctx.userId },
            create: {
                userId: ctx.userId,
                provider: 'gmail-oauth',
                fromEmail: email,
                oauthRefreshToken: encrypt(tokens.refresh_token),
                oauthAccessToken: encrypt(tokens.access_token),
                oauthExpiresAt: exp,
                // Clear any leftover SMTP fields from a prior provider —
                // single-provider-per-account invariant.
                smtpHost: null,
                smtpPort: null,
                smtpUser: null,
                smtpPass: null,
                smtpSecure: false,
                lastError: null,
            },
            update: {
                provider: 'gmail-oauth',
                fromEmail: email,
                oauthRefreshToken: encrypt(tokens.refresh_token),
                oauthAccessToken: encrypt(tokens.access_token),
                oauthExpiresAt: exp,
                smtpHost: null,
                smtpPort: null,
                smtpUser: null,
                smtpPass: null,
                smtpSecure: false,
                lastError: null,
            },
        });
        return res.redirect(`${WEB_BASE}/settings?emailConnected=gmail&email=${encodeURIComponent(email)}`);
    } catch (e: any) {
        console.error('[OAuth/Google] callback failed:', e?.message);
        return res.redirect(`${WEB_BASE}/settings?emailConnected=error&reason=${encodeURIComponent(e?.message?.substring(0, 200) || 'unknown')}`);
    }
});

router.get('/microsoft/connect', authMiddleware, async (req: AuthRequest, res: Response) => {
    if (!microsoft.isConfigured()) {
        return res.status(503).json({ error: 'Microsoft OAuth is not configured on this server' });
    }
    const state = crypto.randomBytes(24).toString('hex');
    await putState(state, { userId: req.user!.id, provider: 'microsoft', returnTo: req.query.returnTo as string });
    res.redirect(microsoft.buildAuthorizeUrl(state));
});

router.get('/microsoft/callback', async (req: Request, res: Response) => {
    const { code, state, error } = req.query as Record<string, string>;
    if (error) return res.redirect(`${WEB_BASE}/settings?emailConnected=error&reason=${encodeURIComponent(error)}`);
    if (!code || !state) return res.status(400).send('Missing code or state');

    const ctx = await takeState(state);
    if (!ctx || ctx.provider !== 'microsoft') return res.status(400).send('Invalid or expired state');

    try {
        const tokens = await microsoft.exchangeCode(code);
        if (!tokens.refresh_token) {
            return res.redirect(`${WEB_BASE}/settings?emailConnected=error&reason=missing_refresh_token`);
        }
        const email = (tokens.id_token && microsoft.emailFromIdToken(tokens.id_token)) || '';
        if (!email) return res.status(400).send('Could not derive email from ID token');

        const exp = new Date(Date.now() + tokens.expires_in * 1000);
        await prisma.emailAccount.upsert({
            where: { userId: ctx.userId },
            create: {
                userId: ctx.userId,
                provider: 'microsoft-oauth',
                fromEmail: email,
                oauthRefreshToken: encrypt(tokens.refresh_token),
                oauthAccessToken: encrypt(tokens.access_token),
                oauthExpiresAt: exp,
                smtpHost: null,
                smtpPort: null,
                smtpUser: null,
                smtpPass: null,
                smtpSecure: false,
                lastError: null,
            },
            update: {
                provider: 'microsoft-oauth',
                fromEmail: email,
                oauthRefreshToken: encrypt(tokens.refresh_token),
                oauthAccessToken: encrypt(tokens.access_token),
                oauthExpiresAt: exp,
                smtpHost: null,
                smtpPort: null,
                smtpUser: null,
                smtpPass: null,
                smtpSecure: false,
                lastError: null,
            },
        });
        return res.redirect(`${WEB_BASE}/settings?emailConnected=microsoft&email=${encodeURIComponent(email)}`);
    } catch (e: any) {
        console.error('[OAuth/Microsoft] callback failed:', e?.message);
        return res.redirect(`${WEB_BASE}/settings?emailConnected=error&reason=${encodeURIComponent(e?.message?.substring(0, 200) || 'unknown')}`);
    }
});

/**
 * Whether each provider is wired up server-side. The UI hides the
 * "Connect with X" button when the corresponding env vars aren't set,
 * so beta/dev environments don't show broken buttons.
 */
router.get('/providers', (_req: Request, res: Response) => {
    res.json({
        google: google.isConfigured(),
        microsoft: microsoft.isConfigured(),
    });
});

export default router;
