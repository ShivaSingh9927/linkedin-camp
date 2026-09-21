import { Router } from 'express';
import { generateComment, generateMessage, enhanceReply, replySuggestions } from '../controllers/ai.controller';
import { activationUnderstand, activationRecommendSearch, activationRecommendTemplates, copilotMessage, copilotDraftReply, copilotWebSummary, copilotWebSearch } from '../controllers/activation.controller';
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
router.post('/copilot/message', copilotMessage);
router.post('/copilot/draft-reply', copilotDraftReply);
router.post('/copilot/web-summary', copilotWebSummary);
// Server-side search + summarise in one call (replaces the browser providers).
router.post('/copilot/web-search', copilotWebSearch);

export default router;
