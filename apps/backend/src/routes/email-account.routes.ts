import { Router, Response } from 'express';
import { prisma } from '@repo/db';
import { authMiddleware, AuthRequest } from '../middleware/auth.middleware';
import { upsertEmailAccount, sendTestEmail } from '../services/email.service';

const router = Router();
router.use(authMiddleware);

/**
 * GET /email-account — current connection state for the signed-in user.
 * Returns null when nothing's connected so the UI can render an empty
 * form. Never returns the encrypted password; the UI shows a placeholder
 * "•••••••" and only POSTs a new value when the user is rotating creds.
 */
router.get('/', async (req: AuthRequest, res: Response) => {
    const userId = req.user!.id;
    const account = await prisma.emailAccount.findUnique({ where: { userId } });
    if (!account) return res.json({ account: null });
    res.json({
        account: {
            provider: account.provider,
            fromEmail: account.fromEmail,
            fromName: account.fromName,
            smtpHost: account.smtpHost,
            smtpPort: account.smtpPort,
            smtpUser: account.smtpUser,
            smtpSecure: account.smtpSecure,
            hasPassword: !!account.smtpPass,
            lastSendAt: account.lastSendAt,
            lastError: account.lastError,
            updatedAt: account.updatedAt,
        },
    });
});

/**
 * PUT /email-account — upsert SMTP config. Password is required only on
 * first save; subsequent saves can omit it to keep the stored value
 * (rotation requires sending the new password explicitly).
 */
router.put('/', async (req: AuthRequest, res: Response) => {
    const userId = req.user!.id;
    const { fromEmail, fromName, smtpHost, smtpPort, smtpUser, smtpPass, smtpSecure } = req.body;

    if (!fromEmail || !smtpHost || !smtpPort || !smtpUser) {
        return res.status(400).json({ error: 'fromEmail, smtpHost, smtpPort, smtpUser are required' });
    }

    const existing = await prisma.emailAccount.findUnique({ where: { userId } });

    if (!smtpPass && !existing?.smtpPass) {
        return res.status(400).json({ error: 'smtpPass is required for first-time setup' });
    }

    // No password on update → keep the stored one by only writing the
    // other fields. upsertEmailAccount always re-encrypts, so we have
    // to branch here.
    if (!smtpPass && existing) {
        const updated = await prisma.emailAccount.update({
            where: { userId },
            data: {
                fromEmail,
                fromName: fromName ?? null,
                smtpHost,
                smtpPort: Number(smtpPort),
                smtpUser,
                smtpSecure: smtpSecure ?? false,
                lastError: null,
            },
        });
        return res.json({ account: { fromEmail: updated.fromEmail, hasPassword: !!updated.smtpPass } });
    }

    const account = await upsertEmailAccount(userId, {
        fromEmail,
        fromName,
        smtpHost,
        smtpPort: Number(smtpPort),
        smtpUser,
        smtpPass,
        smtpSecure,
    });

    res.json({ account: { fromEmail: account.fromEmail, hasPassword: !!account.smtpPass } });
});

/**
 * POST /email-account/test — sends a fixed "connection works" email to
 * the user's own fromEmail. Useful as the second step in onboarding: save
 * creds, click test, see email arrive.
 */
router.post('/test', async (req: AuthRequest, res: Response) => {
    const userId = req.user!.id;
    const result = await sendTestEmail(userId);
    if (!result.success) return res.status(400).json({ error: result.error });
    res.json({ ok: true, messageId: result.messageId });
});

/**
 * DELETE /email-account — disconnects. Used when the user wants to swap
 * providers or revoke access. Outgoing EMAIL nodes after this will skip
 * with the "no account connected" reason.
 */
router.delete('/', async (req: AuthRequest, res: Response) => {
    const userId = req.user!.id;
    await prisma.emailAccount.delete({ where: { userId } }).catch(() => undefined);
    res.json({ ok: true });
});

export default router;
