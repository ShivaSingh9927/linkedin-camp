import { Response, NextFunction } from 'express';
import { prisma } from '@repo/db';
import { hashApiKey, looksLikeApiKey } from '../services/api-key.service';

// Authenticates the PUBLIC API (/api/public/v1) with a personal API key rather
// than a login JWT. Accepts either:
//   Authorization: Bearer qampi_live_xxx
//   X-API-Key: qampi_live_xxx
// On success, attaches req.user = { id, email } so downstream handlers read the
// user the same way the JWT-authed routes do.
export async function apiKeyAuth(req: any, res: Response, next: NextFunction) {
    const bearer = req.headers.authorization?.startsWith('Bearer ')
        ? req.headers.authorization.slice(7)
        : undefined;
    const token = (req.headers['x-api-key'] as string) || bearer;

    if (!looksLikeApiKey(token)) {
        return res.status(401).json({ error: 'Missing or malformed API key' });
    }

    const row = await prisma.apiKey.findUnique({
        where: { keyHash: hashApiKey(token as string) },
        select: { id: true, userId: true, revokedAt: true, User: { select: { email: true } } },
    }).catch(() => null);

    if (!row || row.revokedAt) {
        return res.status(401).json({ error: 'Invalid or revoked API key' });
    }

    req.user = { id: row.userId, email: row.User?.email };
    // Best-effort last-used stamp; never block the request on it.
    prisma.apiKey.update({ where: { id: row.id }, data: { lastUsedAt: new Date() } }).catch(() => {});
    next();
}
