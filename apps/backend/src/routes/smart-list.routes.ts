import { Router } from 'express';
import {
    getSmartLists,
    createSmartList,
    deleteSmartList
} from '../controllers/smart-list.controller';
import { authMiddleware } from '../middleware/auth.middleware';

const router = Router();

router.use(authMiddleware);

router.get('/', getSmartLists);
router.post('/', createSmartList);
router.delete('/:id', deleteSmartList);

export default router;
