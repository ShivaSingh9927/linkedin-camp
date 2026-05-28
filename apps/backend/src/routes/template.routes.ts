import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.middleware';
import { getTemplates, getTemplateById } from '../campaign-templates';

const router = Router();
router.use(authMiddleware);

// Templates are static, shipped product content — no per-user variation. The
// frontend Templates Hub fetches this once and renders cards. When a user
// picks one, the frontend reads /templates/:id, POSTs to /campaigns with
// {name, workflowJson, objective, description, cta, toneOverride} pulled from
// the template's `workflow` + `aiStrategyHint`.

router.get('/', (_req, res) => {
    const templates = getTemplates().map(({ workflow: _w, ...rest }) => rest);
    res.json({ templates });
});

router.get('/:id', (req, res) => {
    const template = getTemplateById(req.params.id);
    if (!template) return res.status(404).json({ error: 'Template not found' });
    res.json({ template });
});

export default router;
