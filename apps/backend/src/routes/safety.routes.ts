import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.middleware';
import { DAILY_CAPS, getDailyCount, GovernedAction } from '../campaign-engine/safety/quota';

const router = Router();
router.use(authMiddleware);

// Today's per-account quota usage. Drives the UI safety badge so users can
// see how close they are to the daily cap before launching more work.
// Counts are read directly from ActionLog (same source the engine uses for
// its pre-flight gate), so this view is always consistent with what the
// engine will allow next.
router.get('/quota', async (req: any, res) => {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const actions = Object.keys(DAILY_CAPS) as GovernedAction[];
    const counts = await Promise.all(
        actions.map(async (action) => {
            const used = await getDailyCount(userId, action);
            const cap = DAILY_CAPS[action];
            return {
                action,
                used,
                cap,
                remaining: Math.max(0, cap - used),
                exhausted: used >= cap,
            };
        })
    );

    res.json({
        date: new Date().toISOString().slice(0, 10),
        quotas: counts,
    });
});

export default router;
