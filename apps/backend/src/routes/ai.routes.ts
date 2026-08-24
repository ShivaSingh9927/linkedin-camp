import { Router } from 'express';
import { generateComment, generateMessage, enhanceReply, replySuggestions } from '../controllers/ai.controller';
import { activationUnderstand, activationRecommendSearch, activationRecommendTemplates } from '../controllers/activation.controller';
import { authMiddleware } from '../middleware/auth.middleware';

const router = Router();

router.use(authMiddleware);

router.post('/comment', generateComment);
router.post('/message', generateMessage);
router.post('/enhance', enhanceReply);
router.post('/reply-suggestions', replySuggestions);

// Activation copilot
router.post('/activation/understand', activationUnderstand);
router.post('/activation/recommend-search', activationRecommendSearch);
router.post('/activation/recommend-templates', activationRecommendTemplates);

export default router;
