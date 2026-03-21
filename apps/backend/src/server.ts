console.log('[BACKEND-INIT] Process starting...');
console.error('[BACKEND-INIT-STDERR] Verification log to stderr');

import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
dotenv.config();

console.log('[BACKEND-ENV] PORT:', process.env.PORT);

// We delay Prisma and heavy imports until AFTER we bind the port
// to ensure Railway considers us "HEALTHY" immediately
const app = express();
const PORT = process.env.PORT || 3001;

// --- 1. EMERGENCY HEALTH CHECKS (Must be first) ---
app.get('/health', (req, res) => {
    console.log('[BACKEND-REQ] /health hit');
    res.status(200).json({ status: 'ok', msg: 'Core process is alive' });
});

app.get('/ping', (req, res) => res.send('pong'));

app.use(cors()); // Permissive for initial debug
app.use(express.json());

// --- 2. START SERVER IMMEDIATELY (Do not block on imports) ---
const serverPort = parseInt(String(PORT), 10);

app.listen(serverPort, '0.0.0.0', () => {
    console.log(`[BACKEND-READY] Listening on 0.0.0.0:${serverPort}`);

    // --- 3. DYNAMIC IMPORTS / BACKGROUND INIT ---
    // We import routes and background services AFTER the server is ready
    // to prevent any sync import logic from blocking the startup
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
            const { initScheduler } = await import('./cron/scheduler');
            const { initWorker } = await import('./workers/linkedin.worker');
            const { initProxyHealthWorker } = await import('./workers/proxy.worker');
            const { downgradeExpiredTrials } = await import('./services/trial.service');

            app.use('/api/v1/auth', authRoutes);
            app.use('/api/v1/leads', leadRoutes);
            app.use('/api/v1/campaigns', campaignRoutes);
            app.use('/api/v1/stats', statsRoutes);
            app.use('/api/v1/inbox', inboxRoutes);
            app.use('/api/v1/team', teamRoutes);
            app.use('/api/v1/admin', adminRoutes);
            app.use('/api/v1/notifications', notificationRoutes);
            app.use('/api/v1/integrations', integrationRoutes);

            initScheduler();

            // TEMPORARY: Kickstart route for testing
            app.get('/api/admin/jumpstart', async (req, res) => {
                const count = await prisma.campaignLead.updateMany({
                   where: { isCompleted: false },
                   data: { nextActionDate: new Date() }
                });
                res.json({ success: true, count });
            });
            initWorker();
            initProxyHealthWorker();
            console.log('[BACKEND-COMPLETE] All background services ready');
        } catch (err) {
            console.error('[BACKEND-FATAL] Failed to load modules:', err);
        }
    };

    initializeApp();
});

export { app };
