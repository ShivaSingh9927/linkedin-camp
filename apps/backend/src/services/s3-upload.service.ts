import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import type { Page } from 'playwright-core';
import fs from 'fs';
import path from 'path';

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

export interface UploadResult {
    key: string;
    url: string;
}

export async function uploadScreenshotToS3(
    page: Page,
    userId: string,
    label: string,
): Promise<UploadResult | null> {
    try {
        const buf = await page.screenshot({ fullPage: true });
        if (!buf) return null;

        const ts = Date.now();
        const key = `debug-screenshots/${userId}/${label}_${ts}.png`;

        await s3.send(new PutObjectCommand({
            Bucket: BUCKET,
            Key: key,
            Body: buf,
            ContentType: 'image/png',
        }));

        const url = `https://${BUCKET}.${(process.env.S3_ENDPOINT || '').replace('https://', '')}/${key}`;
        console.log(`[s3-upload] screenshot saved: s3://${BUCKET}/${key}`);
        return { key, url };
    } catch (err: any) {
        console.error(`[s3-upload] failed: ${err.message}`);
        return null;
    }
}

export async function uploadFileToS3(filePath: string, userId: string, label: string): Promise<UploadResult | null> {
    try {
        if (!fs.existsSync(filePath)) return null;

        const ts = Date.now();
        const ext = path.extname(filePath) || '.png';
        const key = `debug-screenshots/${userId}/${label}_${ts}${ext}`;

        await s3.send(new PutObjectCommand({
            Bucket: BUCKET,
            Key: key,
            Body: fs.readFileSync(filePath),
            ContentType: ext === '.png' ? 'image/png' : 'application/octet-stream',
        }));

        console.log(`[s3-upload] file saved: s3://${BUCKET}/${key}`);
        return { key, url: `https://${BUCKET}.${(process.env.S3_ENDPOINT || '').replace('https://', '')}/${key}` };
    } catch (err: any) {
        console.error(`[s3-upload] file upload failed: ${err.message}`);
        return null;
    }
}
