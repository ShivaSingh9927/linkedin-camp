/**
 * Network-failure helpers for flows that must survive in-app browsers.
 *
 * Extracted from OtpRecoveryModal so the logic is testable without React, and
 * reusable by any other flow that breaks the same way (LinkedInConnectivity does
 * its own raw fetch and has the same exposure).
 */

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

/**
 * A transport failure — the request never got an answer.
 *
 * axios sets `response` whenever the server replied, so its ABSENCE is what
 * separates "the network ate it" from "the server said no". That distinction is
 * the whole point: retrying a dropped request is right, retrying a 400 "bad
 * code" just burns one of LinkedIn's three attempts.
 */
export const isNetworkError = (e: any): boolean => !e?.response;

/**
 * Retry only transport failures, with a short backoff.
 *
 * Users hit this in in-app browsers (WhatsApp / LinkedIn webviews), where the
 * OTP POST fails with a bare Network Error and the code never reaches the relay.
 * Previously that was terminal — one flaky request killed the whole recovery,
 * and the user's natural response (start over) used to spawn a second concurrent
 * login. The backend now collapses those retries onto one attempt, so retrying
 * here is safe.
 */
export async function withNetworkRetry<T>(
    fn: () => Promise<T>,
    attempts = 3,
    backoffMs = 600,
): Promise<T> {
    let lastErr: any;
    for (let i = 0; i < attempts; i++) {
        try {
            return await fn();
        } catch (e: any) {
            lastErr = e;
            if (!isNetworkError(e) || i === attempts - 1) throw e;
            await sleep(backoffMs * (i + 1));
        }
    }
    throw lastErr;
}

/**
 * Are we inside an app's embedded browser rather than a real one?
 *
 * These webviews are where the OTP submit fails, so it's worth telling the user
 * plainly instead of leaving them guessing at "Network Error". Detection is
 * best-effort UA sniffing — it only drives an advisory hint, never blocks
 * anything, so a false positive costs nothing.
 */
export function detectInAppBrowser(ua: string): string | null {
    if (!ua) return null;
    if (/FBAN|FBAV|FB_IAB/i.test(ua)) return 'Facebook';
    if (/Instagram/i.test(ua)) return 'Instagram';
    if (/WhatsApp/i.test(ua)) return 'WhatsApp';
    if (/LinkedInApp/i.test(ua)) return 'LinkedIn';
    if (/Snapchat/i.test(ua)) return 'Snapchat';
    if (/\bLine\//i.test(ua)) return 'LINE';
    if (/Twitter/i.test(ua)) return 'X';
    // Generic Android WebView: "; wv)" is the marker Chrome adds when embedded.
    if (/;\s*wv\)/i.test(ua)) return 'an in-app';
    return null;
}

/**
 * Turn a request failure into something the user can act on.
 *
 * "Network Error" is what an in-app browser produces here, and on its own it
 * tells the user nothing — they retry in the same webview and fail identically.
 * Naming the browser and the way out is the actual fix for that loop.
 */
export function describeError(e: any, fallback: string, inAppBrowser: string | null): string {
    if (isNetworkError(e)) {
        return inAppBrowser
            ? `Couldn't reach the server from ${inAppBrowser}'s in-app browser. Open this page in Chrome or Safari and try again.`
            : "Couldn't reach the server. Check your connection and try again.";
    }
    return e?.response?.data?.error || e?.message || fallback;
}
