import { Router } from 'express';
import {
  register,
  login,
  googleLogin,
  getCloudStatus,
  getLinkedinStatus,
  syncLinkedinProfile,
  startLinkedinLogin,
  heartbeat,
  syncExtension,
} from '../controllers/auth.controller';
import { authMiddleware } from '../middleware/auth.middleware';

const router = Router();

router.post('/register', register);
router.post('/login', login);
router.post('/google', googleLogin);
router.get('/cloud-status', authMiddleware, getCloudStatus);
router.get('/linkedin-status', authMiddleware, getLinkedinStatus);
router.post('/sync-profile', authMiddleware, syncLinkedinProfile);
router.post('/start-login', authMiddleware, startLinkedinLogin);
router.post('/heartbeat', authMiddleware, heartbeat);
router.post('/sync-extension', authMiddleware, syncExtension);

export default router;
