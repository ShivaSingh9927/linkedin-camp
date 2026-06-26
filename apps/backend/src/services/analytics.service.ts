import { PostHog } from 'posthog-node';
import { prisma } from '@repo/db';

// Server-side analytics. Backend captures the events the frontend can't see
// reliably (LinkedIn connect, lead imports, inbound replies). Uses the SAME
// distinctId (the user's id) the web app identifies with, so these merge into
// the same person/funnel in PostHog. No-op until POSTHOG_KEY is set.

const POSTHOG_KEY = process.env.POSTHOG_KEY || process.env.NEXT_PUBLIC_POSTHOG_KEY || '';
const POSTHOG_HOST = process.env.POSTHOG_HOST || 'https://us.i.posthog.com';

const client = POSTHOG_KEY
  ? new PostHog(POSTHOG_KEY, { host: POSTHOG_HOST, flushAt: 1, flushInterval: 5000 })
  : null;

export type ServerEvent =
  | 'linkedin_connected'
  | 'leads_imported'
  | 'first_reply_received';

export function captureEvent(userId: string, event: ServerEvent, properties?: Record<string, any>) {
  if (!client || !userId) return;
  try {
    client.capture({ distinctId: userId, event, properties });
  } catch (e: any) {
    console.error('[ANALYTICS] capture failed:', e?.message);
  }
}

// Fire `first_reply_received` only the first time a user ever gets an inbound
// reply (the activation milestone), not on every synced message. `newCount` is
// how many inbound rows were just written this sync.
export async function captureFirstReply(userId: string, newCount: number) {
  if (!client || !userId || newCount <= 0) return;
  try {
    const total = await prisma.message.count({ where: { userId, direction: 'RECEIVED' } });
    if (total <= newCount) captureEvent(userId, 'first_reply_received');
  } catch (e: any) {
    console.error('[ANALYTICS] first-reply check failed:', e?.message);
  }
}
