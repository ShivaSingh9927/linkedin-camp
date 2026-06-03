import { prisma } from '@repo/db';
import { encrypt, decrypt } from '../../utils/crypto';

/**
 * Gmail OAuth + send implementation.
 *
 * Scopes:
 *   - gmail.send       → only "create + send mail," no inbox read access.
 *                        Smallest possible footprint. Restricted scope,
 *                        but the most defensible choice during review.
 *   - userinfo.email   → returned in the ID token so we can stamp
 *                        EmailAccount.fromEmail with the user's actual
 *                        gmail address (saves them typing it).
 *
 * Token lifecycle:
 *   - access_token: ~1 hour, refreshed on demand from refresh_token.
 *   - refresh_token: long-lived (effectively permanent for Workspace
 *                    users, until the user revokes at myaccount.google.com).
 *                    We only get it once, on first consent — `access_type=offline`
 *                    + `prompt=consent` ensure it's always returned, even
 *                    on subsequent connects.
 */

const SCOPES = [
    'https://www.googleapis.com/auth/gmail.send',
    'https://www.googleapis.com/auth/userinfo.email',
];

function clientId(): string {
    const v = process.env.GOOGLE_OAUTH_CLIENT_ID;
    if (!v) throw new Error('GOOGLE_OAUTH_CLIENT_ID env not set');
    return v;
}
function clientSecret(): string {
    const v = process.env.GOOGLE_OAUTH_CLIENT_SECRET;
    if (!v) throw new Error('GOOGLE_OAUTH_CLIENT_SECRET env not set');
    return v;
}
function redirectUri(): string {
    const base = process.env.OAUTH_REDIRECT_BASE_URL;
    if (!base) throw new Error('OAUTH_REDIRECT_BASE_URL env not set');
    return `${base.replace(/\/$/, '')}/oauth/google/callback`;
}

export function isConfigured(): boolean {
    return !!(process.env.GOOGLE_OAUTH_CLIENT_ID && process.env.GOOGLE_OAUTH_CLIENT_SECRET && process.env.OAUTH_REDIRECT_BASE_URL);
}

/** Build the URL we redirect the user's browser to. */
export function buildAuthorizeUrl(state: string): string {
    const url = new URL('https://accounts.google.com/o/oauth2/v2/auth');
    url.searchParams.set('client_id', clientId());
    url.searchParams.set('redirect_uri', redirectUri());
    url.searchParams.set('response_type', 'code');
    url.searchParams.set('scope', SCOPES.join(' '));
    url.searchParams.set('access_type', 'offline');
    // Force consent on every connect to guarantee a refresh_token comes
    // back. Without this, second-time connects skip the consent screen
    // AND skip the refresh_token, leaving us with a 1-hour-only session.
    url.searchParams.set('prompt', 'consent');
    url.searchParams.set('state', state);
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

/** Exchange the auth code for tokens. Run inside the callback. */
export async function exchangeCode(code: string): Promise<TokenResponse> {
    const body = new URLSearchParams({
        client_id: clientId(),
        client_secret: clientSecret(),
        code,
        grant_type: 'authorization_code',
        redirect_uri: redirectUri(),
    });
    const res = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: body.toString(),
    });
    if (!res.ok) {
        const text = await res.text();
        throw new Error(`Google token exchange failed: ${res.status} ${text}`);
    }
    return res.json();
}

/** Read the user's email out of the ID token (no separate userinfo call). */
export function emailFromIdToken(idToken: string): string | null {
    try {
        const payload = idToken.split('.')[1];
        if (!payload) return null;
        const decoded = JSON.parse(Buffer.from(payload, 'base64').toString('utf-8'));
        return decoded.email || null;
    } catch {
        return null;
    }
}

/**
 * Refresh the access token using the stored (encrypted) refresh token.
 * Called before every send when the cached access token is within 60s
 * of expiry — keeps a small buffer so a slow send doesn't 401 mid-flight.
 */
async function refreshAccessToken(refreshTokenEnc: string): Promise<{ access_token: string; expires_in: number }> {
    const refreshToken = decrypt(refreshTokenEnc);
    const body = new URLSearchParams({
        client_id: clientId(),
        client_secret: clientSecret(),
        refresh_token: refreshToken,
        grant_type: 'refresh_token',
    });
    const res = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: body.toString(),
    });
    if (!res.ok) {
        const text = await res.text();
        throw new Error(`Google token refresh failed: ${res.status} ${text}`);
    }
    return res.json();
}

/** Return a valid access token for the user, refreshing if needed. */
export async function getAccessToken(userId: string): Promise<{ accessToken: string; fromEmail: string }> {
    const account = await prisma.emailAccount.findUnique({ where: { userId } });
    if (!account || account.provider !== 'gmail-oauth') {
        throw new Error('No Gmail OAuth account connected');
    }
    if (!account.oauthRefreshToken) {
        throw new Error('Gmail OAuth refresh token missing — reconnect required');
    }

    const now = Date.now();
    const exp = account.oauthExpiresAt?.getTime() ?? 0;
    if (account.oauthAccessToken && exp > now + 60_000) {
        return { accessToken: decrypt(account.oauthAccessToken), fromEmail: account.fromEmail };
    }

    const refreshed = await refreshAccessToken(account.oauthRefreshToken);
    const newExp = new Date(Date.now() + refreshed.expires_in * 1000);
    await prisma.emailAccount.update({
        where: { userId },
        data: {
            oauthAccessToken: encrypt(refreshed.access_token),
            oauthExpiresAt: newExp,
        },
    });
    return { accessToken: refreshed.access_token, fromEmail: account.fromEmail };
}

/**
 * Build an RFC-2822 message and POST it to Gmail's users.messages.send.
 * We send raw MIME so the user's own from-address is preserved (otherwise
 * Gmail rewrites From: to the authenticated account anyway, but explicit
 * is safer for future address-alias support).
 *
 * Returns the Gmail-generated messageId so the caller can stamp it on the
 * Message row for reply-threading.
 */
export async function sendViaGmail(args: {
    userId: string;
    to: string;
    subject: string;
    text: string;
    html?: string;
    replyTo?: string;
    fromName?: string | null;
}): Promise<string> {
    const { accessToken, fromEmail } = await getAccessToken(args.userId);
    const from = args.fromName ? `"${args.fromName}" <${fromEmail}>` : fromEmail;
    const html = args.html || args.text.split('\n\n').map(p => `<p>${p}</p>`).join('\n');

    const boundary = `qampi-${Math.random().toString(36).slice(2)}`;
    const headers = [
        `From: ${from}`,
        `To: ${args.to}`,
        args.replyTo ? `Reply-To: ${args.replyTo}` : null,
        `Subject: ${args.subject}`,
        'MIME-Version: 1.0',
        `Content-Type: multipart/alternative; boundary="${boundary}"`,
    ].filter(Boolean).join('\r\n');

    const body = [
        '',
        `--${boundary}`,
        'Content-Type: text/plain; charset="UTF-8"',
        'Content-Transfer-Encoding: 7bit',
        '',
        args.text,
        `--${boundary}`,
        'Content-Type: text/html; charset="UTF-8"',
        'Content-Transfer-Encoding: 7bit',
        '',
        html,
        `--${boundary}--`,
    ].join('\r\n');

    const rfc822 = headers + '\r\n' + body;
    const raw = Buffer.from(rfc822).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

    const res = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ raw }),
    });
    if (!res.ok) {
        const text = await res.text();
        throw new Error(`Gmail send failed: ${res.status} ${text}`);
    }
    const json = await res.json();
    return json.id || '<unknown>';
}
