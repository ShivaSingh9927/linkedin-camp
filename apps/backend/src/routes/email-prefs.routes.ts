import { Router } from 'express';
import { prisma } from '@repo/db';
import { unsubscribeToken } from '../services/mail.service';

/**
 * One-click unsubscribe from non-transactional email.
 *
 * PUBLIC and unauthenticated on purpose: an unsubscribe link that demands a
 * login is the reason people hit "mark as spam" instead, and spam complaints
 * damage deliverability for every other email we send. The HMAC token is what
 * makes that safe — it is derived from the user id and the app secret, so a
 * link can only ever unsubscribe its own recipient.
 *
 * Scope is deliberately narrow: this sets emailOptOut, which suppresses nudges
 * only. Billing and security mail keeps flowing, because a user who opted out
 * of marketing still needs to know their payment failed.
 */
const router = Router();

const page = (title: string, body: string) =>
    `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">`
    + `<title>${title}</title>`
    + `<div style="font-family:system-ui,sans-serif;max-width:520px;margin:15vh auto;padding:0 24px;text-align:center;">`
    + `<h1 style="font-size:20px;color:#0f172a;">${title}</h1>`
    + `<p style="color:#475569;line-height:1.6;">${body}</p></div>`;

router.get('/unsubscribe', async (req, res) => {
    const userId = String(req.query.u || '');
    const token = String(req.query.t || '');

    if (!userId || !token || token !== unsubscribeToken(userId)) {
        return res.status(400).send(page('That link isn\'t valid',
            'It may have been truncated by your email client. You can turn nudges off in Qampi under Settings.'));
    }

    const updated = await prisma.user
        .update({ where: { id: userId }, data: { emailOptOut: true } as any, select: { email: true } })
        .catch(() => null);

    if (!updated) {
        return res.status(404).send(page('Account not found', 'This account no longer exists.'));
    }

    console.log(`[MAIL] ${updated.email} opted out of non-transactional email.`);
    return res.send(page('You\'re unsubscribed',
        'You won\'t get activity nudges from Qampi any more. Billing and security emails will still reach you, '
        + 'and you can turn nudges back on in Settings whenever you like.'));
});

export default router;
