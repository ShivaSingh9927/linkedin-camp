import { Router } from 'express';
import { register, login, syncExtension, getCloudStatus, getLinkedinStatus, syncLinkedinProfile, startLinkedinLogin, heartbeat } from '../controllers/auth.controller';
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

export default router;
