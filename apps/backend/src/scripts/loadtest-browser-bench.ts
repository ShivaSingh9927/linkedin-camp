/**
 * loadtest-browser-bench.ts — Chromium saturation benchmark.
 *
 * Answers the headline capacity question: how many concurrent Chromium windows
 * can the worker box sustain? Since reads use the Voyager API and only WRITE
 * actions (message/comment/connect/like/follow) need a browser, the count of
 * concurrent windows the box holds === the count of campaigns that can be
 * mid-write-action at the same instant. That is the real ceiling on concurrent
 * active users.
 *
 * It launches real Chromium with the SAME options as the production engine
 * (apps/backend/src/campaign-engine/session-launch.ts) so per-window RAM/CPU
 * matches prod — but loads a locally-served saved LinkedIn profile page, so it
 * NEVER contacts linkedin.com and needs no session or proxy. Safe to run on the
 * prod worker box (do it while the box is otherwise idle for a clean number).
 *
 * Usage (on the worker box, inside the backend container):
 *   npx ts-node --transpile-only src/scripts/loadtest-browser-bench.ts
 *
 * Env knobs:
 *   BENCH_MAX        hard cap on windows to open            (default 40)
 *   BENCH_FLOOR_MB   stop when MemAvailable drops below this (default 1024)
 *   BENCH_HOLD_MS    settle time between launches            (default 1500)
 *   BENCH_HTML       path to the profile HTML to serve
 *                    (default testscripts/_artefacts/<reidhoffman>.html)
 */
import { chromium } from 'patchright';
import * as fs from 'fs';
import * as path from 'path';
import * as http from 'http';
import * as os from 'os';

const MAX = parseInt(process.env.BENCH_MAX || '40', 10);
const FLOOR_MB = parseInt(process.env.BENCH_FLOOR_MB || '1024', 10);
const HOLD_MS = parseInt(process.env.BENCH_HOLD_MS || '1500', 10);
const HTML_PATH =
    process.env.BENCH_HTML ||
    path.resolve(process.cwd(), '../../testscripts/_artefacts/reidhoffman_2026-05-28T16-43-10-748Z.html');

const wait = (ms: number) => new Promise(res => setTimeout(res, ms));

// MemAvailable (MB) from /proc/meminfo — the kernel's best estimate of memory
// available for new processes without swapping. The number that actually
// determines whether the next browser starves the box.
function memAvailableMb(): number {
    try {
        const meminfo = fs.readFileSync('/proc/meminfo', 'utf-8');
        const m = meminfo.match(/MemAvailable:\s+(\d+)\s+kB/);
        if (m) return Math.round(parseInt(m[1], 10) / 1024);
    } catch {}
    // Fallback for non-Linux: os.freemem undercounts (ignores reclaimable cache).
    return Math.round(os.freemem() / 1024 / 1024);
}

function load1(): number {
    return Math.round(os.loadavg()[0] * 100) / 100;
}

async function main() {
    if (!fs.existsSync(HTML_PATH)) {
        console.error(`[BENCH] HTML not found: ${HTML_PATH}\nSet BENCH_HTML to a saved profile page.`);
        process.exit(1);
    }
    const html = fs.readFileSync(HTML_PATH, 'utf-8');
    const cpus = os.cpus().length;

    // Serve the saved page locally so page.goto parses it like a real navigation
    // (realistic DOM cost) without any external network.
    const server = http.createServer((_req, res) => {
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end(html);
    });
    await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
    const port = (server.address() as any).port;
    const url = `http://127.0.0.1:${port}/`;

    // Mirror production launch options (session-launch.ts) minus proxy/session.
    const launchOptions: any = {
        channel: 'chrome',
        headless: true,
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-blink-features=AutomationControlled',
            '--start-maximized',
            '--disable-gpu',
            '--disable-dev-shm-usage',
        ],
    };
    const contextOptions: any = {
        userAgent:
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36',
        viewport: null,
        locale: 'en-IN',
        timezoneId: 'Asia/Kolkata',
    };

    const baseline = memAvailableMb();
    console.log(`[BENCH] Box: ${cpus} cores, MemAvailable baseline ${baseline} MB.`);
    console.log(`[BENCH] Ramping to ${MAX} windows; stop floor ${FLOOR_MB} MB. Serving ${path.basename(HTML_PATH)}.\n`);
    console.log('win\tMemAvail(MB)\tΔtotal(MB)\tavg/win(MB)\tload1');

    const browsers: any[] = [];
    let stoppedReason = `reached BENCH_MAX=${MAX}`;

    for (let i = 1; i <= MAX; i++) {
        try {
            const browser = await chromium.launch(launchOptions);
            const context = await browser.newContext(contextOptions);
            // Same resource-blocking the engine applies — images/media/fonts
            // never matter for DOM writes and dropping them is part of the
            // real per-window cost profile.
            await context.route('**/*', (route: any) => {
                const type = route.request().resourceType();
                if (type === 'image' || type === 'media' || type === 'font') return route.abort();
                return route.continue();
            });
            const page = await context.newPage();
            await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
            browsers.push({ browser, context, page });
        } catch (e: any) {
            stoppedReason = `launch #${i} failed: ${e.message}`;
            break;
        }

        await wait(HOLD_MS); // let RAM settle before sampling

        const avail = memAvailableMb();
        const deltaTotal = baseline - avail;
        const avgPerWin = Math.round(deltaTotal / i);
        console.log(`${i}\t${avail}\t\t${deltaTotal}\t\t${avgPerWin}\t\t${load1()}`);

        if (avail < FLOOR_MB) {
            stoppedReason = `MemAvailable ${avail} MB < floor ${FLOOR_MB} MB`;
            break;
        }
    }

    const held = browsers.length;
    const finalAvail = memAvailableMb();
    console.log(`\n[BENCH] ──────────────────────────────────────────────`);
    console.log(`[BENCH] Stopped: ${stoppedReason}`);
    console.log(`[BENCH] Max concurrent windows held: ${held}`);
    console.log(`[BENCH] Avg RAM per window: ${held ? Math.round((baseline - finalAvail) / held) : 0} MB`);
    console.log(`[BENCH] MemAvailable: ${baseline} → ${finalAvail} MB  (load1 ${load1()}, ${cpus} cores)`);
    console.log(`[BENCH] Safe concurrent windows ≈ ${held} (keeping ${FLOOR_MB} MB headroom).`);
    console.log(`[BENCH] Current WORKER_CONCURRENCY default is 6 — compare against the above.`);

    console.log(`\n[BENCH] Tearing down ${held} browsers...`);
    for (const b of browsers) {
        await b.context.close().catch(() => {});
        await b.browser.close().catch(() => {});
    }
    server.close();
    console.log('[BENCH] Done.');
    process.exit(0);
}

main().catch(err => {
    console.error('[BENCH] Fatal:', err);
    process.exit(1);
});
