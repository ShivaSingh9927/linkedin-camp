import './sentry';
import { Sentry } from './sentry';

console.log('[BACKEND-INIT] Process starting...');
console.error('[BACKEND-INIT-STDERR] Verification log to stderr');

import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import Redis from 'ioredis';
import { prisma } from '@repo/db';
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

console.log('[BACKEND-ENV] PORT:', process.env.PORT);

const app = express();
const PORT = process.env.PORT || 3001;

// Behind the Hetzner LB which sets X-Forwarded-For. Without this, express-rate-limit
// refuses to key off the client IP and falls back to a noisy warning.
app.set('trust proxy', 1);

const healthRedis = process.env.REDIS_URL
    ? new Redis(process.env.REDIS_URL, { lazyConnect: true, maxRetriesPerRequest: 1, connectTimeout: 1500 })
    : null;

app.get('/health', async (_req, res) => {
    const checks: Record<string, string> = {};
    let allOk = true;

    try {
        await Promise.race([
            prisma.$queryRaw`SELECT 1`,
            new Promise((_, rej) => setTimeout(() => rej(new Error('db timeout')), 2000)),
        ]);
        checks.db = 'ok';
    } catch (e: any) {
        checks.db = `fail: ${e.message}`;
        allOk = false;
    }

    if (healthRedis) {
        try {
            if (healthRedis.status === 'wait' || healthRedis.status === 'end') await healthRedis.connect();
            const pong = await Promise.race([
                healthRedis.ping(),
                new Promise<string>((_, rej) => setTimeout(() => rej(new Error('redis timeout')), 2000)),
            ]);
            checks.redis = pong === 'PONG' ? 'ok' : `unexpected: ${pong}`;
            if (pong !== 'PONG') allOk = false;
        } catch (e: any) {
            checks.redis = `fail: ${e.message}`;
            allOk = false;
        }
    } else {
        checks.redis = 'not configured';
    }

    res.status(allOk ? 200 : 503).json({ status: allOk ? 'ok' : 'degraded', checks });
});

app.get('/ping', (_req, res) => res.send('pong'));

const allowedOrigins = (process.env.CORS_ORIGIN || 'https://app.qampi.com,https://qampi.com,https://www.qampi.com')
    .split(',').map(s => s.trim()).filter(Boolean);
app.use(cors({
    origin: (origin, callback) => {
        // Same-origin / curl / health checks have no Origin header — allow.
        if (!origin) return callback(null, true);
        if (allowedOrigins.includes(origin)) return callback(null, true);
        // The Qampi Chrome extension (AutoConnect) POSTs scraped leads to
        // /api/v1/leads/import from a chrome-extension:// origin. Allow the
        // extension scheme — every endpoint still requires a valid JWT.
        if (origin.startsWith('chrome-extension://')) return callback(null, true);
        return callback(new Error(`CORS: origin ${origin} not allowed`));
    },
    credentials: true,
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Fix doubled /api/v1/api/v1/ prefix from Chrome extension bug
app.use((req, res, next) => {
    if (req.url.startsWith('/api/v1/api/v1/')) {
        req.url = req.url.replace('/api/v1/api/v1/', '/api/v1/');
        console.log(`[URL-FIX] Rewrote doubled prefix → ${req.url}`);
    }
    next();
});

app.use((req, res, next) => {
    if (req.url !== '/health' && req.url !== '/ping') {
        console.log(`[BACKEND-REQ] ${req.method} ${req.url}`);
    }
    next();
});

const serverPort = parseInt(String(PORT), 10);

const httpServer = app.listen(serverPort, '0.0.0.0', () => {
    console.log(`[BACKEND-READY] Listening on 0.0.0.0:${serverPort}`);
    console.log('[BACKEND-BOOT] Proceeding with module loading...');

    // Attach Socket.IO to the same HTTP server so /api/v1/strategy/generate and
    // /api/v1/session/submit-credentials can emit room events when their
    // fire-and-forget work completes. Without this `io` stays undefined and
    // `io.to(...).emit(...)` throws an unhandled rejection.
    import('./socket').then(({ initSocket }) => {
        initSocket(httpServer);
        console.log('[BACKEND-SOCKET] Socket.IO attached');
    }).catch(err => console.error('[BACKEND-SOCKET] init failed:', err));

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
            const sessionRoutes = (await import('./routes/session.routes')).default;
            const strategyRoutes = (await import('./routes/strategy.routes')).default;
            const templateRoutes = (await import('./routes/template.routes')).default;
            const safetyRoutes = (await import('./routes/safety.routes')).default;
            const webhookRoutes = (await import('./routes/webhook.routes')).default;
            const emailAccountRoutes = (await import('./routes/email-account.routes')).default;
            const oauthRoutes = (await import('./routes/oauth.routes')).default;
            const voyagerRoutes = (await import('./routes/voyager.routes')).default;
            const { downgradeExpiredTrials } = await import('./services/trial.service');
            const { default: rateLimit } = await import('express-rate-limit');

            // Throttle auth endpoints to slow credential-stuffing / brute-force.
            // 10 requests per IP per 15-minute window — generous for real users,
            // tight for bots. Counts both successful and failed responses.
            const authLimiter = rateLimit({
                windowMs: 15 * 60 * 1000,
                // Tight in production to slow credential-stuffing; generous in
                // dev so local testing (repeated signups/logins) doesn't lock you out.
                limit: process.env.NODE_ENV === 'production' ? 10 : 1000,
                standardHeaders: 'draft-7',
                legacyHeaders: false,
                message: { error: 'Too many requests. Try again in 15 minutes.' },
            });
            app.use('/api/v1/auth', authLimiter, authRoutes);
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
            app.use('/api/v1/session', sessionRoutes);
            app.use('/api/v1/strategy', strategyRoutes);
            app.use('/api/v1/templates', templateRoutes);
            app.use('/api/v1/safety', safetyRoutes);
            app.use('/api/v1/email-account', emailAccountRoutes);
            app.use('/api/v1/oauth', oauthRoutes);
            app.use('/api/v1/voyager', voyagerRoutes);
            app.use('/api/webhooks', webhookRoutes);

            // Sentry error handler must come after all routes
            app.use((err: any, _req: any, res: any, _next: any) => {
                Sentry.captureException(err);
                console.error('[BACKEND-ERROR]', err);
                res.status(err.status || 500).json({ error: err.message || 'Internal server error' });
            });

            console.log('[BACKEND-COMPLETE] API routes ready (workers run in separate process)');
        } catch (err) {
            console.error('[BACKEND-FATAL] Failed to load modules:', err);
        }
    };

    initializeApp();
});

export { app };
