import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
dotenv.config();
import { prisma } from '@repo/db';
import authRoutes from './routes/auth.routes';
import leadRoutes from './routes/lead.routes';
import campaignRoutes from './routes/campaign.routes';
import inboxRoutes from './routes/inbox.routes';
import teamRoutes from './routes/team.routes';
import statsRoutes from './routes/stats.routes';
import adminRoutes from './routes/admin.routes';
import notificationRoutes from './routes/notification.routes';
import integrationRoutes from './routes/integration.routes';
import { initScheduler } from './cron/scheduler';
import { initWorker } from './workers/linkedin.worker';
import { downgradeExpiredTrials } from './services/trial.service';


const app = express();
const PORT = process.env.PORT || 3001;

// --- 1. PRE-FLIGHT / HEALTH (Must be fast) ---
app.get('/health', (req, res) => {
    res.json({ status: 'ok', message: 'Backend is alive' });
});

app.get('/ping', (req, res) => res.send('pong'));

app.use((req, res, next) => {
    const origin = req.headers.origin;

    // Allow our specific Vercel domain, localhost, and ANY chrome-extension
    if (origin && (
        origin.includes('vercel.app') ||
        origin.includes('localhost') ||
        origin.startsWith('chrome-extension://')
    )) {
        res.setHeader('Access-Control-Allow-Origin', origin);
        res.setHeader('Access-Control-Allow-Credentials', 'true');
    }

    res.setHeader('Access-Control-Allow-Private-Network', 'true');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    // Handle Preflight
    if (req.method === 'OPTIONS') {
        return res.status(204).end();
    }

    next();
});
app.use(express.json());

// Request logging middleware
app.use((req, res, next) => {
    console.log(`${req.method} ${req.url}`);
    next();
});

app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/leads', leadRoutes);
app.use('/api/v1/campaigns', campaignRoutes);
app.use('/api/v1/stats', statsRoutes);
app.use('/api/v1/inbox', inboxRoutes);
app.use('/api/v1/team', teamRoutes);
app.use('/api/v1/admin', adminRoutes);
app.use('/api/v1/notifications', notificationRoutes);
app.use('/api/v1/integrations', integrationRoutes);

app.get('/', (req, res) => {
    res.json({ message: 'LinkedIn Campaign Engine API is running', version: '1.0.0' });
});

// --- 2. START SERVER IMMEDIATELY ---
app.listen(Number(PORT), '0.0.0.0', () => {
    console.log(`🚀 LEADMATE Server listening on port ${PORT} [${new Date().toISOString()}]`);
    console.log('Build Version: 1.0.6 - Database Diagnostic');
    console.log('DATABASE_URL is set:', !!process.env.DATABASE_URL);

    // --- 3. ASYNC BACKGROUND INIT (Does not block port binding) ---
    console.log('Initializing background services...');

    // Diagnostic: Check actual DB columns
    prisma.$queryRaw`SELECT column_name FROM information_schema.columns WHERE table_name = 'User'`
        .then((cols: any) => {
            console.log('📊 Actual User table columns in DB:', cols.map((c: any) => c.column_name).join(', '));
            const hasField = cols.some((c: any) => c.column_name === 'maxInviteLimit');
            if (!hasField) {
                console.error('❌ CRITICAL: maxInviteLimit is MISSING from the database! Schema sync failed.');
            } else {
                console.log('✅ Found maxInviteLimit in DB.');
            }
        })
        .catch(e => console.error('❌ Failed to query DB columns:', e));

    try {
        initScheduler();
        initWorker();
        console.log('✅ Campaign Engine Initialized');
    } catch (e) {
        console.error('❌ Failed to init Campaign Engine:', e);
    }

    downgradeExpiredTrials().catch(e => console.error("Error running immediate trial downgrade:", e));

    setInterval(() => {
        downgradeExpiredTrials().catch(e => console.error("Error in trial downgrade cron:", e));
    }, 60 * 60 * 1000); // 1 hour
});

export { app, prisma };
