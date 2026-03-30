import { Router } from 'express';
import { generateComment, generateMessage, enhanceReply } from '../controllers/ai.controller';
import { authMiddleware } from '../middleware/auth.middleware';

const router = Router();

router.use(authMiddleware);

router.post('/comment', generateComment);
router.post('/message', generateMessage);
router.post('/enhance', enhanceReply);

export default router;
