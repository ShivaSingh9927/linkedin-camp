/**
 * One-shot probe for the email-finder box and the domain cache.
 *
 * Usage (run from apps/backend):
 *   npx ts-node scripts/probe-email-finder.ts probe                       # GET /health
 *   npx ts-node scripts/probe-email-finder.ts domain "Acme, Inc."        # read cache entry
 *   npx ts-node scripts/probe-email-finder.ts domain-warm "Acme"          # resolve + cache (no SMTP verify)
 *   npx ts-node scripts/probe-email-finder.ts cache-stats                 # count + sample keys
 *   npx ts-node scripts/probe-email-finder.ts cache-clear                 # delete all entries
 *
 * Reads EMAIL_FINDER_URL / EMAIL_FINDER_TOKEN / REDIS_URL from the repo's .env.
 */

import axios from 'axios';
import * as dotenv from 'dotenv';
import * as path from 'path';
import Redis from 'ioredis';

dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

const URL = process.env.EMAIL_FINDER_URL || 'http://localhost:8002';
const TOKEN = process.env.EMAIL_FINDER_TOKEN || '';
const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';
const KEY_PREFIX = 'ef:domain:';

function fmt(o: any) { return JSON.stringify(o, null, 2); }

async function cmdProbe() {
    const t0 = Date.now();
    try {
        const r = await axios.get(`${URL}/health`, {
            timeout: 3000,
            validateStatus: () => true,
        });
        const ms = Date.now() - t0;
        const status = r.status === 200 ? 'HEALTHY' : 'DEGRADED';
        console.log(`probe: HTTP ${r.status} in ${ms}ms — ${status}`);
        console.log(`body: ${fmt(r.data)}`);
    } catch (e: any) {
        console.log(`probe: ERROR in ${Date.now() - t0}ms — ${e?.message || e}`);
    }
}

async function cmdDomain(company: string) {
    if (!company) { console.log('usage: domain "<company>"'); return; }
    const r = new Redis(REDIS_URL, { lazyConnect: true, maxRetriesPerRequest: 1 });
    try { await r.connect(); } catch (e: any) { console.log(`redis connect failed: ${e.message}`); return; }
    const key = `${KEY_PREFIX}${company.toLowerCase().replace(/[,.|;:'"]/g, ' ').replace(/\s+(inc|llc|ltd|corp|gmbh|co|plc|pty)\.?$/i, '').replace(/\s+/g, ' ').trim()}`;
    const raw = await r.get(key);
    if (!raw) {
        console.log(`(no cache entry)`);
        console.log(`key: ${key}`);
    } else {
        console.log(`key: ${key}`);
        console.log(`value: ${fmt(JSON.parse(raw))}`);
    }
    await r.quit();
}

async function cmdDomainWarm(company: string) {
    if (!company) { console.log('usage: domain-warm "<company>"'); return; }
    if (!TOKEN) { console.log('EMAIL_FINDER_TOKEN not set'); return; }
    try {
        const t0 = Date.now();
        const r = await axios.post(`${URL}/email-finder/resolve-domain`,
            { company },
            { headers: { 'X-API-Key': TOKEN, 'Content-Type': 'application/json' }, timeout: 30_000 });
        const ms = Date.now() - t0;
        const data = r.data;
        if (data?.domain) {
            const r2 = new Redis(REDIS_URL, { lazyConnect: true, maxRetriesPerRequest: 1 });
            await r2.connect();
            const key = `${KEY_PREFIX}${company.toLowerCase().replace(/[,.|;:'"]/g, ' ').replace(/\s+(inc|llc|ltd|corp|gmbh|co|plc|pty)\.?$/i, '').replace(/\s+/g, ' ').trim()}`;
            const value = { domain: data.domain, confidence: data.confidence, method: data.method, cachedAt: Date.now() };
            await r2.set(key, JSON.stringify(value), 'EX', 7 * 24 * 60 * 60);
            console.log(`warmed: ${company} → ${data.domain} (method=${data.method}, conf=${data.confidence}) in ${ms}ms`);
            console.log(`key: ${key}`);
            await r2.quit();
        } else {
            console.log(`box returned no domain for "${company}" in ${ms}ms — not caching`);
            console.log(`body: ${fmt(data)}`);
        }
    } catch (e: any) {
        console.log(`resolve failed: ${e?.message || e}`);
    }
}

async function cmdCacheStats() {
    const r = new Redis(REDIS_URL, { lazyConnect: true, maxRetriesPerRequest: 1 });
    try { await r.connect(); } catch (e: any) { console.log(`redis connect failed: ${e.message}`); return; }
    const keys = await r.keys(`${KEY_PREFIX}*`);
    console.log(`entries: ${keys.length}`);
    const sample = keys.slice(0, 5);
    for (const k of sample) {
        const raw = await r.get(k);
        const v = raw ? JSON.parse(raw) : null;
        const ttl = await r.ttl(k);
        console.log(`  ${k}  (ttl=${ttl}s)  ${fmt(v)}`);
    }
    if (keys.length > sample.length) console.log(`  ... and ${keys.length - sample.length} more`);
    await r.quit();
}

async function cmdCacheClear() {
    const r = new Redis(REDIS_URL, { lazyConnect: true, maxRetriesPerRequest: 1 });
    try { await r.connect(); } catch (e: any) { console.log(`redis connect failed: ${e.message}`); return; }
    const keys = await r.keys(`${KEY_PREFIX}*`);
    if (keys.length) await r.del(...keys);
    console.log(`cleared ${keys.length} entries`);
    await r.quit();
}

async function main() {
    const cmd = process.argv[2] || 'help';
    switch (cmd) {
        case 'probe':         await cmdProbe(); break;
        case 'domain':        await cmdDomain(process.argv[3]); break;
        case 'domain-warm':   await cmdDomainWarm(process.argv[3]); break;
        case 'cache-stats':   await cmdCacheStats(); break;
        case 'cache-clear':   await cmdCacheClear(); break;
        default:
            console.log('usage:');
            console.log('  probe                       GET /health against the box');
            console.log('  domain "<company>"          read a cache entry');
            console.log('  domain-warm "<company>"     resolve + write to cache (no SMTP verify)');
            console.log('  cache-stats                 count + sample keys');
            console.log('  cache-clear                 delete all entries');
    }
    process.exit(0);
}

main().catch((e) => { console.error(e); process.exit(1); });
