import { prisma } from '@repo/db';
import { encrypt, decrypt } from '../../utils/crypto';

/**
 * Microsoft (Outlook / Office 365) OAuth + send via Graph API.
 *
 * Multi-tenant: we register the app with `signInAudience=AzureADandPersonal-
 * MicrosoftAccount` so personal @outlook.com / @hotmail.com inboxes work
 * alongside org @company.com Workspace accounts. Authority URL uses
 * `/common/` to route the user to whichever tenant they're signed into.
 *
 * Scopes:
 *   - Mail.Send                       → send-only; no inbox read
 *   - offline_access                  → guarantees refresh_token return
 *   - openid + email + profile        → ID token with .mail/.upn so we
 *                                       can stamp fromEmail without
 *                                       hitting /me as a second call
 *
 * Microsoft skips the verification rigmarole Google requires for Gmail.send;
 * Mail.Send is a delegated permission with user consent only.
 */

const SCOPES = [
    'https://graph.microsoft.com/Mail.Send',
    'offline_access',
    'openid',
    'email',
    'profile',
];

const TENANT = process.env.MICROSOFT_OAUTH_TENANT || 'common';

function clientId(): string {
    const v = process.env.MICROSOFT_OAUTH_CLIENT_ID;
    if (!v) throw new Error('MICROSOFT_OAUTH_CLIENT_ID env not set');
    return v;
}
function clientSecret(): string {
    const v = process.env.MICROSOFT_OAUTH_CLIENT_SECRET;
    if (!v) throw new Error('MICROSOFT_OAUTH_CLIENT_SECRET env not set');
    return v;
}
function redirectUri(): string {
    const base = process.env.OAUTH_REDIRECT_BASE_URL;
    if (!base) throw new Error('OAUTH_REDIRECT_BASE_URL env not set');
    return `${base.replace(/\/$/, '')}/oauth/microsoft/callback`;
}

export function isConfigured(): boolean {
    return !!(process.env.MICROSOFT_OAUTH_CLIENT_ID && process.env.MICROSOFT_OAUTH_CLIENT_SECRET && process.env.OAUTH_REDIRECT_BASE_URL);
}

export function buildAuthorizeUrl(state: string): string {
    const url = new URL(`https://login.microsoftonline.com/${TENANT}/oauth2/v2.0/authorize`);
    url.searchParams.set('client_id', clientId());
    url.searchParams.set('response_type', 'code');
    url.searchParams.set('redirect_uri', redirectUri());
    url.searchParams.set('response_mode', 'query');
    url.searchParams.set('scope', SCOPES.join(' '));
    url.searchParams.set('state', state);
    // prompt=consent ensures refresh_token returns on re-connect.
    url.searchParams.set('prompt', 'consent');
    return url.toString();
}

interface TokenResponse {
    access_token: string;
    refresh_token?: string;
    expires_in: number;
    scope: string;
    token_type: string;
    id_token?: string;
}

export async function exchangeCode(code: string): Promise<TokenResponse> {
    const body = new URLSearchParams({
        client_id: clientId(),
        client_secret: clientSecret(),
        code,
        grant_type: 'authorization_code',
        redirect_uri: redirectUri(),
        scope: SCOPES.join(' '),
    });
    const res = await fetch(`https://login.microsoftonline.com/${TENANT}/oauth2/v2.0/token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: body.toString(),
    });
    if (!res.ok) {
        const text = await res.text();
        throw new Error(`Microsoft token exchange failed: ${res.status} ${text}`);
    }
    return res.json();
}

export function emailFromIdToken(idToken: string): string | null {
    try {
        const payload = idToken.split('.')[1];
        if (!payload) return null;
        const decoded = JSON.parse(Buffer.from(payload, 'base64').toString('utf-8'));
        // Personal MSAs put the address in `email`; org accounts in `upn`
        // or `preferred_username`. Try all three.
        return decoded.email || decoded.upn || decoded.preferred_username || null;
    } catch {
        return null;
    }
}

async function refreshAccessToken(refreshTokenEnc: string): Promise<{ access_token: string; refresh_token?: string; expires_in: number }> {
    const refreshToken = decrypt(refreshTokenEnc);
    const body = new URLSearchParams({
        client_id: clientId(),
        client_secret: clientSecret(),
        refresh_token: refreshToken,
        grant_type: 'refresh_token',
        scope: SCOPES.join(' '),
    });
    const res = await fetch(`https://login.microsoftonline.com/${TENANT}/oauth2/v2.0/token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: body.toString(),
    });
    if (!res.ok) {
        const text = await res.text();
        throw new Error(`Microsoft token refresh failed: ${res.status} ${text}`);
    }
    return res.json();
}

export async function getAccessToken(userId: string): Promise<{ accessToken: string; fromEmail: string }> {
    const account = await prisma.emailAccount.findUnique({ where: { userId } });
    if (!account || account.provider !== 'microsoft-oauth') {
        throw new Error('No Microsoft OAuth account connected');
    }
    if (!account.oauthRefreshToken) {
        throw new Error('Microsoft OAuth refresh token missing — reconnect required');
    }

    const now = Date.now();
    const exp = account.oauthExpiresAt?.getTime() ?? 0;
    if (account.oauthAccessToken && exp > now + 60_000) {
        return { accessToken: decrypt(account.oauthAccessToken), fromEmail: account.fromEmail };
    }

    const refreshed = await refreshAccessToken(account.oauthRefreshToken);
    // Microsoft's refresh rotation: a fresh refresh_token comes back
    // each time. Persist it so we don't drift into a stale chain after
    // ~90 days of inactivity.
    const newExp = new Date(Date.now() + refreshed.expires_in * 1000);
    await prisma.emailAccount.update({
        where: { userId },
        data: {
            oauthAccessToken: encrypt(refreshed.access_token),
            oauthRefreshToken: refreshed.refresh_token ? encrypt(refreshed.refresh_token) : account.oauthRefreshToken,
            oauthExpiresAt: newExp,
        },
    });
    return { accessToken: refreshed.access_token, fromEmail: account.fromEmail };
}

/**
 * Graph /me/sendMail. Synchronous send — Graph returns 202 Accepted on
 * success but doesn't surface a messageId. We synthesize one from the
 * request timestamp so the Message row has *something* unique; future
 * inbox-sync can replace it with the real internetMessageId by querying
 * the Sent Items folder.
 */
export async function sendViaGraph(args: {
    userId: string;
    to: string;
    subject: string;
    text: string;
    html?: string;
    replyTo?: string;
    fromName?: string | null;
}): Promise<string> {
    const { accessToken } = await getAccessToken(args.userId);
    const html = args.html || args.text.split('\n\n').map(p => `<p>${p}</p>`).join('\n');

    const message: any = {
        subject: args.subject,
        body: { contentType: 'HTML', content: html },
        toRecipients: [{ emailAddress: { address: args.to } }],
    };
    if (args.replyTo) {
        message.replyTo = [{ emailAddress: { address: args.replyTo } }];
    }

    const res = await fetch('https://graph.microsoft.com/v1.0/me/sendMail', {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ message, saveToSentItems: true }),
    });
    if (!res.ok) {
        const text = await res.text();
        throw new Error(`Graph sendMail failed: ${res.status} ${text}`);
    }
    return `graph-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}
