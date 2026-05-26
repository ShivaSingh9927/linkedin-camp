import { Router } from 'express';
import { authMiddleware, AuthRequest } from '../middleware/auth.middleware';
import { strategyService } from '../services/strategy.service';

const router = Router();
router.use(authMiddleware);

router.post('/generate', async (req: AuthRequest, res) => {
  try {
    const { trigger, force_regenerate } = req.body;
    const strategy = await strategyService.generateStrategy(
      req.user!.id,
      trigger || 'manual',
      force_regenerate || false
    );
    res.json({ success: true, strategy });
  } catch (error: any) {
    console.error('[STRATEGY] Generate error:', error.message);
    // Rate limit errors should return 429
    if (error.message.includes('Rate limit exceeded')) {
      res.status(429).json({ error: error.message });
    } else {
      res.status(500).json({ error: error.message });
    }
  }
});

router.get('/', async (req: AuthRequest, res) => {
  try {
    const result = await strategyService.getStrategy(req.user!.id);
    res.json(result);
  } catch (error: any) {
    console.error('[STRATEGY] Get error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

router.put('/', async (req: AuthRequest, res) => {
  try {
    const { overrides } = req.body;
    const strategy = await strategyService.updateStrategy(req.user!.id, overrides);
    res.json({ success: true, strategy });
  } catch (error: any) {
    console.error('[STRATEGY] Update error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

router.get('/history', async (req: AuthRequest, res) => {
  try {
    const history = await strategyService.getHistory(req.user!.id);
    res.json(history);
  } catch (error: any) {
    console.error('[STRATEGY] History error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

router.post('/rollback', async (req: AuthRequest, res) => {
  try {
    const { version } = req.body;
    const strategy = await strategyService.rollback(req.user!.id, version);
    res.json({ success: true, strategy });
  } catch (error: any) {
    console.error('[STRATEGY] Rollback error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

router.get('/context', async (req: AuthRequest, res) => {
  try {
    const context = await strategyService.getUserContext(req.user!.id);
    res.json(context);
  } catch (error: any) {
    console.error('[STRATEGY] Context error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

export default router;
