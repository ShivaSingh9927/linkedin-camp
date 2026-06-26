import { Router } from 'express';
import {
  googleLogin,
  getCloudStatus,
  getLinkedinStatus,
  syncLinkedinProfile,
  startLinkedinLogin,
  heartbeat,
} from '../controllers/auth.controller';
import { oauthStart, oauthCallback } from '../controllers/social-auth.controller';
import { authMiddleware } from '../middleware/auth.middleware';

const router = Router();

// Social-only auth. Google uses client-side one-tap; Microsoft/LinkedIn use the
// generic OIDC redirect flow. Email/password sign-in has been removed.
router.post('/google', googleLogin);
router.get('/oauth/:provider/start', oauthStart);
router.get('/oauth/:provider/callback', oauthCallback);
router.get('/cloud-status', authMiddleware, getCloudStatus);
router.get('/linkedin-status', authMiddleware, getLinkedinStatus);
router.post('/sync-profile', authMiddleware, syncLinkedinProfile);
router.post('/start-login', authMiddleware, startLinkedinLogin);
router.post('/heartbeat', authMiddleware, heartbeat);

export default router;
