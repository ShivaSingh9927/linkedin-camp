import * as Sentry from '@sentry/node';

if (process.env.SENTRY_DSN) {
    Sentry.init({
        dsn: process.env.SENTRY_DSN,
        environment: process.env.NODE_ENV || 'development',
        tracesSampleRate: 0.05,
        sendDefaultPii: false,
        beforeSend(event) {
            if (event.request?.headers) {
                delete (event.request.headers as any).authorization;
                delete (event.request.headers as any).cookie;
            }
            return event;
        },
    });
    console.log(`[SENTRY] initialized (env=${process.env.NODE_ENV || 'development'})`);
} else {
    console.log('[SENTRY] disabled (no SENTRY_DSN set)');
}

export { Sentry };
