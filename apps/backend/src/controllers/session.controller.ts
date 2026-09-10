import { Request, Response } from 'express';
import { sessionManager } from '../services/session-manager.service';
import { sessionValidator } from '../services/session-validator.service';

export const startSocketLogin = async (req: any, res: Response) => {
    const userId = req.user.id;

    try {
        const result = await sessionManager.startLogin(userId);
        if (!result.success) {
            return res.status(500).json({ error: result.error });
        }
        res.json({ success: true, message: 'Login browser launched. Waiting for credentials.' });
    } catch (error: any) {
        console.error(`[SESSION-CTRL] startSocketLogin error: ${error.message}`);
        res.status(500).json({ error: 'Failed to start login' });
    }
};

/**
 * Interactive login: launch the proxied browser and stream it to the user so
 * they can sign in themselves. This is the only path available to accounts
 * with no password — Google/Apple SSO — and to passkey users, whose
 * authenticator can't reach a datacenter browser.
 */
export const startInteractiveLogin = async (req: any, res: Response) => {
    const userId = req.user.id;

    try {
        // Re-entrancy guard. startLogin() closes any existing context and
        // launches a fresh one, so a second call — a double click, a React
        // re-render, a retry — silently destroys a sign-in the user is halfway
        // through, and their in-flight SSO pop-up dies with it. If a stream is
        // already live, leave it alone.
        if (sessionManager.isInteractive(userId)) {
            console.log(`[SESSION-CTRL] Interactive login already live for ${userId} — reusing it`);
            return res.json({ success: true, message: 'Interactive login already running.' });
        }

        const launched = await sessionManager.startLogin(userId);
        if (!launched.success) {
            return res.status(500).json({ error: launched.error });
        }
        const streaming = await sessionManager.startInteractive(userId);
        if (!streaming.success) {
            return res.status(500).json({ error: streaming.error });
        }
        res.json({ success: true, message: 'Interactive login started. Frames stream over Socket.IO.' });
    } catch (error: any) {
        console.error(`[SESSION-CTRL] startInteractiveLogin error: ${error.message}`);
        res.status(500).json({ error: 'Failed to start interactive login' });
    }
};

export const stopInteractiveLogin = async (req: any, res: Response) => {
    const userId = req.user.id;
    try {
        await sessionManager.stopInteractive(userId);
        res.json({ success: true });
    } catch (error: any) {
        console.error(`[SESSION-CTRL] stopInteractiveLogin error: ${error.message}`);
        res.status(500).json({ error: 'Failed to stop interactive login' });
    }
};

export const submitCredentials = async (req: any, res: Response) => {
    const userId = req.user.id;
    const { email, password } = req.body;

    if (!email || !password) {
        return res.status(400).json({ error: 'Email and password required' });
    }

    // Fire-and-forget — Playwright login can take 30–90s which exceeds the LB
    // idle timeout. Final outcome (SUCCESS / AWAITING_2FA / FAILED) is emitted
    // to the user's room via Socket.IO `SESSION_LOGIN_STATUS`.
    sessionManager.submitCredentials(userId, email, password)
        .then(async (result) => {
            if (result?.error) {
                const { io } = await import('../socket');
                io.to(`user_${userId}`).emit('SESSION_LOGIN_STATUS', { status: 'FAILED', error: result.error });
            }
        })
        .catch(async (error: any) => {
            console.error(`[SESSION-CTRL] submitCredentials async error: ${error.message}`);
            const { io } = await import('../socket');
            io.to(`user_${userId}`).emit('SESSION_LOGIN_STATUS', { status: 'FAILED', error: error.message });
        });

    res.status(202).json({ accepted: true, message: 'Login started. Watch SESSION_LOGIN_STATUS over Socket.IO for the outcome.' });
};

export const submit2FACode = async (req: any, res: Response) => {
    const userId = req.user.id;
    const { code } = req.body;

    if (!code) {
        return res.status(400).json({ error: 'Verification code required' });
    }

    try {
        const result = await sessionManager.submit2FA(userId, code);
        if (result.error) {
            return res.status(400).json({ error: result.error });
        }
        res.json({ success: true });
    } catch (error: any) {
        console.error(`[SESSION-CTRL] submit2FACode error: ${error.message}`);
        res.status(500).json({ error: 'Failed to submit 2FA code' });
    }
};

export const validateSession = async (req: any, res: Response) => {
    const userId = req.user.id;

    try {
        const result = await sessionValidator.validateSession(userId);
        res.json(result);
    } catch (error: any) {
        console.error(`[SESSION-CTRL] validateSession error: ${error.message}`);
        res.status(500).json({ valid: false, reason: 'ERROR', message: error.message });
    }
};

export const getSessionStatus = async (req: any, res: Response) => {
    const userId = req.user.id;

    try {
        // Same problem as /auth/linkedin-status: quickCheck only reads DB flags,
        // so it reports a LinkedIn-killed session as connected until something
        // else notices. Probe for real when the flags are stale (TTL-gated,
        // browser-free), otherwise fall back to the cached flags.
        const result = await sessionValidator.liveCheckCached(userId).catch(() => null)
            ?? await sessionValidator.quickCheck(userId);
        res.json(result);
    } catch (error: any) {
        console.error(`[SESSION-CTRL] getSessionStatus error: ${error.message}`);
        res.status(500).json({ connected: false, sessionInvalid: true });
    }
};
