import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.middleware';
import { DAILY_CAPS, getDailyCount, GovernedAction, OUTSTANDING_INVITE_CAP } from '../campaign-engine/safety/quota';
import { countOutstandingInvites } from '../services/invite-reconcile.service';
import { withdrawStaleInvites } from '../workers/withdraw.worker';

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


/**
 * How full the outstanding-invitation pile is, and what could be cleared.
 *
 * The cap exists because LinkedIn punishes a big unanswered pile harder than
 * anything else it does about invitations. But a ceiling with no way down is a
 * dead end, so the UI needs to SEE the number and the remedy — not just be
 * told "campaign paused".
 */
router.get('/invites/outstanding', async (req: any, res) => {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const outstanding = await countOutstandingInvites(userId);
    // Dry run: reports what IS clearable without touching LinkedIn.
    const preview = await withdrawStaleInvites(userId, { olderThanDays: 30, dryRun: true })
        .catch(() => null);

    return res.json({
        outstanding,
        cap: OUTSTANDING_INVITE_CAP,
        atCap: outstanding >= OUTSTANDING_INVITE_CAP,
        clearable: preview?.eligible ?? 0,
        note: 'Withdrawing an invitation blocks resending to that person for about three weeks, '
            + 'so only invites older than 30 days are offered.',
    });
});

/**
 * Withdraw stale invitations. POST because it changes LinkedIn state.
 *
 * `confirm: true` is required: the action cannot be undone for three weeks, so
 * it must be asked for explicitly rather than triggered by a stray call.
 */
router.post('/invites/withdraw', async (req: any, res) => {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    if (req.body?.confirm !== true) {
        return res.status(400).json({
            error: 'CONFIRM_REQUIRED',
            message: 'Withdrawing invitations cannot be undone for about three weeks. Pass confirm: true.',
        });
    }

    const olderThanDays = Math.max(14, parseInt(String(req.body?.olderThanDays ?? 30), 10) || 30);
    const max = Math.min(50, Math.max(1, parseInt(String(req.body?.max ?? 20), 10) || 20));

    const result = await withdrawStaleInvites(userId, { olderThanDays, max, dryRun: false });
    return res.status(result.ok ? 200 : 502).json(result);
});

export default router;
