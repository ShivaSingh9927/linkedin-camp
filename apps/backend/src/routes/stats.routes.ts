import { Router } from 'express';
import { getStats } from '../controllers/stats.controller';
import { authMiddleware } from '../middleware/auth.middleware';

const router = Router();
router.get('/', authMiddleware, getStats);

export default router;
