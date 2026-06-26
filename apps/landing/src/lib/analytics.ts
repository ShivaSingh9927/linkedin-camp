import posthog from 'posthog-js';

// PostHog wrapper for the marketing site (qampi.com). Same project key as the
// app (app.qampi.com) so visits + signups land in ONE project and PostHog can
// stitch a single person across both subdomains. No-op until the key is set.

export const POSTHOG_KEY = process.env.NEXT_PUBLIC_POSTHOG_KEY || '';
export const POSTHOG_HOST = process.env.NEXT_PUBLIC_POSTHOG_HOST || 'https://us.i.posthog.com';

export const analyticsEnabled = () => !!POSTHOG_KEY && typeof window !== 'undefined';

export function track(event: string, properties?: Record<string, any>) {
  if (!analyticsEnabled()) return;
  posthog.capture(event, properties);
}
