import { Router } from 'express';
import { generateComment, generateMessage, enhanceReply, replySuggestions } from '../controllers/ai.controller';
import { authMiddleware } from '../middleware/auth.middleware';

const router = Router();

router.use(authMiddleware);

router.post('/comment', generateComment);
router.post('/message', generateMessage);
router.post('/enhance', enhanceReply);
router.post('/reply-suggestions', replySuggestions);

export default router;
