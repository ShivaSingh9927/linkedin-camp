/**
 * verify-net — tests for the in-app-browser network helpers.
 *
 * The retry rule has a sharp edge worth pinning: retry TRANSPORT failures, never
 * HTTP errors. LinkedIn allows about three OTP attempts, so silently retrying a
 * rejected code would burn them. axios only sets `response` when the server
 * actually answered, which is the signal these tests lock in.
 *
 * apps/web has no test runner, so this runs standalone (pure functions, no React,
 * no network):
 *
 *   cd apps/web && npx --yes ts-node --skip-project \
 *     --compiler-options '{"module":"commonjs","target":"es2019"}' src/lib/net.verify.ts
 */
import { isNetworkError, withNetworkRetry, detectInAppBrowser, describeError } from './net';

let pass = 0;
let fail = 0;
function check(name: string, actual: any, expected: any) {
    const ok = JSON.stringify(actual) === JSON.stringify(expected);
    if (ok) { pass++; console.log(`  ✅ ${name}`); }
    else { fail++; console.log(`  ❌ ${name}\n       expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`); }
}

// axios-shaped errors
const netErr = () => Object.assign(new Error('Network Error'), { response: undefined });
const httpErr = (status: number, body?: any) =>
    Object.assign(new Error(`Request failed with status code ${status}`), { response: { status, data: body } });

(async () => {
    console.log('\n--- isNetworkError: transport vs server ---');
    check('bare Network Error', isNetworkError(netErr()), true);
    check('400 is NOT a network error', isNetworkError(httpErr(400)), false);
    check('409 (refresh already running) is NOT', isNetworkError(httpErr(409)), false);
    check('500 is NOT — the server did answer', isNetworkError(httpErr(500)), false);
    check('thrown plain Error counts as transport', isNetworkError(new Error('boom')), true);

    console.log('\n--- withNetworkRetry ---');
    {
        let calls = 0;
        const r = await withNetworkRetry(async () => { calls++; return 'ok'; }, 3, 1);
        check('success on first try calls once', [r, calls], ['ok', 1]);
    }
    {
        let calls = 0;
        const r = await withNetworkRetry(async () => {
            calls++;
            if (calls < 3) throw netErr();
            return 'recovered';
        }, 3, 1);
        check('retries transport failures then succeeds', [r, calls], ['recovered', 3]);
    }
    {
        // The critical one: a rejected OTP code must NOT be resubmitted.
        let calls = 0;
        let msg = '';
        try {
            await withNetworkRetry(async () => { calls++; throw httpErr(400, { error: 'bad code' }); }, 3, 1);
        } catch (e: any) { msg = e.response?.data?.error; }
        check('HTTP error is NOT retried (would burn LinkedIn attempts)', [calls, msg], [1, 'bad code']);
    }
    {
        let calls = 0;
        let threw = false;
        try {
            await withNetworkRetry(async () => { calls++; throw netErr(); }, 3, 1);
        } catch { threw = true; }
        check('gives up after the attempt budget and rethrows', [calls, threw], [3, true]);
    }

    console.log('\n--- detectInAppBrowser ---');
    check('WhatsApp', detectInAppBrowser('Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 WhatsApp/2.24'), 'WhatsApp');
    check('LinkedIn app', detectInAppBrowser('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0) LinkedInApp/9.29.0'), 'LinkedIn');
    check('Facebook (FBAN)', detectInAppBrowser('Mozilla/5.0 (iPhone) [FBAN/FBIOS;FBAV/449.0]'), 'Facebook');
    check('Instagram', detectInAppBrowser('Mozilla/5.0 (iPhone) Instagram 302.0.0.23.113'), 'Instagram');
    check('generic Android WebView', detectInAppBrowser('Mozilla/5.0 (Linux; Android 13; wv) Chrome/120'), 'an in-app');
    check('real mobile Safari is NOT flagged',
        detectInAppBrowser('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Version/17.0 Mobile/15E148 Safari/604.1'), null);
    check('desktop Chrome is NOT flagged',
        detectInAppBrowser('Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/148.0.0.0 Safari/537.36'), null);
    check('empty UA', detectInAppBrowser(''), null);

    console.log('\n--- describeError: must be actionable ---');
    check('network error inside WhatsApp names the way out',
        describeError(netErr(), 'fallback', 'WhatsApp'),
        "Couldn't reach the server from WhatsApp's in-app browser. Open this page in Chrome or Safari and try again.");
    check('network error in a real browser stays generic',
        describeError(netErr(), 'fallback', null),
        "Couldn't reach the server. Check your connection and try again.");
    check('server message wins over the webview hint',
        describeError(httpErr(409, { error: 'A login attempt is already running for this account.' }), 'fallback', 'WhatsApp'),
        'A login attempt is already running for this account.');
    check('falls back when the server sent no message',
        describeError(httpErr(500, {}), 'Failed to submit code', null),
        'Request failed with status code 500');

    console.log(`\n${pass} passed, ${fail} failed\n`);
    process.exit(fail === 0 ? 0 : 1);
})();
