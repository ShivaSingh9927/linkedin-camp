import { Router } from 'express';
import {
    startSocketLogin,
    submitCredentials,
    submit2FACode,
    validateSession,
    getSessionStatus
} from '../controllers/session.controller';
import { authMiddleware } from '../middleware/auth.middleware';
import { prisma } from '@repo/db';
import { loginWithOtp } from '../services/login-with-otp.service';
import { redisOtpResolver, submitOtp, newRequestId } from '../services/otp-relay.service';

const router = Router();

router.post('/start-socket-login', authMiddleware, startSocketLogin);
router.post('/submit-credentials', authMiddleware, submitCredentials);
router.post('/submit-2fa-code', authMiddleware, submit2FACode);
router.post('/validate-session', authMiddleware, validateSession);
router.get('/session-status', authMiddleware, getSessionStatus);

// Cheap polling endpoint for the frontend AccountHealthBanner. Returns
// just the fields the banner needs — single SELECT, no Playwright launch,
// safe to poll every 30s without rate-limiting concerns.
router.get('/health', authMiddleware, async (req: any, res) => {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: 'unauthorized' });
    const u = await prisma.user.findUnique({
        where: { id: userId },
        select: { accountHealth: true, accountHealthReason: true, accountHealthAt: true, email: true },
    });
    if (!u) return res.status(404).json({ error: 'user not found' });
    return res.json({
        accountHealth: u.accountHealth,
        accountHealthReason: u.accountHealthReason,
        accountHealthAt: u.accountHealthAt,
        linkedinEmail: u.email,
    });
});

// ---- Production OTP-recovery flow ----
//
// POST /session/refresh
//   body: { email, password }
//   returns: { requestId }                                 (immediately)
//   kicks off loginWithOtp in the background; if LinkedIn shows an OTP page,
//   the worker blocks on the Redis relay key keyed by (userId, requestId).
//
// POST /session/otp
//   body: { requestId, code }
//   returns: { queued: true }
//   pushes the user-supplied code into the relay; the worker wakes up.
//
// GET /session/refresh-status?requestId=...
//   returns: { status, outcome? }
//   light status check the UI can poll after submitting the OTP.

const refreshState = new Map<string, { status: 'running' | 'done', outcome?: any }>();

router.post('/refresh', authMiddleware, async (req: any, res) => {
    const userId = req.user?.id;
    const { email, password } = req.body || {};
    if (!userId || !email || !password) {
        return res.status(400).json({ error: 'email and password required' });
    }

    const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { linkedinProxySnapshot: true, linkedinFingerprint: true },
    });
    const snap: any = user?.linkedinProxySnapshot;
    if (!snap?.server) {
        return res.status(400).json({ error: 'No proxy snapshot pinned — cold login flow required, not refresh.' });
    }

    const requestId = newRequestId();
    refreshState.set(requestId, { status: 'running' });

    let fp: any = {};
    try { fp = user?.linkedinFingerprint ? JSON.parse(user.linkedinFingerprint as any) : {}; } catch {}

    // Fire-and-forget. The worker resolves OTPs through Redis; meanwhile the
    // UI polls /refresh-status?requestId=... and POSTs codes via /session/otp.
    loginWithOtp({
        userId,
        email,
        password,
        proxy: { server: snap.server, username: snap.username, password: snap.password },
        userAgent: fp.userAgent,
        otpResolver: redisOtpResolver(userId, requestId),
    }).then(outcome => {
        refreshState.set(requestId, { status: 'done', outcome });
        setTimeout(() => refreshState.delete(requestId), 5 * 60 * 1000);
    }).catch(err => {
        refreshState.set(requestId, { status: 'done', outcome: { kind: 'unknown', error: err.message } });
    });

    return res.json({ requestId });
});

router.post('/otp', authMiddleware, async (req: any, res) => {
    const userId = req.user?.id;
    const { requestId, code } = req.body || {};
    if (!userId || !requestId || !code) return res.status(400).json({ error: 'requestId and code required' });
    await submitOtp(userId, requestId, String(code));
    return res.json({ queued: true });
});

router.get('/refresh-status', authMiddleware, (req: any, res) => {
    const requestId = String(req.query.requestId || '');
    const state = refreshState.get(requestId);
    if (!state) return res.json({ status: 'unknown' });
    return res.json(state);
});

export default router;
