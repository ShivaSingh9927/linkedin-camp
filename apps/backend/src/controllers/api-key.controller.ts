import { Response } from 'express';
import { prisma } from '@repo/db';
import { generateApiKey } from '../services/api-key.service';
import { featureAllowed } from '../campaign-engine/safety/quota';

// POST /api/v1/api-keys  { name }
// Creates a key and returns the PLAINTEXT once (never retrievable again).
export async function createApiKey(req: any, res: Response) {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    // API access is a Pro+ feature. No-op unless ENFORCE_TIER_QUOTAS=1.
    if (!(await featureAllowed(userId, 'api'))) {
        return res.status(403).json({
            error: 'UPGRADE_REQUIRED',
            message: 'API access is available on the Pro and Business plans.',
        });
    }

    const name = String(req.body?.name || '').trim() || 'Untitled key';
    const { key, keyHash, prefix } = generateApiKey();

    const row = await prisma.apiKey.create({
        data: { userId, name, keyHash, prefix },
        select: { id: true, name: true, prefix: true, createdAt: true },
    });

    // `key` is returned exactly once — the client must copy it now.
    return res.status(201).json({ ...row, key });
}

// GET /api/v1/api-keys — active keys, masked (never returns the secret).
export async function listApiKeys(req: any, res: Response) {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const keys = await prisma.apiKey.findMany({
        where: { userId, revokedAt: null },
        select: { id: true, name: true, prefix: true, lastUsedAt: true, createdAt: true },
        orderBy: { createdAt: 'desc' },
    });
    return res.json({ keys });
}

// DELETE /api/v1/api-keys/:id — revoke (soft; keyHash kept so it can't be reused).
export async function revokeApiKey(req: any, res: Response) {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const { id } = req.params;
    const result = await prisma.apiKey.updateMany({
        where: { id, userId, revokedAt: null },
        data: { revokedAt: new Date() },
    });
    if (result.count === 0) return res.status(404).json({ error: 'Key not found' });
    return res.json({ ok: true });
}
