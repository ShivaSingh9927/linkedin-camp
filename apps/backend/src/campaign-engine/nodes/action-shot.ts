import { uploadScreenshotToS3 } from '../../services/s3-upload.service';

/**
 * Before/after screenshots around a write action, for diagnosing actions that
 * report one thing and do another.
 *
 * Logs alone could not explain why rajaji's likes and comments never appeared:
 * the click happened, the selectors matched, and nothing errored. A picture of
 * the page immediately before and after the click shows what the logs cannot —
 * a restriction banner, a disabled control, a modal that swallowed the click,
 * or a button that simply never changed state.
 *
 * Opt-in via ACTION_SHOTS=1. Every capture is a full-page screenshot plus an S3
 * PUT, which is far too much to do on every action in normal operation, so this
 * stays off unless someone is actively investigating.
 */
export function actionShotsEnabled(): boolean {
    return process.env.ACTION_SHOTS === '1';
}

export async function actionShot(
    page: any,
    userId: string,
    label: string,
): Promise<void> {
    if (!actionShotsEnabled()) return;
    try {
        const res = await uploadScreenshotToS3(page, userId, label);
        if (res) console.log(`[ACTION-SHOT] ${label} → ${res.key}`);
    } catch (e: any) {
        // Diagnostics must never break the action they are observing.
        console.log(`[ACTION-SHOT] ${label} failed: ${e?.message}`);
    }
}
