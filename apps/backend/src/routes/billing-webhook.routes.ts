import { Router } from 'express';
import { razorpayWebhook } from '../controllers/billing.controller';

// Provider webhooks are called by Razorpay's servers — NO authMiddleware.
// Authenticity is proven by the HMAC signature, not a bearer token. Mounted at
// /api/webhooks/razorpay BEFORE the auth'd /api/webhooks router so it isn't
// swallowed by that prefix.
const router = Router();

router.post('/', razorpayWebhook);

export default router;
