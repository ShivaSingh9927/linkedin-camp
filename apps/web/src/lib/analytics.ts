import posthog from 'posthog-js';

// Thin wrapper around PostHog so the rest of the app never touches the SDK
// directly and every call is a safe no-op until NEXT_PUBLIC_POSTHOG_KEY is set
// (so local dev / preview without a key tracks nothing and never errors).

export const POSTHOG_KEY = process.env.NEXT_PUBLIC_POSTHOG_KEY || '';
export const POSTHOG_HOST = process.env.NEXT_PUBLIC_POSTHOG_HOST || 'https://us.i.posthog.com';

export const analyticsEnabled = () => !!POSTHOG_KEY && typeof window !== 'undefined';

// Named events for the activation funnel. Using a union keeps call-sites honest
// and the funnel definitions in PostHog stable.
export type AnalyticsEvent =
  | 'signup_completed'
  | 'onboarding_completed'
  | 'onboarding_document_parsed'
  | 'linkedin_connected'
  | 'leads_imported'
  | 'campaign_launched'
  | 'first_reply_received';

export function track(event: AnalyticsEvent, properties?: Record<string, any>) {
  if (!analyticsEnabled()) return;
  posthog.capture(event, properties);
}

// Tie subsequent events + replays to a real account.
export function identifyUser(id: string, traits?: Record<string, any>) {
  if (!analyticsEnabled() || !id) return;
  posthog.identify(id, traits);
}

// On logout — sever the anonymous→identified link so the next user isn't merged.
export function resetAnalytics() {
  if (!analyticsEnabled()) return;
  posthog.reset();
}
