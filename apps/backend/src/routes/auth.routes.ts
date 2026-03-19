import { Router } from 'express';
import { register, login, syncExtension, getCloudStatus, getLinkedinStatus, syncLinkedinProfile, startLinkedinLogin, heartbeat, bookmarkletSync } from '../controllers/auth.controller';
import { startSimulationLogin, submitSimulation2FA } from '../controllers/simulation.controller';
import { authMiddleware } from '../middleware/auth';

const router = Router();

router.post('/register', register);
router.post('/login', login);
router.post('/heartbeat', authMiddleware, heartbeat);
router.post('/extension-sync', authMiddleware, syncExtension);
router.post('/start-login', authMiddleware, startLinkedinLogin);
router.get('/cloud-status', authMiddleware, getCloudStatus);
router.get('/linkedin-status', authMiddleware, getLinkedinStatus);
router.post('/sync-profile', authMiddleware, syncLinkedinProfile);
router.post('/bookmarklet-sync', bookmarkletSync);
router.post('/start-simulation', authMiddleware, startSimulationLogin);
router.post('/submit-2fa', authMiddleware, submitSimulation2FA);

export default router;
