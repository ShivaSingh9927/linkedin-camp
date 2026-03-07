import { Router } from 'express';
import { getNotifications, markAsRead, markAllAsRead } from '../controllers/notification.controller';

const router = Router();

// In a real app, you would add an auth middleware here
// router.use(verifyToken);

router.get('/', getNotifications);
router.post('/mark-read/:notificationId', markAsRead);
router.post('/mark-all-read', markAllAsRead);

export default router;
