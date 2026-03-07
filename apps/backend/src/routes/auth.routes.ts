import { Router } from 'express';
import { register, login, syncExtension, getCloudStatus } from '../controllers/auth.controller';
import { authMiddleware } from '../middleware/auth';

const router = Router();

router.post('/register', register);
router.post('/login', login);
router.post('/extension-sync', authMiddleware, syncExtension);
router.get('/cloud-status', authMiddleware, getCloudStatus);

export default router;
