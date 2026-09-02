import { Response } from 'express';
import { prisma } from '@repo/db';

// ── Response contract ────────────────────────────────────────────────────────
// Every error: HTTP status + { error: <CODE>, message, ...details }.
// Every list:  { data, total, limit, offset }.

export function apiError(res: Response, status: number, code: string, message: string, extra?: Record<string, any>) {
    return res.status(status).json({ error: code, message, ...(extra || {}) });
}

export function list(res: Response, data: any[], total: number, limit: number, offset: number) {
    return res.json({ data, total, limit, offset });
}

export function parsePaging(req: any): { limit: number; offset: number } {
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 25, 1), 100);
    const offset = Math.max(parseInt(req.query.offset, 10) || 0, 0);
    return { limit, offset };
}

// ── Period reset helpers (for /usage + QUOTA_EXCEEDED) ───────────────────────
export function startOfTomorrowUTC(): Date {
    const d = new Date();
    return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + 1));
}
export function startOfNextMonthUTC(): Date {
    const d = new Date();
    return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1));
}

// ── Prerequisite checks (return an error tuple or null) ──────────────────────
export interface PrereqError { status: number; code: string; message: string; extra?: Record<string, any>; }

const APP_URL = process.env.APP_URL || process.env.FRONTEND_URL || 'https://app.qampi.ai';

// LinkedIn session must be healthy for any LinkedIn-touching action.
export async function checkLinkedInHealthy(userId: string): Promise<PrereqError | null> {
    const u = await prisma.user.findUnique({
        where: { id: userId },
        select: { accountHealth: true, sessionInvalid: true, linkedinCookie: true },
    }).catch(() => null);
    if (!u || !u.linkedinCookie || u.sessionInvalid || u.accountHealth !== 'HEALTHY') {
        return {
            status: 409,
            code: 'LINKEDIN_SESSION_EXPIRED',
            message: 'Your LinkedIn session has expired. Please re-sync your LinkedIn account in Qampi to continue.',
            extra: { resyncUrl: `${APP_URL}/settings?section=linkedin` },
        };
    }
    return null;
}

// A connected sending email account is required for email-channel templates.
export async function checkEmailAccount(userId: string): Promise<PrereqError | null> {
    const acct = await prisma.emailAccount.findUnique({ where: { userId }, select: { id: true } }).catch(() => null);
    if (!acct) {
        return {
            status: 409,
            code: 'EMAIL_ACCOUNT_REQUIRED',
            message: 'This campaign sends email — connect a sending account in Qampi first.',
            extra: { connectUrl: `${APP_URL}/settings?section=email` },
        };
    }
    return null;
}

export function sendPrereq(res: Response, e: PrereqError) {
    return apiError(res, e.status, e.code, e.message, e.extra);
}
