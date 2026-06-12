/**
 * captcha-solver.service.ts
 *
 * Type-aware CapSolver wrapper. The flow is deliberately two-stage:
 *
 *   1. detectCaptcha(page) — inspect the DOM for a KNOWN, solvable captcha and
 *      return a descriptor (vendor + sitekey/publicKey). Returns null when the
 *      page has no captcha we can solve (e.g. a phone / authenticator-app
 *      challenge). This is the GATE: we only ever spend a CapSolver call (paid,
 *      ~10–120s) when a captcha is actually present and recognized.
 *
 *   2. solveCaptcha(page, descriptor) — build the matching CapSolver task from
 *      a small registry, poll for the token, inject it the way that vendor
 *      expects, and submit.
 *
 * Adding a new captcha type later is a one-entry change in DETECTORS +
 * TASK_BUILDERS + injectToken — not a rewrite. Today LinkedIn's login
 * challenges are almost always reCAPTCHA v2 or Arkose/FunCaptcha; the other
 * vendors are detected and dispatched too, with their injection paths marked
 * where they need a live sample to harden.
 *
 * CapSolver task-type reference: https://docs.capsolver.com/
 */
import type { Page } from 'patchright';

const CAPSOLVER_BASE = process.env.CAPSOLVER_BASE_URL || 'https://api.capsolver.com';
const wait = (ms: number) => new Promise((res) => setTimeout(res, ms));

export type CaptchaType =
    | 'recaptcha_v2'
    | 'recaptcha_v3'
    | 'hcaptcha'
    | 'funcaptcha'   // Arkose Labs — LinkedIn's common press-and-hold puzzle
    | 'image_to_text';

export interface CaptchaDescriptor {
    type: CaptchaType;
    websiteURL: string;
    websiteKey?: string;   // reCAPTCHA / hCaptcha sitekey
    publicKey?: string;    // FunCaptcha / Arkose public key
    apiSubdomain?: string; // FunCaptcha enforcement subdomain (surl host)
    isInvisible?: boolean; // reCAPTCHA v2 invisible variant
    pageAction?: string;   // reCAPTCHA v3 action
    imageBase64?: string;  // image_to_text payload
}

// ---- Detection ------------------------------------------------------------
// Each detector returns a descriptor if its vendor is present, else null.
// Order matters only for pages that (rarely) embed more than one — we prefer
// the interactive vendors LinkedIn actually uses.

type Detector = (page: Page, websiteURL: string) => Promise<CaptchaDescriptor | null>;

const detectRecaptchaV2: Detector = async (page, websiteURL) => {
    const frame = await page
        .$('iframe[src*="recaptcha/api2/anchor"], iframe[src*="recaptcha/anchor"], iframe[src*="recaptcha/enterprise/anchor"], iframe[src*="recaptcha/fallback"]')
        .catch(() => null);
    if (!frame) return null;
    const src = (await frame.getAttribute('src').catch(() => '')) || '';
    const websiteKey = src.match(/[?&]k=([^&]+)/)?.[1];
    if (!websiteKey) return null;
    return { type: 'recaptcha_v2', websiteURL, websiteKey, isInvisible: /size=invisible/.test(src) };
};

const detectHcaptcha: Detector = async (page, websiteURL) => {
    const frame = await page.$('iframe[src*="hcaptcha.com"]').catch(() => null);
    if (!frame) return null;
    const src = (await frame.getAttribute('src').catch(() => '')) || '';
    const websiteKey =
        src.match(/[?&]sitekey=([^&]+)/)?.[1] ||
        (await page.$eval('[data-sitekey]', (el: Element) => el.getAttribute('data-sitekey')).catch(() => null)) ||
        undefined;
    if (!websiteKey) return null;
    return { type: 'hcaptcha', websiteURL, websiteKey };
};

const detectFuncaptcha: Detector = async (page, websiteURL) => {
    const frame = await page
        .$('iframe[src*="arkoselabs.com"], iframe[src*="funcaptcha.com"], iframe[id*="arkose"], #arkose-iframe, #funcaptcha')
        .catch(() => null);
    if (!frame) return null;
    const src = (await frame.getAttribute('src').catch(() => '')) || '';
    const publicKey =
        src.match(/[?&]pk=([^&]+)/)?.[1] ||
        (await page
            .$eval('[data-pkey], [data-public-key]', (el: Element) => el.getAttribute('data-pkey') || el.getAttribute('data-public-key'))
            .catch(() => null)) ||
        undefined;
    if (!publicKey) return null;
    // The enforcement subdomain (e.g. "client-api.arkoselabs.com") improves the
    // CapSolver solve rate; pull it from the iframe src host when available.
    const apiSubdomain = src.match(/https?:\/\/([^/]+)/)?.[1];
    return { type: 'funcaptcha', websiteURL, publicKey, apiSubdomain };
};

