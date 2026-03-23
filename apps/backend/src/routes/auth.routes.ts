import express from 'express';
import { Router } from 'express';
import { 
  register, 
  login, 
  syncExtension, 
  getCloudStatus, 
  getLinkedinStatus, 
  syncLinkedinProfile, 
  startLinkedinLogin, 
  heartbeat, 
  bookmarkletSync 
} from '../controllers/auth.controller';
import { 
  startSimulationLogin, 
  submitSimulation2FA 
} from '../controllers/simulation.controller';
import { uploadSessionZip } from '../controllers/sync.controller';
import { authMiddleware } from '../middleware/auth.middleware';
import multer from 'multer';

const upload = multer({ storage: multer.memoryStorage() });
const router = Router();

router.post('/register', register);
router.post('/login', login);
router.post('/sync-extension', authMiddleware, syncExtension);
router.get('/cloud-status', authMiddleware, getCloudStatus);
router.get('/linkedin-status', authMiddleware, getLinkedinStatus);
router.post('/sync-profile', authMiddleware, syncLinkedinProfile);
router.post('/start-login', authMiddleware, startLinkedinLogin);
router.post('/heartbeat', authMiddleware, heartbeat);
router.post('/bookmarklet-sync', authMiddleware, bookmarkletSync);

// Cloud-Native Simulation Routes
router.post('/start-simulation', authMiddleware, startSimulationLogin);
router.post('/submit-2fa', authMiddleware, submitSimulation2FA);

// Local-Sync Upload Route
router.post('/upload-session', authMiddleware, upload.single('sessionZip'), uploadSessionZip);

export default router;
