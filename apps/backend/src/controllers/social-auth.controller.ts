import { Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import axios from 'axios';
import { prisma } from '@repo/db';
import { mailService } from '../services/mail.service';

// Generic OpenID-Connect (authorization-code) login for social providers that
// aren't Google one-tap. Microsoft and LinkedIn both implement OIDC, so a single
// parameterised flow covers both: redirect → provider → callback → exchange code
// → decode id_token → upsert user → mint our own JWT → bounce to the web app.
//
// Google keeps its own one-tap handler (auth.controller.ts) — it already works
// and uses a client-side credential rather than a redirect.

const JWT_SECRET = process.env.JWT_SECRET || 'supersecretkey';

// Public URLs — must be reachable by the browser AND match what's registered in
// each provider's OAuth app. Defaults target local dev.
const BACKEND_PUBLIC_URL = (process.env.BACKEND_PUBLIC_URL || 'http://localhost:3001').replace(/\/$/, '');
const APP_PUBLIC_URL = (process.env.APP_PUBLIC_URL || 'http://localhost:3000').replace(/\/$/, '');

type NormalizedProfile = {
  providerId: string;
  email: string;
  firstName?: string;
  lastName?: string;
  picture?: string;
};

interface ProviderConfig {
  authUrl: string;
  tokenUrl: string;
  scope: string;
  idField: 'microsoftId' | 'linkedinId';
  clientId: () => string | undefined;
  clientSecret: () => string | undefined;
}

const PROVIDERS: Record<string, ProviderConfig> = {
  microsoft: {
    authUrl: 'https://login.microsoftonline.com/common/oauth2/v2.0/authorize',
    tokenUrl: 'https://login.microsoftonline.com/common/oauth2/v2.0/token',
    scope: 'openid profile email',
    idField: 'microsoftId',
    clientId: () => process.env.MICROSOFT_CLIENT_ID,
    clientSecret: () => process.env.MICROSOFT_CLIENT_SECRET,
  },
  linkedin: {
    // "Sign In with LinkedIn using OpenID Connect" product.
    authUrl: 'https://www.linkedin.com/oauth/v2/authorization',
    tokenUrl: 'https://www.linkedin.com/oauth/v2/accessToken',
    scope: 'openid profile email',
    idField: 'linkedinId',
    clientId: () => process.env.LINKEDIN_CLIENT_ID,
    clientSecret: () => process.env.LINKEDIN_CLIENT_SECRET,
  },
};

const redirectUri = (provider: string) => `${BACKEND_PUBLIC_URL}/api/v1/auth/oauth/${provider}/callback`;

// id_token comes straight from the provider's token endpoint over a server-to-
// server TLS call authenticated with our client secret, so decoding (vs. full
// JWKS signature verification) is acceptable here.
function decodeIdToken(idToken: string): any {
  const payload = idToken.split('.')[1];
  return JSON.parse(Buffer.from(payload, 'base64').toString('utf8'));
}

function bounceToApp(res: Response, params: Record<string, string>) {
  const qs = new URLSearchParams(params).toString();
  res.redirect(`${APP_PUBLIC_URL}/auth/callback?${qs}`);
}

// GET /auth/oauth/:provider/start — kick off the redirect dance.
export const oauthStart = (req: Request, res: Response) => {
  const provider = String(req.params.provider);
  const cfg = PROVIDERS[provider];
  if (!cfg) return res.status(404).json({ error: 'Unknown provider' });

  const clientId = cfg.clientId();
  if (!clientId || !cfg.clientSecret()) {
    return res.status(500).json({ error: `${provider} login is not configured on the server` });
  }

  // Stateless CSRF guard: a short-lived signed token round-trips as `state`.
  const state = jwt.sign({ provider }, JWT_SECRET, { expiresIn: '10m' });

  const url = new URL(cfg.authUrl);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('client_id', clientId);
  url.searchParams.set('redirect_uri', redirectUri(provider));
  url.searchParams.set('scope', cfg.scope);
  url.searchParams.set('state', state);
  res.redirect(url.toString());
};

// GET /auth/oauth/:provider/callback — provider redirects back here with a code.
export const oauthCallback = async (req: Request, res: Response) => {
  const provider = String(req.params.provider);
  const cfg = PROVIDERS[provider];
  if (!cfg) return res.status(404).json({ error: 'Unknown provider' });

  const { code, state, error: providerError } = req.query as Record<string, string>;
  if (providerError) return bounceToApp(res, { error: providerError });
  if (!code || !state) return bounceToApp(res, { error: 'missing_code' });

  try {
    jwt.verify(state, JWT_SECRET); // throws if tampered/expired
  } catch {
    return bounceToApp(res, { error: 'invalid_state' });
  }

  try {
    const tokenRes = await axios.post(
      cfg.tokenUrl,
      new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: redirectUri(provider),
        client_id: cfg.clientId()!,
        client_secret: cfg.clientSecret()!,
      }).toString(),
      { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
    );

    const idToken = tokenRes.data.id_token;
    if (!idToken) {
      console.error(`[AUTH/${provider}] No id_token in token response`);
      return bounceToApp(res, { error: 'no_id_token' });
    }

    const claims = decodeIdToken(idToken);
    if (!claims.email) {
      console.error(`[AUTH/${provider}] id_token missing email claim`);
      return bounceToApp(res, { error: 'no_email' });
    }

    const profile: NormalizedProfile = {
      providerId: claims.sub,
      email: claims.email,
      firstName: claims.given_name,
      lastName: claims.family_name,
      picture: claims.picture,
    };

    const { user, isNew } = await findOrCreateSocialUser(cfg.idField, profile, provider);
    const token = jwt.sign({ id: user.id, email: user.email }, JWT_SECRET, { expiresIn: '7d' });

    bounceToApp(res, {
      token,
      step: user.registrationStep || 'STARTED',
      ...(isNew ? { new: '1' } : {}),
    });
  } catch (err: any) {
    console.error(`[AUTH/${provider}] callback failed:`, err.response?.data || err.message);
    bounceToApp(res, { error: 'exchange_failed' });
  }
};

// Shared upsert: match by provider id → fall back to email (link accounts) →
// create. Mirrors the Google handler's behaviour.
async function findOrCreateSocialUser(
  idField: 'microsoftId' | 'linkedinId',
  profile: NormalizedProfile,
  provider: string
): Promise<{ user: any; isNew: boolean }> {
  let user = await prisma.user.findUnique({ where: { [idField]: profile.providerId } as any });
  if (user) return { user, isNew: false };

  user = await prisma.user.findUnique({ where: { email: profile.email } });
  if (user) {
    const linked = await prisma.user.update({
      where: { id: user.id },
      data: { [idField]: profile.providerId, avatarUrl: profile.picture || user.avatarUrl } as any,
    });
    return { user: linked, isNew: false };
  }

  user = await prisma.user.create({
    data: {
      email: profile.email,
      firstName: profile.firstName,
      lastName: profile.lastName,
      avatarUrl: profile.picture,
      registrationStep: 'STARTED',
      updatedAt: new Date(),
      [idField]: profile.providerId,
    } as any,
  });

  void mailService
    .sendWelcomeEmail(user.email, user.firstName || 'User')
    .catch((e: any) => console.error(`[AUTH/${provider}] welcome email failed:`, e?.message));

  return { user, isNew: true };
}
