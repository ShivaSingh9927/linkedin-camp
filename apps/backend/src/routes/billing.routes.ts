import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.middleware';
import { getPlans, createCheckout } from '../controllers/billing.controller';

const router = Router();
router.use(authMiddleware);

router.get('/plans', getPlans);
router.post('/checkout', createCheckout);

export default router;
