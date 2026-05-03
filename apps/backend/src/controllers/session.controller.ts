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

export const submitCredentials = async (req: any, res: Response) => {
    const userId = req.user.id;
    const { email, password } = req.body;

    if (!email || !password) {
        return res.status(400).json({ error: 'Email and password required' });
    }

    try {
        const result = await sessionManager.submitCredentials(userId, email, password);
        if (result.error) {
            return res.status(400).json({ error: result.error });
        }
        res.json({ success: true, requires2FA: result.requires2FA });
    } catch (error: any) {
        console.error(`[SESSION-CTRL] submitCredentials error: ${error.message}`);
        res.status(500).json({ error: 'Failed to submit credentials' });
    }
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
        const result = await sessionValidator.quickCheck(userId);
        res.json(result);
    } catch (error: any) {
        console.error(`[SESSION-CTRL] getSessionStatus error: ${error.message}`);
        res.status(500).json({ connected: false, sessionInvalid: true });
    }
};