const detectRecaptchaV3: Detector = async (page, websiteURL) => {
    // v3 has no visible widget: grecaptcha is present but there's no checkbox
    // anchor. Distinguish from v2 by the absence of the checkbox element.
    const isV3 = await page
        .evaluate(() => !!(window as any).grecaptcha && !document.querySelector('.recaptcha-checkbox, iframe[src*="recaptcha/api2/anchor"]'))
        .catch(() => false);
    if (!isV3) return null;
    const websiteKey =
        (await page.$eval('[data-sitekey]', (el: Element) => el.getAttribute('data-sitekey')).catch(() => null)) ||
        (await page.content().catch(() => '')).match(/render=([0-9A-Za-z_-]{30,})/)?.[1] ||
        undefined;
    if (!websiteKey) return null;
    return { type: 'recaptcha_v3', websiteURL, websiteKey, pageAction: 'login' };
};

const DETECTORS: Detector[] = [detectRecaptchaV2, detectFuncaptcha, detectHcaptcha, detectRecaptchaV3];

/**
 * Inspect the page for a known, solvable captcha. Returns null when there's
 * nothing CapSolver can do (the caller should treat that as "manual challenge"
 * and leave the account RESTRICTED for the user). Cheap — a few selector reads.
 */
export async function detectCaptcha(page: Page): Promise<CaptchaDescriptor | null> {
    const websiteURL = page.url();
    for (const detect of DETECTORS) {
        const d = await detect(page, websiteURL).catch(() => null);
        if (d) return d;
    }
    return null;
}

// ---- Task building --------------------------------------------------------
// ProxyLess tasks: CapSolver solves from its own IP. For sitekey-based captchas
// (reCAPTCHA / hCaptcha / FunCaptcha) the solver IP doesn't need to match ours —
// the token is bound to the sitekey + page, not the IP.

const TASK_BUILDERS: Record<CaptchaType, (d: CaptchaDescriptor) => Record<string, any> | null> = {
    recaptcha_v2: (d) => ({
        type: 'ReCaptchaV2TaskProxyLess',
        websiteURL: d.websiteURL,
        websiteKey: d.websiteKey,
        isInvisible: !!d.isInvisible,
    }),
    recaptcha_v3: (d) => ({
        type: 'ReCaptchaV3TaskProxyLess',
        websiteURL: d.websiteURL,
        websiteKey: d.websiteKey,
        pageAction: d.pageAction || 'login',
    }),
    hcaptcha: (d) => ({
        type: 'HCaptchaTaskProxyLess',
        websiteURL: d.websiteURL,
        websiteKey: d.websiteKey,
    }),
    funcaptcha: (d) =>
        d.publicKey
            ? {
                  type: 'FunCaptchaTaskProxyLess',
                  websiteURL: d.websiteURL,
                  websitePublicKey: d.publicKey,
                  ...(d.apiSubdomain ? { funcaptchaApiJSSubdomain: d.apiSubdomain } : {}),
              }
            : null,
    image_to_text: (d) => (d.imageBase64 ? { type: 'ImageToTextTask', body: d.imageBase64 } : null),
};

// CapSolver returns the answer under different solution keys per vendor.
function extractToken(type: CaptchaType, solution: any): string {
    if (!solution) return '';
    switch (type) {
        case 'funcaptcha':
            return solution.token || '';
        case 'image_to_text':
            return solution.text || '';
        case 'recaptcha_v2':
        case 'recaptcha_v3':
        case 'hcaptcha':
        default:
            return solution.gRecaptchaResponse || solution.token || '';
    }
}

// ---- Token injection ------------------------------------------------------
// Drop the solved token into the field the page's JS reads, then fire the
// input/change events frameworks listen for.

