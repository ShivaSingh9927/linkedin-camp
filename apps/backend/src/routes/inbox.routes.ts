import { Router } from 'express';
import {
    getConversations,
    getMessages,
    sendMessage,
    bulkLogMessages,
    getTemplates,
    createTemplate,
    updateTemplate,
    deleteTemplate,
    getNotifications,
    markNotificationsRead,
} from '../controllers/inbox.controller';
import { authMiddleware } from '../middleware/auth';

const router = Router();

router.use(authMiddleware);

// Conversations
router.get('/conversations', getConversations);
router.get('/conversations/:leadId', getMessages);
router.post('/conversations/:leadId/messages', sendMessage);
router.post('/messages/bulk', bulkLogMessages);

// Templates
router.get('/templates', getTemplates);
router.post('/templates', createTemplate);
router.put('/templates/:id', updateTemplate);
router.delete('/templates/:id', deleteTemplate);

// Notifications
router.get('/notifications', getNotifications);
router.post('/notifications/read', markNotificationsRead);

export default router;
