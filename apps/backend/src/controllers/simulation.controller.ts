import { Request, Response } from 'express';
import { cloudLoginService } from '../services/cloud-login.service';

export const startSimulationLogin = async (req: any, res: Response) => {
    const userId = req.user.id;
    const { email, password } = req.body;

    if (!email || !password) {
        return res.status(400).json({ error: 'Email and password required' });
    }

    try {
        const result: any = await cloudLoginService.startLogin(userId, email, password);
        
        if (result.requires2FA) {
            return res.json({
                success: true,
                requires2FA: true,
                message: 'LinkedIn Security Check: Please enter the code sent to your email.'
            });
        }

        if (result.success) {
            return res.json({ success: true, connected: true });
        }

        return res.status(400).json({ error: result.error || 'Login failed' });
    } catch (error: any) {
        console.error(`[SIMULATION] Fatal error:`, error.message);
        res.status(500).json({ error: 'Cloud browser error. Please try again.' });
    }
};

export const submitSimulation2FA = async (req: any, res: Response) => {
    const userId = req.user.id;
    const { code } = req.body;

    if (!code) {
        return res.status(400).json({ error: 'Verification code required' });
    }

    try {
        const result: any = await cloudLoginService.submit2FA(userId, code);

        if (result.success) {
            return res.json({ success: true, connected: true });
        }

        return res.status(400).json({ error: result.error || 'Verification failed' });
    } catch (error: any) {
        console.error(`[SIMULATION] 2FA error:`, error.message);
        res.status(500).json({ error: 'Verification error. Please try again.' });
    }
};

export const startPhase1PersistentSync = async (req: any, res: Response) => {
    // Keeping this as a placeholder or legacy if needed
    res.status(501).json({ error: 'Phase 1 manual sync is being deprecated in favor of Cloud Login Relay.' });
};

