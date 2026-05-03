import { Router } from 'express';
import {
    startSocketLogin,
    submitCredentials,
    submit2FACode,
    validateSession,
    getSessionStatus
} from '../controllers/session.controller';
import { authMiddleware } from '../middleware/auth.middleware';

const router = Router();

router.post('/start-socket-login', authMiddleware, startSocketLogin);
router.post('/submit-credentials', authMiddleware, submitCredentials);
router.post('/submit-2fa-code', authMiddleware, submit2FACode);
router.post('/validate-session', authMiddleware, validateSession);
router.get('/session-status', authMiddleware, getSessionStatus);

export default router;
