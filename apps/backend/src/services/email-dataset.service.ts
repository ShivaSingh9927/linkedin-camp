import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';

/**
 * Confirmed-email dataset capture.
 *
 * Every time Qampi learns a REAL email for a person (LinkedIn contact card,
 * profile bio, or a successfully-sent email), we append one record to the
 * `qampi-user-data` object store. This is an append-only data lake — it never
 * touches the live Postgres DB and is never read on the request path. Its sole
 * purpose is to accumulate a proprietary, real-world corpus we can later use to
 * build / bootstrap the standalone email-finder product's database.
 *
 * Fire-and-forget by design: any failure (S3 down, creds missing) is swallowed
 * so it can never affect a running campaign. Disabled automatically when S3
 * credentials aren't configured (local/dev), so it's a no-op there.
 *
 * Layout (tenant-partitioned, date-bucketed so it's easy to batch-read later):
 *   email-finder-dataset/{userId}/{YYYY}/{MM}/{DD}/{leadId}-{ts}.json
 */

const s3 = new S3Client({
    region: process.env.S3_REGION || 'hel1',
    endpoint: process.env.S3_ENDPOINT || 'https://hel1.your-objectstorage.com',
    credentials: {
        accessKeyId: process.env.S3_ACCESS_KEY || '',
        secretAccessKey: process.env.S3_SECRET_KEY || '',
    },
    forcePathStyle: true,
});

const BUCKET = process.env.S3_BUCKET || 'qampi-user-data';
const PREFIX = 'email-finder-dataset';

export type ConfirmedEmailSource = 'linkedin-contact-card' | 'profile-bio' | 'email-sent';

export interface ConfirmedEmailInput {
    email: string;
    source: ConfirmedEmailSource;
    firstName?: string | null;
    lastName?: string | null;
    company?: string | null;
    jobTitle?: string | null;
    headline?: string | null;
    linkedinUrl?: string | null;
    connectionDegree?: number | null;
    userId?: string | null;
    campaignId?: string | null;
    leadId?: string | null;
}

/**
 * Append one confirmed-email observation to the S3 dataset. Never throws.
 */
export async function recordConfirmedEmail(rec: ConfirmedEmailInput): Promise<void> {
    try {
        // Disabled unless object storage is configured — keeps local/dev a no-op.
        if (!process.env.S3_ACCESS_KEY || !process.env.S3_SECRET_KEY) return;

        const email = (rec.email || '').trim().toLowerCase();
        if (!email || !email.includes('@')) return;
        const domain = email.split('@')[1] || null;

        const now = new Date();
        const yyyy = now.getUTCFullYear();
        const mm = String(now.getUTCMonth() + 1).padStart(2, '0');
        const dd = String(now.getUTCDate()).padStart(2, '0');
        const userSeg = rec.userId || 'unknown';
        const leadSeg = rec.leadId || 'lead';
        const key = `${PREFIX}/${userSeg}/${yyyy}/${mm}/${dd}/${leadSeg}-${now.getTime()}.json`;

        const body = JSON.stringify({
            schemaVersion: 1,
            seenAt: now.toISOString(),
            source: rec.source,
            email,
            domain,
            firstName: rec.firstName ?? null,
            lastName: rec.lastName ?? null,
            company: rec.company ?? null,
            jobTitle: rec.jobTitle ?? null,
            headline: rec.headline ?? null,
            linkedinUrl: rec.linkedinUrl ?? null,
            connectionDegree: rec.connectionDegree ?? null,
            userId: rec.userId ?? null,
            campaignId: rec.campaignId ?? null,
            leadId: rec.leadId ?? null,
        });

        await s3.send(new PutObjectCommand({
            Bucket: BUCKET,
            Key: key,
            Body: body,
            ContentType: 'application/json',
        }));
        console.log(`[email-dataset] recorded ${rec.source} email for ${domain} → s3://${BUCKET}/${key}`);
    } catch (err: any) {
        console.warn(`[email-dataset] capture failed (ignored): ${err?.message}`);
    }
}
