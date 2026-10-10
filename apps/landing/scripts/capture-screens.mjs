// Captures the product screenshots used on qampi.com (public/screens/*.png)
// from a locally running app, signed in as a fictional demo account.
//
// Prereqs (all local): the `backend-api` and `web` entries in
// .claude/launch.json running (API on :3001 against the throwaway
// qampi_landing_demo DB, web app on :3000).
//
//   node apps/landing/scripts/capture-screens.mjs            # all shots
//   node apps/landing/scripts/capture-screens.mjs inbox      # just one
//
// The demo account is seeded at the start and deleted at the end, so it
// never sits in a database a campaign worker could pick up.
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { mkdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const require = createRequire(path.join(ROOT, 'package.json'));
const { chromium } = require('playwright');

const WEB = 'http://localhost:3000';
const OUT = path.join(ROOT, 'apps/landing/public/screens');
const BACKEND = path.join(ROOT, 'apps/backend');

const demoDbUrl = readFileSync(path.join(ROOT, '.env'), 'utf8')
    .match(/^DATABASE_URL=(.*)$/m)[1]
    .replace(/"/g, '')
    .replace('/linkedin_camp?', '/qampi_landing_demo?');

const seedCmd = (cmd) =>
    execFileSync('npx', ['ts-node', '--transpile-only', 'src/scripts/seed-landing-demo.ts', cmd], {
        cwd: BACKEND,
        env: { ...process.env, DATABASE_URL: demoDbUrl },
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'ignore'],
    }).trim().split('\n').pop();

// Each shot: a route, an optional interaction, and what to wait for.
const SHOTS = {
    dashboard: { url: '/', ready: 'text=Sales leaders — Series A SaaS' },
    prospects: { url: '/prospects', ready: 'text=Sarah' },
    campaigns: { url: '/campaigns', ready: 'text=Founder network warm-up' },
    profile: {
        url: '/settings/ai-profile',
        ready: 'text=You target',
        // The overview is an LLM read-back from the AI service, which isn't
        // part of this local setup. Answer that one call with the read-back
        // the seeded (fictional) Relaypoint profile describes.
        route: ['**/strategy/understand', {
            summary: 'Relaypoint gives B2B SaaS revenue teams one live view of pipeline health, so sales leaders catch slipping deals before the forecast call.',
            youTarget: 'Sales leaders at 20–200 person SaaS companies',
            yourEdge: 'Live in a day, no RevOps team needed',
            youSolve: 'Forecasts built on stale CRM data',
            youAre: 'Founder, Relaypoint',
            voice: ['Direct', 'Data-driven', 'Warm'],
        }],
    },
    inbox: {
        url: '/inbox',
        ready: 'text=Sarah Mitchell',
        act: async (page) => {
            await page.getByText('Sarah Mitchell').first().click();
            await page.getByText('Thursday at 10 works').first().waitFor();
        },
    },
    campaign: { url: (ids) => `/campaigns/${ids.main}`, ready: 'text=Sales leaders — Series A SaaS' },
    messages: {
        url: (ids) => `/campaigns/${ids.main}`,
        ready: 'text=Sales leaders — Series A SaaS',
        directions: 'campaign',
        act: async (page) => {
            await page.locator('button', { hasText: /^messages$/i }).first().click();
            await page.getByText('congrats on doubling the SDR team').first().waitFor();
            // Bring the message log (not the KPI header) into frame.
            await page.getByText('Full AI audit log', { exact: false }).first().evaluate((el) => el.scrollIntoView({ block: 'start' }));
        },
    },
};

async function main() {
    const only = process.argv.slice(2);
    const names = only.length ? only : Object.keys(SHOTS);
    mkdirSync(OUT, { recursive: true });

    for (const [name, url] of [['backend-api', 'http://localhost:3001/health'], ['web', WEB]]) {
        const up = await fetch(url).then(() => true, () => false);
        if (!up) {
            console.error(`${url} isn't responding. Start the "${name}" server from .claude/launch.json first.`);
            process.exit(1);
        }
    }

    seedCmd('seed');
    const token = seedCmd('token');
    const browser = await chromium.launch();
    try {
        const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });
        await ctx.addInitScript((t) => {
            localStorage.setItem('token', t);
            localStorage.setItem('user', JSON.stringify({ name: 'Maya Collins', firstName: 'Maya', email: 'maya@relaypoint.example', registrationStep: 'COMPLETED' }));
        }, token);
        const page = await ctx.newPage();
        // The Next.js dev-tools badge must never end up in a marketing shot.
        await page.addInitScript(() => {
            const hide = () => {
                if (!document.head) return requestAnimationFrame(hide);
                const s = document.createElement('style');
                s.textContent = 'nextjs-portal{display:none!important}';
                document.head.appendChild(s);
            };
            hide();
        });

        const campaigns = await (await fetch('http://localhost:3001/api/v1/campaigns', { headers: { Authorization: `Bearer ${token}` } })).json();
        const ids = { main: campaigns.find((c) => c.status === 'ACTIVE').id };

        // Shots that need the campaign-tab message directions go last.
        const ordered = [...names].sort((a, b) => Number(!!SHOTS[a].directions) - Number(!!SHOTS[b].directions));
        let flipped = false;
        for (const name of ordered) {
            const shot = SHOTS[name];
            if (!shot) throw new Error(`unknown shot: ${name}`);
            if (shot.directions && !flipped) { seedCmd('campaign-directions'); flipped = true; }
            if (shot.route) {
                const [pattern, body] = shot.route;
                await page.route(pattern, (r) => r.fulfill({ json: body }));
            }
            const url = typeof shot.url === 'function' ? shot.url(ids) : shot.url;
            await page.goto(WEB + url, { waitUntil: 'networkidle' });
            await page.locator(`${shot.ready} >> visible=true`).first().waitFor({ timeout: 30000 });
            if (shot.act) await shot.act(page);
            await page.waitForTimeout(1500); // let entrance animations settle
            // Clip off the app's 256px sidebar: the landing page frames each
            // shot itself, and the content reads larger without it.
            await page.screenshot({ path: path.join(OUT, `${name}.png`), clip: { x: 256, y: 0, width: 1184, height: 900 } });
            console.log(`captured ${name}.png`);
        }
    } finally {
        await browser.close();
        seedCmd('cleanup');
    }
}

main().catch((e) => {
    console.error(e);
    process.exit(1);
});
