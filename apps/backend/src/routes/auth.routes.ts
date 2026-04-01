import express from 'express';
import { Router } from 'express';
import { 
  register, 
  login, 
  googleLogin,
  syncExtension, 
  getCloudStatus, 
  getLinkedinStatus, 
  syncLinkedinProfile, 
  startLinkedinLogin, 
  heartbeat, 
  bookmarkletSync,
  cloudLogin 
} from '../controllers/auth.controller';
import { 
  startSimulationLogin, 
  submitSimulation2FA,
  startPhase1PersistentSync
} from '../controllers/simulation.controller';
import { uploadSessionZip } from '../controllers/sync.controller';
import { authMiddleware } from '../middleware/auth.middleware';
import multer from 'multer';

const upload = multer({ storage: multer.memoryStorage() });
const router = Router();

router.post('/register', register);
router.post('/login', login);
router.post('/google', googleLogin);
router.post('/sync-extension', authMiddleware, syncExtension);
router.get('/cloud-status', authMiddleware, getCloudStatus);
router.get('/linkedin-status', authMiddleware, getLinkedinStatus);
router.post('/sync-profile', authMiddleware, syncLinkedinProfile);
router.post('/start-login', authMiddleware, startLinkedinLogin);
router.post('/heartbeat', authMiddleware, heartbeat);
router.post('/bookmarklet-sync', authMiddleware, bookmarkletSync);
router.get('/cloud-login', authMiddleware, cloudLogin);

// Cloud-Native Simulation Routes
router.post('/start-simulation', authMiddleware, startSimulationLogin);
router.post('/submit-2fa', authMiddleware, submitSimulation2FA);
router.post('/start-phase1-sync', authMiddleware, startPhase1PersistentSync);

// Local-Sync Upload Route
router.post('/upload-session', authMiddleware, upload.single('sessionZip'), uploadSessionZip);

export default router;
