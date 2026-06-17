/**
 * loadtest-voyager-me-probe.ts — does a BROWSER-FREE /me work?
 *
 * Tests the core hypothesis behind lazy browser launch: that a saved LinkedIn
 * session (cookies in the DB, captured by the Chromium login flow) can confirm
 * session validity via the Voyager /me endpoint using a standalone Playwright
 * `request` context — i.e. Node-side APIRequestContext, NO Chromium process —
 * routed through the user's pinned login proxy (sticky-proxy invariant).
 *
 * Prod's working read path already uses page.context().request (the same
 * Node-side HTTP machinery); this just drops the browser. If /me returns 200
 * with plainId, then warmup + session-validation + non-messenger reads can all
 * go browser-free, leaving Chromium only for DOM writes.
 *
 * Run on the worker box (inside the backend container):
 *   PROBE_EMAIL=rajaji98971@gmail.com \
 *     node_modules/.bin/ts-node --skip-project --transpile-only \
 *     /app/loadtest-voyager-me-probe.ts
 *
 * If PROBE_EMAIL is unset, picks the first user that has both a session cookie
 * and a pinned proxy snapshot. Read-only: makes exactly one /me GET. No writes.
 */
// @repo/db's package main is index.ts (unbuildable under standalone ts-node),
// so use the generated client directly.
const { PrismaClient } = require('@prisma/client');
const { request, chromium } = require('patchright');

const CHROME_UA =
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36';

type SameSite = 'Strict' | 'Lax' | 'None';

function normSameSite(v: any): SameSite {
    const s = String(v || '').toLowerCase();
    if (s === 'strict') return 'Strict';
    if (s === 'none' || s === 'no_restriction') return 'None';
    return 'Lax';
}

async function main() {
    const prisma = new PrismaClient();
    const email = process.env.PROBE_EMAIL;

    const user = email
        ? await prisma.user.findUnique({ where: { email } })
        : await prisma.user.findFirst({
              where: { linkedinCookie: { not: null }, linkedinProxySnapshot: { not: undefined } },
          });

    if (!user) {
        console.error(`[PROBE] No user found${email ? ` for ${email}` : ' with a session'}.`);
        process.exit(1);
    }
    console.log(`[PROBE] User: ${user.email} (id=${user.id})`);

    // --- Session cookies from DB ---
    let rawCookies: any[] = [];
    try {
        const parsed = JSON.parse(user.linkedinCookie);
        rawCookies = Array.isArray(parsed) ? parsed : [];
    } catch {
        console.error('[PROBE] linkedinCookie is not a JSON array — cannot probe.');
        process.exit(1);
    }
    const cookies = rawCookies.map((c: any) => ({
        name: c.name,
        value: c.value,
        domain: c.domain || '.linkedin.com',
        path: c.path || '/',
        expires: c.expires != null ? Math.round(Number(c.expires)) : Math.round(Date.now() / 1000) + 86400 * 30,
        httpOnly: !!c.httpOnly,
        secure: c.secure !== false,
        sameSite: normSameSite(c.sameSite),
    }));
    const liAt = cookies.find((c: any) => c.name === 'li_at');
    const jsession = cookies.find((c: any) => c.name === 'JSESSIONID');
    console.log(`[PROBE] cookies=${cookies.length}  li_at=${liAt ? 'yes' : 'NO'}  JSESSIONID=${jsession ? 'yes' : 'NO'}`);
    if (!jsession) {
        console.error('[PROBE] No JSESSIONID — csrf-token cannot be derived. /me will 403.');
    }
    const csrf = jsession ? String(jsession.value).replace(/"/g, '') : '';

    // --- Pinned proxy (sticky-proxy invariant) ---
    const snap: any = user.linkedinProxySnapshot;
    if (!snap || !snap.server) {
        console.error('[PROBE] No linkedinProxySnapshot.server — refusing to egress through a different IP.');
        process.exit(1);
    }
    console.log(`[PROBE] proxy: ${snap.server}`);

    const proxy = { server: snap.server, username: snap.username || undefined, password: snap.password || undefined };
    const headers: Record<string, string> = {
        'accept': 'application/vnd.linkedin.normalized+json+2.1',
        'x-restli-protocol-version': '2.0.0',
        'x-li-lang': 'en_US',
        'user-agent': CHROME_UA,
        ...(csrf ? { 'csrf-token': csrf } : {}),
    };

    const parseMe = (status: number, text: string) => {
        let json: any = null;
        try { json = JSON.parse(text); } catch {}
        const plainId = json?.data?.plainId ?? json?.plainId;
        const ok = status === 200 && !!plainId && json?.data?.status !== 401;
        return { ok, plainId, snippet: text.substring(0, 200) };
    };

    // ── Attempt A: BROWSER-FREE (standalone request context, Chrome UA) ──
    console.log('\n[PROBE] [A] browser-free request.newContext → GET /me ...');
    try {
        const ctx = await request.newContext({
            baseURL: 'https://www.linkedin.com',
            proxy,
            userAgent: CHROME_UA,
            storageState: { cookies, origins: [] },
            extraHTTPHeaders: headers,
        });
        const t0 = Date.now();
        const resp = await ctx.get('/voyager/api/me');
        const r = parseMe(resp.status(), await resp.text());
        console.log(`[PROBE] [A] HTTP ${resp.status()} in ${Date.now() - t0}ms — ${r.ok ? `✅ VALID (plainId=${r.plainId})` : `❌ ${r.snippet}`}`);
        await ctx.dispose().catch(() => {});
    } catch (e: any) {
        console.error(`[PROBE] [A] error: ${e?.message || e}`);
    }

    // ── Attempt B: CONTROL — real Chromium context (no nav), prod-proven path ──
    // Tells stale-session apart from browser-free-client-gap: if B works but A
    // 401s, the session is fine and the gap is the headless client; if B also
    // 401s, the saved session itself is stale.
    console.log('[PROBE] [B] real Chromium context.request → GET /me (control) ...');
    let browser: any;
    try {
        browser = await chromium.launch({
            channel: 'chrome',
            headless: true,
            args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu', '--disable-dev-shm-usage'],
            proxy,
        });
        const bctx = await browser.newContext({ userAgent: CHROME_UA, proxy });
        await bctx.addCookies(cookies);
        const t0 = Date.now();
        const resp = await bctx.request.get('https://www.linkedin.com/voyager/api/me', { headers });
        const r = parseMe(resp.status(), await resp.text());
        console.log(`[PROBE] [B] HTTP ${resp.status()} in ${Date.now() - t0}ms — ${r.ok ? `✅ VALID (plainId=${r.plainId})` : `❌ ${r.snippet}`}`);
    } catch (e: any) {
        console.error(`[PROBE] [B] error: ${e?.message || e}`);
    } finally {
        if (browser) await browser.close().catch(() => {});
        await prisma.$disconnect().catch(() => {});
    }

    console.log('\n[PROBE] Verdict: A✅B✅ → browser-free reads work | A❌B✅ → session ok, headless client gap | A❌B❌ → saved session stale');
    process.exit(0);
}

main().catch(err => { console.error('[PROBE] Fatal:', err); process.exit(1); });
