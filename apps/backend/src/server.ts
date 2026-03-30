console.log('[BACKEND-INIT] Process starting...');
console.error('[BACKEND-INIT-STDERR] Verification log to stderr');

import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

console.log('[BACKEND-ENV] PORT:', process.env.PORT);

const app = express();
const PORT = process.env.PORT || 3001;

app.get('/health', (req, res) => {
    console.log('[BACKEND-REQ] /health hit');
    res.status(200).json({ status: 'ok', msg: 'Core process is alive' });
});

app.get('/ping', (req, res) => res.send('pong'));

app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

app.use((req, res, next) => {
    if (req.url !== '/health' && req.url !== '/ping') {
        console.log(`[BACKEND-REQ] ${req.method} ${req.url}`);
    }
    next();
});

const serverPort = parseInt(String(PORT), 10);

app.listen(serverPort, '0.0.0.0', () => {
    console.log(`[BACKEND-READY] Listening on 0.0.0.0:${serverPort}`);
    console.log('[BACKEND-BOOT] Proceeding with module loading...');

    const initializeApp = async () => {
        try {
            const { prisma } = await import('@repo/db');
            const authRoutes = (await import('./routes/auth.routes')).default;
            const leadRoutes = (await import('./routes/lead.routes')).default;
            const campaignRoutes = (await import('./routes/campaign.routes')).default;
            const statsRoutes = (await import('./routes/stats.routes')).default;
            const inboxRoutes = (await import('./routes/inbox.routes')).default;
            const teamRoutes = (await import('./routes/team.routes')).default;
            const adminRoutes = (await import('./routes/admin.routes')).default;
            const notificationRoutes = (await import('./routes/notification.routes')).default;
            const integrationRoutes = (await import('./routes/integration.routes')).default;
            const smartListRoutes = (await import('./routes/smart-list.routes')).default;
            const aiRoutes = (await import('./routes/ai.routes')).default;
            const userRoutes = (await import('./routes/user.routes')).default;
            const { initScheduler } = await import('./cron/scheduler');
            const { initWorker } = await import('./workers/linkedin.worker');
            const { initProxyHealthWorker } = await import('./workers/proxy.worker');
            const { downgradeExpiredTrials } = await import('./services/trial.service');
            const { initCampaignWorker, enqueueCampaign } = await import('./workers/campaign-worker');

            app.use('/api/v1/auth', authRoutes);
            app.use('/api/v1/leads', leadRoutes);
            app.use('/api/v1/campaigns', campaignRoutes);
            app.use('/api/v1/stats', statsRoutes);
            app.use('/api/v1/inbox', inboxRoutes);
            app.use('/api/v1/team', teamRoutes);
            app.use('/api/v1/admin', adminRoutes);
            app.use('/api/v1/notifications', notificationRoutes);
            app.use('/api/v1/integrations', integrationRoutes);
            app.use('/api/v1/smart-lists', smartListRoutes);
            app.use('/api/v1/ai', aiRoutes);
            app.use('/api/v1/users', userRoutes);

            initScheduler();

            // TEMPORARY: Kickstart route for testing
            app.get('/api/admin/jumpstart', async (req, res) => {
                const count = await prisma.campaignLead.updateMany({
                   where: { isCompleted: false },
                   data: { nextActionDate: new Date() }
                });
                res.json({ success: true, count });
            });

            // Campaign engine route — enqueue a campaign to the new queue
            app.post('/api/admin/enqueue-campaign', async (req, res) => {
                const { campaignId, delayMs } = req.body;
                if (!campaignId) return res.status(400).json({ error: 'campaignId required' });

                const campaign = await prisma.campaign.findUnique({ where: { id: campaignId } });
                if (!campaign) return res.status(404).json({ error: 'Campaign not found' });

                await enqueueCampaign(campaign.userId, campaignId, delayMs || 0);
                res.json({ success: true, campaignId, queued: true });
            });

            initWorker(); // Required for scheduler to work
            initCampaignWorker();
            initProxyHealthWorker();
            const { initInboxWorker } = await import('./workers/inbox.worker');
            initInboxWorker();
            console.log('[BACKEND-COMPLETE] All background services ready');
        } catch (err) {
            console.error('[BACKEND-FATAL] Failed to load modules:', err);
        }
    };

    initializeApp();
});

export { app };
