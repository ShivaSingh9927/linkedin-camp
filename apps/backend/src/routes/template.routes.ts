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
    // Ship a compact step sequence (node subTypes, in graph order minus START)
    // so the gallery card can render a real mini-flow preview without the full
    // workflow payload. The detail page still fetches the complete graph.
    const templates = getTemplates().map(({ workflow, ...rest }) => ({
        ...rest,
        stepSequence: (workflow?.nodes ?? [])
            .filter((n) => n.subType !== 'START')
            .map((n) => n.subType),
    }));
    res.json({ templates });
});

router.get('/:id', (req, res) => {
    const template = getTemplateById(req.params.id);
    if (!template) return res.status(404).json({ error: 'Template not found' });
    res.json({ template });
});

export default router;
