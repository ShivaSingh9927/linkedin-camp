import './sentry';
import { Sentry } from './sentry';

console.log('[WORKER-INIT] Process starting...');
console.error('[WORKER-INIT-STDERR] Verification log to stderr');

import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

console.log('[WORKER-ENV] NODE_ENV:', process.env.NODE_ENV);
console.log('[WORKER-ENV] REDIS_URL set:', !!process.env.REDIS_URL);

const bootstrap = async () => {
    try {
        const { initScheduler } = await import('./cron/scheduler');
        const { initWorker } = await import('./workers/linkedin.worker');
        const { initCampaignWorker } = await import('./workers/campaign-worker');
        const { initProxyHealthWorker } = await import('./workers/proxy.worker');
        const { initInboxWorker } = await import('./workers/inbox.worker');
        const { initCRMWorker } = await import('./workers/crm.worker');
        const { initEnrichmentWorker } = await import('./workers/enrichment-worker');

        initScheduler();
        initWorker();
        initCampaignWorker();
        initProxyHealthWorker();
        initInboxWorker();
        initCRMWorker();
        initEnrichmentWorker();

        console.log('[WORKER-READY] All background services ready');
    } catch (err) {
        console.error('[WORKER-FATAL] Failed to load modules:', err);
        process.exit(1);
    }
};

bootstrap();

process.on('SIGTERM', () => {
    console.log('[WORKER-SHUTDOWN] SIGTERM received, exiting');
    process.exit(0);
});

process.on('unhandledRejection', (reason) => {
    console.error('[WORKER-UNHANDLED-REJECTION]', reason);
    Sentry.captureException(reason);
});

process.on('uncaughtException', (err) => {
    console.error('[WORKER-UNCAUGHT-EXCEPTION]', err);
    Sentry.captureException(err);
    process.exit(1);
});
