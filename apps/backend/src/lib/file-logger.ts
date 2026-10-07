// Keep the worker's own narrative after the container is gone.
//
// Docker's json-file logs live under the CONTAINER's directory, so `up -d`
// recreating a service deletes them. That happened twice during the 2026-10-01
// investigation: the connect failure was only diagnosable because its detail
// had been persisted into ActionLog first, and the 09:17 send attempt's log was
// lost outright. A deploy is exactly when something has just changed, which is
// exactly when the previous run's output matters most.
//
// So: tee console output to a bind-mounted file as well as stdout. Disabled
// unless LOG_DIR is set, so nothing changes for anyone who has not mounted a
// volume for it.

import fs from 'fs';
import path from 'path';

const MAX_BYTES = Number(process.env.LOG_MAX_BYTES || 200 * 1024 * 1024);
const KEEP_DAYS = Number(process.env.LOG_KEEP_DAYS || 7);

let stream: fs.WriteStream | null = null;
let currentDay = '';
let written = 0;

const today = (): string => new Date().toISOString().slice(0, 10);

function prune(dir: string): void {
    // This box is chronically short of disk — a build has already failed on
    // ENOSPC twice — so retention is enforced, not assumed.
    const cutoff = Date.now() - KEEP_DAYS * 24 * 3600 * 1000;
    for (const f of fs.readdirSync(dir)) {
        if (!/^worker-\d{4}-\d{2}-\d{2}\.log$/.test(f)) continue;
        try {
            const p = path.join(dir, f);
            if (fs.statSync(p).mtimeMs < cutoff) fs.unlinkSync(p);
        } catch { /* a file vanishing under us is fine */ }
    }
}

function open(dir: string): void {
    const day = today();
    if (stream && day === currentDay && written < MAX_BYTES) return;
    try {
        stream?.end();
        fs.mkdirSync(dir, { recursive: true });
        if (day !== currentDay) prune(dir);
        currentDay = day;
        written = 0;
        stream = fs.createWriteStream(path.join(dir, `worker-${day}.log`), { flags: 'a' });
        stream.on('error', () => { stream = null; });
    } catch {
        stream = null;
    }
}

/**
 * Mirror console output into LOG_DIR. Call once, as early as possible.
 * Returns false when LOG_DIR is unset.
 */
export function initFileLogging(): boolean {
    const dir = process.env.LOG_DIR;
    if (!dir) return false;

    for (const level of ['log', 'warn', 'error', 'info'] as const) {
        const original = console[level].bind(console);
        console[level] = (...args: any[]) => {
            original(...args);
            try {
                open(dir);
                if (!stream) return;
                const line = `${new Date().toISOString()} [${level}] ` + args.map((a) => {
                    if (typeof a === 'string') return a;
                    try { return JSON.stringify(a); } catch { return String(a); }
                }).join(' ') + '\n';
                written += Buffer.byteLength(line);
                stream.write(line);
            } catch { /* never let logging break the thing it observes */ }
        };
    }
    return true;
}
