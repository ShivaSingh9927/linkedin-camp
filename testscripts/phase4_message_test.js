/**
 * phase4_message_test.js
 *
 * Drives phase2_cookie_message.js under two modes for both saved accounts,
 * to answer: is concurrent WRITE activity on a shared dedicated ISP safe?
 *
 *   Mode 1 — SEQUENTIAL: raja sends, ~30s gap, snehlata sends.
 *   Mode 2 — PARALLEL:   raja + snehlata fire simultaneously.
 *
 *   node testscripts/phase4_message_test.js sequential
 *   node testscripts/phase4_message_test.js parallel
 *   node testscripts/phase4_message_test.js both     (default)
 */

const { spawn } = require('child_process');
const path = require('path');

const ACCOUNTS = ['raja', 'snehlata'];
const SCRIPT = path.join(__dirname, 'phase2_cookie_message.js');

const wait = (ms) => new Promise(r => setTimeout(r, ms));

function runOne(label) {
    return new Promise(resolve => {
        const child = spawn('node', [SCRIPT], {
            env: { ...process.env, ACCOUNT_LABEL: label, HEADLESS: 'true' },
            stdio: ['ignore', 'pipe', 'pipe'],
        });

        let stdout = '', stderr = '';
        child.stdout.on('data', d => { stdout += d; process.stdout.write(`[${label}] ${d}`); });
        child.stderr.on('data', d => { stderr += d; process.stderr.write(`[${label}] ${d}`); });
        child.on('close', code => {
            // Last printed line of the FINAL JSON RESULT block is what we want.
            const jsonMatch = stdout.match(/\{"label":[^\n]*\}/g);
            let parsed = null;
            if (jsonMatch && jsonMatch.length) {
                try { parsed = JSON.parse(jsonMatch[jsonMatch.length - 1]); } catch {}
            }
            resolve({ label, code, parsed });
        });
    });
}

async function sequential() {
    console.log('\n══════ MODE: SEQUENTIAL ══════');
    const results = [];
    for (const label of ACCOUNTS) {
        const t0 = Date.now();
        const r = await runOne(label);
        r.elapsedMs = Date.now() - t0;
        results.push(r);
        if (label !== ACCOUNTS[ACCOUNTS.length - 1]) {
            const gap = 30000;
            console.log(`\n--- gap: ${gap/1000}s before next account ---\n`);
            await wait(gap);
        }
    }
    return results;
}

async function parallel() {
    console.log('\n══════ MODE: PARALLEL ══════');
    const t0 = Date.now();
    const results = await Promise.all(ACCOUNTS.map(label =>
        runOne(label).then(r => ({ ...r, elapsedMs: Date.now() - t0 }))
    ));
    return results;
}

function summary(title, results) {
    console.log(`\n══════ ${title} SUMMARY ══════`);
    for (const r of results) {
        const p = r.parsed || {};
        const status = p.success ? '✅ SUCCESS' :
                       p.error   ? `❌ ERROR (${p.reason || p.error})` :
                                   '❌ NO RESULT';
        console.log(`  ${r.label.padEnd(12)} ${status.padEnd(40)} elapsed=${r.elapsedMs}ms`);
    }
}

async function main() {
    const mode = process.argv[2] || 'both';

    if (mode === 'sequential' || mode === 'both') {
        const r = await sequential();
        summary('SEQUENTIAL', r);
    }

    if (mode === 'both') {
        console.log('\n--- 60s cool-down before PARALLEL run ---\n');
        await wait(60000);
    }

    if (mode === 'parallel' || mode === 'both') {
        const r = await parallel();
        summary('PARALLEL', r);
    }
}

main().catch(err => { console.error('FATAL:', err); process.exit(1); });
