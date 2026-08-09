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
import { redisOtpResolver, submitOtp, newRequestId, claimRefreshSlot, releaseRefreshSlot, setRefreshState, getRefreshState } from '../services/otp-relay.service';

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

/**
 * `phase` exists because the UI was guessing. It flipped to the OTP prompt the
 * instant /refresh returned a requestId — before LinkedIn had asked for
 * anything — and after a code was submitted it kept showing the same empty box,
 * then warned that the code looked rejected on a 12-second timer. A correct
 * code therefore looked exactly like a wrong one for the ~50s a login takes.
 *
 * The backend already knows the truth: the otpResolver is called only when
 * LinkedIn actually asks, and called AGAIN when a code is refused. Reporting
 * that removes every guess from the client.
 *
 *   starting     — driving the login form, nothing asked of the user yet
 *   awaiting_otp — LinkedIn asked; `attempt` > 1 means the last code was refused
 *   verifying    — a code was handed over, waiting on LinkedIn
 *   done         — terminal; read `outcome`
 *
 * Stored in Redis (see setRefreshState) rather than in this process, so the
 * status survives a restart and is answerable by any replica.
 */

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

    // One login attempt per account. Without this, every retry — and in a mobile
    // in-app browser the OTP submit fails often enough that users retry a lot —
    // started ANOTHER concurrent headless login, each pulling its own LinkedIn
    // code. Crossed codes, none working, and LinkedIn penalising the account for
    // rapid repeat logins.
    //
    // A retry re-attaches to the in-flight attempt instead of erroring, so the
    // code the user types still reaches the worker that's waiting for it.
    const requestId = newRequestId();
    const slot = await claimRefreshSlot(userId, requestId);
    if (!slot.claimed) {
        if (slot.existingRequestId) {
            console.log(`[session/refresh] user=${userId} already has attempt ${slot.existingRequestId} in flight — re-attaching`);
            return res.json({ requestId: slot.existingRequestId, reattached: true });
        }
        // Slot expired in the gap between our SET NX and the GET; take it now.
        const retry = await claimRefreshSlot(userId, requestId);
        if (!retry.claimed) {
            return res.status(409).json({ error: 'A login attempt is already running for this account. Please wait a moment.' });
        }
    }

    let fp: any = {};
    try { fp = user?.linkedinFingerprint ? JSON.parse(user.linkedinFingerprint as any) : {}; } catch {}

    // Fire-and-forget. The worker resolves OTPs through Redis; meanwhile the
    // UI polls /refresh-status?requestId=... and POSTs codes via /session/otp.
    await setRefreshState(requestId, { status: 'running', phase: 'starting' });

    // Wrap the resolver rather than reaching into loginWithOtp: it is called
    // exactly when LinkedIn puts up the code prompt, and called again with a
    // higher `attempt` when a code is refused. That makes it the precise
    // boundary between "asking the user" and "waiting on LinkedIn".
    const resolveOtp = redisOtpResolver(userId, requestId);
    const trackedResolver = async (attempt: number) => {
        await setRefreshState(requestId, { status: 'running', phase: 'awaiting_otp', attempt });
        const code = await resolveOtp(attempt);
        // An empty code means the relay timed out waiting, not that a code was
        // supplied — don't claim to be verifying something we never got.
        await setRefreshState(requestId, {
            status: 'running',
            phase: code ? 'verifying' : 'awaiting_otp',
            attempt,
        });
        return code;
    };

    loginWithOtp({
        userId,
        email,
        password,
        proxy: { server: snap.server, username: snap.username, password: snap.password },
        userAgent: fp.userAgent,
        otpResolver: trackedResolver,
    }).then(outcome => {
        // Redis expires this on its own TTL — no timer to leak, and no cleanup
        // that a restart could skip.
        void setRefreshState(requestId, { status: 'done', phase: 'done', outcome });
    }).catch(err => {
        void setRefreshState(requestId, { status: 'done', phase: 'done', outcome: { kind: 'unknown', error: err.message } });
    }).finally(() => {
        // Free the slot the moment this attempt finishes — success or failure —
        // so a user whose login legitimately failed can retry immediately rather
        // than waiting out the TTL.
        void releaseRefreshSlot(userId, requestId);
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

router.get('/refresh-status', authMiddleware, async (req: any, res) => {
    const requestId = String(req.query.requestId || '');
    const state = await getRefreshState(requestId);
    // 'unknown' now genuinely means no such request — a bad id or an expired
    // TTL — rather than "you reached the wrong replica". Report a phase so the
    // client never has to infer one from a missing field.
    if (!state) return res.json({ status: 'unknown', phase: 'starting' });
    return res.json(state);
});

export default router;
