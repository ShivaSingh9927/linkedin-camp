/**
 * test-captcha-detector.ts
 *
 * Offline unit test for captcha-solver.service `detectCaptcha()`. Loads HTML
 * fixtures into a real (patchright) page and asserts the detector returns the
 * right vendor + sitekey/publicKey — proving the detection + key-extraction
 * wiring without spending a CapSolver call or touching LinkedIn.
 *
 * Two fixture sources:
 *   1. test-fixtures/captcha/synthetic/  — committed, ground-truth via manifest.json.
 *      A mismatch here FAILS the run (exit 1).
 *   2. test-fixtures/captcha/captured/   — real challenges archived in prod by
 *      challenge-capture.service (page.html files). No ground truth, so these are
 *      INFORMATIONAL: we print what the detector saw. Drop a saved scenario here
 *      to confirm the live detector still recognizes LinkedIn's current widget.
 *
 * Run:  npx ts-node src/scripts/test-captcha-detector.ts
 */
import { chromium } from 'patchright';
import type { Browser, Page } from 'patchright';
import fs from 'fs';
import path from 'path';
import { detectCaptcha } from '../services/captcha-solver.service';

const FIXTURE_ROOT = path.resolve(__dirname, '../../test-fixtures/captcha');
const SYNTHETIC_DIR = path.join(FIXTURE_ROOT, 'synthetic');
const CAPTURED_DIR = path.join(FIXTURE_ROOT, 'captured');

interface Case {
    file: string;
    type: string | null;
    key?: string;
    keyField?: 'websiteKey' | 'publicKey';
    apiSubdomain?: string;
}

async function loadFixture(page: Page, html: string): Promise<void> {
    // domcontentloaded (not 'load') so inline scripts run but aborted external
    // sub-resources (iframe/script src) don't stall the wait.
    await page.setContent(html, { waitUntil: 'domcontentloaded' });
}

async function runSynthetic(page: Page): Promise<{ pass: number; fail: number }> {
    const manifestPath = path.join(SYNTHETIC_DIR, 'manifest.json');
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8')) as { cases: Case[] };

    let pass = 0;
    let fail = 0;

    for (const c of manifest.cases) {
        const html = fs.readFileSync(path.join(SYNTHETIC_DIR, c.file), 'utf8');
        await loadFixture(page, html);
        const d = await detectCaptcha(page);

        const errors: string[] = [];

        if (c.type === null) {
            if (d !== null) errors.push(`expected no detection, got type=${d.type}`);
        } else {
            if (!d) {
                errors.push(`expected type=${c.type}, got null`);
            } else {
                if (d.type !== c.type) errors.push(`type: expected ${c.type}, got ${d.type}`);
                if (c.key && c.keyField) {
                    const got = (d as any)[c.keyField];
                    if (got !== c.key) errors.push(`${c.keyField}: expected ${c.key}, got ${got}`);
                }
                if (c.apiSubdomain && (d as any).apiSubdomain !== c.apiSubdomain) {
                    errors.push(`apiSubdomain: expected ${c.apiSubdomain}, got ${(d as any).apiSubdomain}`);
                }
            }
        }

        if (errors.length === 0) {
            pass++;
            console.log(`  ✅ ${c.file} → ${d ? d.type : 'none'}`);
        } else {
            fail++;
            console.log(`  ❌ ${c.file}\n       ${errors.join('\n       ')}`);
        }
    }

    return { pass, fail };
}

async function runCaptured(page: Page): Promise<void> {
    if (!fs.existsSync(CAPTURED_DIR)) {
        console.log('  (no captured/ dir — skip. Real prod captures land here.)');
        return;
    }
    // Accept either flat *.html or per-scenario subdirs containing page.html.
    const htmlFiles: string[] = [];
    for (const entry of fs.readdirSync(CAPTURED_DIR)) {
        const full = path.join(CAPTURED_DIR, entry);
        if (fs.statSync(full).isDirectory()) {
            const inner = path.join(full, 'page.html');
            if (fs.existsSync(inner)) htmlFiles.push(inner);
        } else if (entry.endsWith('.html')) {
            htmlFiles.push(full);
        }
    }
    if (htmlFiles.length === 0) {
        console.log('  (captured/ is empty — drop a saved page.html here to test the live widget.)');
        return;
    }
    for (const f of htmlFiles) {
        const html = fs.readFileSync(f, 'utf8');
        await loadFixture(page, html);
        const d = await detectCaptcha(page);
        const rel = path.relative(CAPTURED_DIR, f);
        console.log(`  ℹ️  ${rel} → ${d ? `${d.type} (${d.websiteKey || d.publicKey || 'no-key'})` : 'NONE — manual/unknown challenge'}`);
    }
}

async function main(): Promise<void> {
    let browser: Browser | null = null;
    let exitCode = 0;
    try {
        browser = await chromium.launch({ headless: true, channel: 'chrome', args: ['--no-sandbox'] });
        const context = await browser.newContext();
        // Detectors only read element attributes — never iframe content — so block
        // all sub-resource loads to keep the test fast and fully offline.
        await context.route('**', (route) => route.abort().catch(() => {}));
        const page = await context.newPage();

        console.log('\n=== Synthetic fixtures (ground truth — failures break the build) ===');
        const { pass, fail } = await runSynthetic(page);

        console.log('\n=== Captured real challenges (informational) ===');
        await runCaptured(page);

        console.log(`\n=== Result: ${pass} passed, ${fail} failed ===\n`);
        if (fail > 0) exitCode = 1;
    } catch (err: any) {
        console.error(`[test-captcha-detector] fatal: ${err?.stack || err?.message}`);
        exitCode = 1;
    } finally {
        if (browser) await browser.close().catch(() => {});
    }
    process.exit(exitCode);
}

main();
