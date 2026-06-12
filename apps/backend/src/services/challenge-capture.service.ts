/**
 * challenge-capture.service.ts
 *
 * Archive a live LinkedIn challenge as a reusable test fixture. LinkedIn only
 * serves a real captcha/challenge under its own risk conditions — we can't
 * summon one on demand — so every time we DO hit one in production, we snapshot
 * it (raw HTML + screenshot + meta) so it can later be replayed offline against
 * detectCaptcha() (see scripts/test-captcha-detector.ts, captured/ dir).
 *
 * The worker filesystem is ephemeral, so each artifact is also best-effort
 * uploaded to S3 under debug-screenshots/<userId>/.
 */
import type { Page } from 'patchright';
import fs from 'fs';
import path from 'path';
import { detectCaptcha } from './captcha-solver.service';
import { uploadFileToS3 } from './s3-upload.service';

const STORAGE = process.env.SESSION_STORAGE_PATH || '/app/sessions';

export interface CaptureResult {
    dir: string;
    detected: string | null;
    url: string;
}

/**
 * Snapshot the current page as a challenge scenario. Never throws — capture is
 * always best-effort and must not break the login/recovery flow it runs inside.
 */
export async function captureChallengeScenario(
    page: Page,
    opts: { userId: string; label?: string },
): Promise<CaptureResult | null> {
    try {
        const ts = Date.now();
        const dir = path.join(STORAGE, 'challenges', `${ts}_${opts.userId}`);
        fs.mkdirSync(dir, { recursive: true });

        const url = page.url();

        let html = '';
        try { html = await page.content(); } catch (e: any) { console.warn(`[challenge-capture] content failed: ${e?.message}`); }
        const htmlPath = path.join(dir, 'page.html');
        fs.writeFileSync(htmlPath, html);

        const shotPath = path.join(dir, 'screenshot.png');
        let hasShot = false;
        try { await page.screenshot({ path: shotPath, fullPage: true }); hasShot = true; } catch (e: any) { console.warn(`[challenge-capture] screenshot failed: ${e?.message}`); }

        let detected: string | null = null;
        try { const d = await detectCaptcha(page); detected = d ? d.type : null; } catch {}

        const meta = {
            ts,
            iso: new Date(ts).toISOString(),
            userId: opts.userId,
            label: opts.label || null,
            url,
            detected,
            htmlBytes: html.length,
        };
        const metaPath = path.join(dir, 'meta.json');
        fs.writeFileSync(metaPath, JSON.stringify(meta, null, 2));

        console.log(`[challenge-capture] saved ${dir} detected=${detected || 'none'} url=${url}`);

        // Durable copy — worker FS is ephemeral. Fire-and-forget.
        const base = `challenge_${ts}`;
        uploadFileToS3(htmlPath, opts.userId, `${base}_html`).catch(() => {});
        uploadFileToS3(metaPath, opts.userId, `${base}_meta`).catch(() => {});
        if (hasShot) uploadFileToS3(shotPath, opts.userId, `${base}_png`).catch(() => {});

        return { dir, detected, url };
    } catch (e: any) {
        console.error(`[challenge-capture] failed: ${e?.message}`);
        return null;
    }
}
