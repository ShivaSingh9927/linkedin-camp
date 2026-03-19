console.log('[DEBUG-START] server.ts is loading...');

import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
dotenv.config();

console.log('[DEBUG-CONFIG] Env loaded. PORT:', process.env.PORT);

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
import { initProxyHealthWorker } from './workers/proxy.worker';
import { downgradeExpiredTrials } from './services/trial.service';

const app = express();
const PORT = process.env.PORT || 3001;

// --- 1. HEALTH CHECKS ---
app.get('/health', (req, res) => {
    console.log('[DEBUG-HEALTH] Health check request received.');
    res.json({
        status: 'ok',
        message: 'Backend is alive',
        timestamp: new Date().toISOString(),
        version: '1.0.1'
    });
});

app.get('/ping', (req, res) => {
    console.log('[DEBUG-PING] Ping request received.');
    res.send('pong');
});

console.log('[DEBUG-CORS] Setting up CORS...');
app.use(cors({
    origin: (origin, callback) => {
        if (!origin) return callback(null, true);
        const allowedPatterns = [
            'vercel.app',
            'localhost',
            'chrome-extension://',
            'railway.app'
        ];
        const isAllowed = allowedPatterns.some(pattern => origin.includes(pattern));
        if (isAllowed) {
            callback(null, true);
        } else {
            console.log(`[CORS] Blocked origin: ${origin}`);
            callback(new Error('Not allowed by CORS'));
        }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json());

app.use((req, res, next) => {
    console.log(`[DEBUG-REQUEST] ${req.method} ${req.url}`);
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
const serverPort = parseInt(String(PORT), 10) || 3001;
console.log(`[DEBUG-LISTEN] Attempting to listen on 0.0.0.0:${serverPort}...`);

app.listen(serverPort, '0.0.0.0', () => {
    console.log(`🚀 API Server listening on 0.0.0.0:${serverPort} [${new Date().toISOString()}]`);

    console.log('[DEBUG-BG] Initializing background services...');
    try {
        initScheduler();
        initWorker();
        initProxyHealthWorker();
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
