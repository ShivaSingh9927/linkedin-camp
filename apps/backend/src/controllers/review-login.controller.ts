// TEMPORARY — email/password sign-in for ONE allowlisted reviewer account
// (Razorpay's website review needs credentials; normal sign-in is
// Google/LinkedIn only). Remove after the review: delete this file, its two
// routes in auth.routes.ts, its limiter line in server.ts, and the web
// /login/email page + the link in AuthLayout.
//
// Off unless BOTH env vars are set on the backend:
//   REVIEW_LOGIN_EMAIL           — the one email allowed to sign in this way
//   REVIEW_LOGIN_PASSWORD_HASH   — scrypt:<saltHex>:<hashHex>, generated with
//     node -e "const c=require('crypto');const s=c.randomBytes(16);console.log('scrypt:'+s.toString('hex')+':'+c.scryptSync(process.argv[1],s,64).toString('hex'))" 'THE-PASSWORD'
//   (no `$` in the format, so docker compose env-file interpolation can't mangle it)
//
// It never signs anyone else in and never touches other accounts. The first
// successful sign-in creates the reviewer's user with onboarding complete.
import { Request, Response } from 'express';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { prisma } from '@repo/db';

const JWT_SECRET = process.env.JWT_SECRET || 'supersecretkey';

function config(): { email: string; salt: Buffer; hash: Buffer } | null {
    const email = (process.env.REVIEW_LOGIN_EMAIL || '').trim().toLowerCase();
    const stored = (process.env.REVIEW_LOGIN_PASSWORD_HASH || '').trim();
    const m = /^scrypt:([0-9a-f]+):([0-9a-f]{128})$/i.exec(stored);
    if (!email || !m) return null;
    return { email, salt: Buffer.from(m[1], 'hex'), hash: Buffer.from(m[2], 'hex') };
}

// GET /api/v1/auth/review-login — lets the web app show or hide the form.
export function reviewLoginStatus(_req: Request, res: Response) {
    res.json({ enabled: !!config() });
}

// POST /api/v1/auth/review-login  body: { email, password }
export async function reviewLogin(req: Request, res: Response) {
    const cfg = config();
    if (!cfg) return res.status(404).json({ error: 'Email sign-in is not available. Please continue with Google or LinkedIn.' });

    const email = String(req.body?.email || '').trim().toLowerCase();
    const password = String(req.body?.password || '');
    if (!email || !password) return res.status(400).json({ error: 'Enter your email and password.' });

    // Always run the hash so a wrong email and a wrong password take the same time.
    const candidate = crypto.scryptSync(password, cfg.salt, cfg.hash.length);
    const passwordOk = crypto.timingSafeEqual(candidate, cfg.hash);
    if (email !== cfg.email || !passwordOk) {
        return res.status(401).json({ error: 'Incorrect email or password.' });
    }

    try {
        const user = await prisma.user.upsert({
            where: { email: cfg.email },
            create: { email: cfg.email, firstName: 'Razorpay', lastName: 'Review', registrationStep: 'COMPLETED' },
            update: {},
        });
        const token = jwt.sign({ id: user.id, email: user.email }, JWT_SECRET, { expiresIn: '7d' });
        console.log(`[AUTH/REVIEW] reviewer signed in (${user.id})`);
        return res.json({
            user: {
                id: user.id,
                email: user.email,
                firstName: user.firstName,
                lastName: user.lastName,
                avatarUrl: user.avatarUrl,
                registrationStep: user.registrationStep,
                tier: user.tier,
            },
            token,
        });
    } catch (err: any) {
        console.error('[AUTH/REVIEW] sign-in failed:', err?.message);
        return res.status(500).json({ error: 'Sign-in failed. Please try again.' });
    }
}
