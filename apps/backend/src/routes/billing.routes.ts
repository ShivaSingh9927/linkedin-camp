import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.middleware';
import { getPlans, createCheckout, getSubscription, cancelBilling } from '../controllers/billing.controller';

const router = Router();
router.use(authMiddleware);

router.get('/plans', getPlans);
router.get('/subscription', getSubscription);
router.post('/checkout', createCheckout);
router.post('/cancel', cancelBilling);

export default router;
