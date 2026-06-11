import { Router } from 'express';
import { authMiddleware, AuthRequest } from '../middleware/auth.middleware';
import { strategyService } from '../services/strategy.service';

const router = Router();
router.use(authMiddleware);

router.post('/generate', async (req: AuthRequest, res) => {
  const userId = req.user!.id;
  const { trigger, force_regenerate } = req.body;

  // Strategy generation runs a 6-agent pipeline that takes ~2 minutes —
  // longer than the Hetzner LB 50s idle timeout. Return 202 immediately
  // and emit the result to the user's Socket.IO room when done.
  // Same async pattern as POST /session/submit-credentials.
  strategyService
    .generateStrategy(userId, trigger || 'manual', force_regenerate || false)
    .then(async (strategy) => {
      const { io } = await import('../socket');
      io.to(`user_${userId}`).emit('STRATEGY_GENERATED', { success: true, strategy });
    })
    .catch(async (error: any) => {
      console.error('[STRATEGY] Generate error:', error.message);
      const { io } = await import('../socket');
      const status = error.message?.includes('Rate limit exceeded') ? 'rate_limited' : 'failed';
      io.to(`user_${userId}`).emit('STRATEGY_GENERATED', { success: false, status, error: error.message });
    });

  res.status(202).json({
    accepted: true,
    message: 'Strategy generation started. Watch STRATEGY_GENERATED over Socket.IO for the result.',
  });
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

router.post('/edit-pillar', async (req: AuthRequest, res) => {
  try {
    const { instruction, pillar_name, pillar_angle } = req.body;
    if (!instruction || !pillar_name || !pillar_angle) {
      res.status(400).json({ error: 'instruction, pillar_name, and pillar_angle are required' });
      return;
    }
    const result = await strategyService.editPillar(req.user!.id, instruction, pillar_name, pillar_angle);
    res.json(result);
  } catch (error: any) {
    console.error('[STRATEGY] Edit pillar error:', error.message);
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

router.post('/edit-comment-style', async (req: AuthRequest, res) => {
  try {
    const { instruction } = req.body;
    if (!instruction) {
      res.status(400).json({ error: 'instruction is required' });
      return;
    }
    const result = await strategyService.editCommentStyle(req.user!.id, instruction);
    res.json(result);
  } catch (error: any) {
    console.error('[STRATEGY] Edit comment style error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

router.get('/comment-instruction', async (req: AuthRequest, res) => {
  try {
    const result = await strategyService.getCommentInstruction(req.user!.id);
    res.json(result);
  } catch (error: any) {
    console.error('[STRATEGY] Get comment instruction error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

router.put('/comment-instruction', async (req: AuthRequest, res) => {
  try {
    const { instruction } = req.body;
    const result = await strategyService.setCommentInstruction(req.user!.id, instruction || '');
    res.json(result);
  } catch (error: any) {
    console.error('[STRATEGY] Set comment instruction error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

export default router;