async function injectToken(page: Page, type: CaptchaType, token: string): Promise<void> {
    await page.evaluate(
        ({ type, token }: { type: CaptchaType; token: string }) => {
            const fire = (el: Element | null) => {
                if (!el) return;
                (el as HTMLInputElement | HTMLTextAreaElement).value = token;
                (el as HTMLElement).textContent = token;
                el.dispatchEvent(new Event('input', { bubbles: true }));
                el.dispatchEvent(new Event('change', { bubbles: true }));
            };

            if (type === 'recaptcha_v2' || type === 'recaptcha_v3') {
                document.querySelectorAll('textarea#g-recaptcha-response, textarea[name="g-recaptcha-response"]').forEach(fire);
            } else if (type === 'hcaptcha') {
                document.querySelectorAll('textarea[name="h-captcha-response"], textarea[name="g-recaptcha-response"], #h-captcha-response').forEach(fire);
            } else if (type === 'funcaptcha') {
                // Arkose surfaces the verification token on a hidden field whose
                // name varies by integration. Hit the common ones; the host page
                // JS reads whichever it created.
                document
                    .querySelectorAll('input[name="fc-token"], #FunCaptcha-Token, input[name="verification-token"], input[name="arkose-token"]')
                    .forEach(fire);
            }
            // image_to_text answers are typed into a visible field by the caller.
        },
        { type, token }
    );
}

// ---- Public API -----------------------------------------------------------

export interface SolveResult {
    solved: boolean;
    type?: CaptchaType;
    reason?: 'no_captcha' | 'no_api_key' | 'unsupported' | 'create_failed' | 'timeout' | 'task_failed';
}

/**
 * Detect-then-solve. Returns solved:false with a reason (and NO CapSolver spend)
 * when there's no recognized captcha on the page. On success the token is
 * injected; the CALLER is responsible for clicking submit + re-classifying,
 * since the submit affordance differs per challenge page.
 */
export async function tryCapsolver(page: Page): Promise<SolveResult> {
    const apiKey = process.env.CAPSOLVER_API_KEY;
    if (!apiKey) {
        console.warn('[capsolver] CAPSOLVER_API_KEY not set — skipping');
        return { solved: false, reason: 'no_api_key' };
    }

    const descriptor = await detectCaptcha(page);
    if (!descriptor) {
        // No solvable captcha — likely a phone / app-prompt challenge. Don't
        // spend a CapSolver call; let the caller leave the account RESTRICTED.
        console.log('[capsolver] no recognized captcha on page — not calling CapSolver');
        return { solved: false, reason: 'no_captcha' };
    }

    const build = TASK_BUILDERS[descriptor.type];
    const task = build ? build(descriptor) : null;
    if (!task) {
        console.warn(`[capsolver] detected ${descriptor.type} but no task builder/params — skipping`);
        return { solved: false, type: descriptor.type, reason: 'unsupported' };
    }

    console.log(`[capsolver] solving type=${descriptor.type} url=${descriptor.websiteURL}`);

    const createRes = await fetch(`${CAPSOLVER_BASE}/createTask`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientKey: apiKey, task }),
    }).catch((e) => {
        console.error(`[capsolver] createTask network error: ${e?.message}`);
        return null;
    });
    const createData: any = createRes ? await createRes.json().catch(() => null) : null;
    if (!createData?.taskId) {
        console.error(`[capsolver] createTask failed: ${createData?.errorDescription || 'unknown'}`);
        return { solved: false, type: descriptor.type, reason: 'create_failed' };
    }

    const taskId = createData.taskId;
    let solution: any = null;
    for (let i = 0; i < 60; i++) {
        await wait(2000);
        const pollRes = await fetch(`${CAPSOLVER_BASE}/getTaskResult`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ clientKey: apiKey, taskId }),
        }).catch(() => null);
        const pollData: any = pollRes ? await pollRes.json().catch(() => null) : null;
        if (pollData?.status === 'ready') { solution = pollData.solution; break; }
        if (pollData?.status === 'failed') {
            console.error(`[capsolver] task failed: ${JSON.stringify(pollData)}`);
            return { solved: false, type: descriptor.type, reason: 'task_failed' };
        }
    }

    const token = extractToken(descriptor.type, solution);
    if (!token) {
        console.error('[capsolver] timeout — no token returned');
        return { solved: false, type: descriptor.type, reason: 'timeout' };
    }

    await injectToken(page, descriptor.type, token);
    await wait(1500);
    console.log(`[capsolver] injected ${descriptor.type} token`);
    return { solved: true, type: descriptor.type };
}
