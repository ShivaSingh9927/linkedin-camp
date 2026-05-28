// Robust connection-state detection for a LinkedIn profile.
//
// Loads the same session files the prod engine uses (pulled from prod DB
// into ./cookies.json, ./fingerprint.json, ./localStorage.json) and visits
// a profile URL. Extracts every reliable signal that distinguishes
// connection states and combines them into a single decision so the
// send-message gate has a deterministic answer.
//
// Usage:
//   node testscripts/phase2_connection_detect.js <profile_url> [--save-html]
//
// Example:
//   node testscripts/phase2_connection_detect.js https://www.linkedin.com/in/sandhya-naik-3624261a0/ --save-html
//
// Why this script exists: the engine's profile-visit, connect, and
// send-message nodes each have their own connection check using different
// heuristics, and they disagree (profile-visit says "Connected: true",
// send-message can't find the Message button — same profile, seconds
// apart). One script, one source of truth, then port back.

const { chromium } = require('playwright-extra');
const stealth = require('puppeteer-extra-plugin-stealth')();
const path = require('path');
const fs = require('fs');

chromium.use(stealth);

const wait = (ms) => new Promise(res => setTimeout(res, ms));
const randomRange = (min, max) => Math.floor(Math.random() * (max - min + 1) + min);

const PROXY = {
    server: 'http://82.41.252.111:46222',
    username: 'xBVyYdUpx84nWx7',
    password: 'dwwTxtvv5a10RXn',
};

async function main() {
    const targetProfile = process.argv[2];
    const saveHtml = process.argv.includes('--save-html');

    if (!targetProfile || !/^https:\/\/(www\.)?linkedin\.com\/in\//.test(targetProfile)) {
        console.error('Usage: node phase2_connection_detect.js <linkedin_profile_url> [--save-html]');
        process.exit(2);
    }

    const slug = targetProfile.split('/in/').pop().replace(/\/+$/, '').replace(/[^a-z0-9-]/gi, '_');

    // 1. LOAD SESSION
    const cookies = JSON.parse(fs.readFileSync(path.join(__dirname, 'cookies.json'), 'utf8'));
    const fingerprint = JSON.parse(fs.readFileSync(path.join(__dirname, 'fingerprint.json'), 'utf8'));
    const localStorageData = fs.existsSync(path.join(__dirname, 'localStorage.json'))
        ? JSON.parse(fs.readFileSync(path.join(__dirname, 'localStorage.json'), 'utf8'))
        : null;

    const userAgent = fingerprint.userAgent || 'Mozilla/5.0';

    console.log(`[init] Loaded ${cookies.length} cookies, UA=${userAgent.slice(0, 50)}...`);
    console.log(`[init] Target: ${targetProfile}`);

    // 2. LAUNCH — proxy at LAUNCH level so every Chrome subprocess egresses
    // through the same IP the cookies were captured under. Context-level
    // alone leaks via Chrome internal requests on Linux.
    const browser = await chromium.launch({
        headless: true,
        proxy: PROXY,
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-blink-features=AutomationControlled',
            '--disable-gpu',
            '--disable-dev-shm-usage',
        ],
    });

    const context = await browser.newContext({
        userAgent,
        viewport: { width: 1366, height: 900 },
        locale: 'en-IN',
        timezoneId: 'Asia/Kolkata',
        proxy: PROXY,
    });

    // Cookies need expires as integer seconds; Playwright is strict.
    const normalized = cookies.map(c => ({
        ...c,
        expires: c.expires != null ? Math.round(Number(c.expires)) : Math.round(Date.now() / 1000) + 86400 * 30,
    }));
    await context.addCookies(normalized);

    if (localStorageData) {
        await context.addInitScript((data) => {
            const parsed = JSON.parse(data);
            for (const [k, v] of Object.entries(parsed)) {
                window.localStorage.setItem(k, v);
            }
        }, JSON.stringify(localStorageData));
    }

    const page = await context.newPage();
    page.setDefaultTimeout(60000);

    const result = {
        targetProfile,
        navUrl: null,
        loginRedirect: false,
        // Lead identity as read from the page heading.
        h1Name: null,
        // Degree relative to the logged-in account. Direct text scrape from
        // the area around the heading, scoped to avoid 3rd-party widgets.
        degree: null,            // '1st' | '2nd' | '3rd' | '3rd+' | null
        // Compose URL — present iff the current session can DM this lead
        // right now (1st-degree OR Open Profile).
        composeUrl: null,
        // Connect href — present when an invite has not been sent yet. The
        // /preload/custom-invite/?vanityName=<slug> path is bound to THIS
        // lead, so its presence is unambiguous.
        connectHref: null,
        // Aria-labels for pending/follow buttons when present.
        pendingAriaLabel: null,
        followAriaLabel: null,
        // Derived booleans the decision matrix consumes.
        hasMessageButtonOnProfile: false,
        hasConnectButtonOnProfile: false,
        hasPendingButtonOnProfile: false,
        hasFollowOnlyOnProfile: false,
        // Final decision the send-message gate should use.
        decision: null,          // 'DMABLE' | 'NEEDS_CONNECT' | 'INVITE_PENDING' | 'NO_RELATION' | 'ANOMALY'
        decisionReason: null,
    };

    try {
        console.log('[step] navigating...');
        await page.goto(targetProfile, { waitUntil: 'domcontentloaded', timeout: 90000 });
        result.navUrl = page.url();

        if (/\/uas\/login|\/authwall|\/checkpoint/.test(result.navUrl)) {
            result.loginRedirect = true;
            result.decision = 'ANOMALY';
            result.decisionReason = `Redirected to ${result.navUrl} — session invalid (proxy mismatch is the usual cause)`;
            throw new Error('login redirect');
        }

        // LinkedIn has shipped a new design system: class names are random
        // hashes, the lead's name is in an h2 (sometimes h1, depends on
        // variant), and the Connect button is an <a> whose href encodes
        // the lead's vanity slug. That last detail is GREAT for detection
        // — we can match THIS specific lead's connect link via the slug
        // and avoid false positives from third-party widgets.

        // Wait for SOMETHING tied to this specific lead's identity to
        // render — either the compose link (DMable case) or the invite
        // link (unconnected case) — whichever comes first. Falls through
        // on timeout so we still report what we found.
        const slugForWait = targetProfile.split('/in/').pop().replace(/\/+$/, '');
        await Promise.race([
            page.waitForSelector(`a[href*="/messaging/compose/?profileUrn"]`, { state: 'attached', timeout: 25000 }).catch(() => null),
            page.waitForSelector(`a[href*="/preload/custom-invite/?vanityName=${slugForWait}"]`, { state: 'attached', timeout: 25000 }).catch(() => null),
            page.waitForSelector('h1, h2', { state: 'visible', timeout: 25000 }).catch(() => null),
        ]).catch(() => null);
        // Settle for lazy hydration of action buttons.
        await wait(3000);
        await page.mouse.wheel(0, 250);
        await wait(2000);
        await page.mouse.wheel(0, -250);
        await wait(1500);

        // ---- Extract signals in one evaluate to keep DOM read consistent ----
        const signals = await page.evaluate(({ targetUrl, slug }) => {
            const out = {};

            // ---- Identity ----
            // The name is wherever LinkedIn rendered the largest heading.
            // Older UI uses h1, the new design uses h2. Try both.
            const heading = document.querySelector('h1') || document.querySelector('h2');
            out.h1Name = heading ? heading.textContent.trim() : null;

            // ---- Compose link — the "can I DM right now" signal ----
            // Strongest signal. Present when lead is 1st-degree OR has Open
            // Profile turned on. Always for THIS lead because the profileUrn
            // is bound to them.
            const composeLink = document.querySelector('a[href*="/messaging/compose/?profileUrn"]');
            out.composeUrl = composeLink ? composeLink.href : null;

            // ---- Connect link — the "I need to send an invite" signal ----
            // New LinkedIn UI renders this as:
            //   <a href="/preload/custom-invite/?vanityName=<slug>"
            //      aria-label="Invite <Lead> to connect">
            // The href is bound to THIS lead's slug — zero ambiguity.
            const connectLink = document.querySelector(
                `a[href*="/preload/custom-invite/?vanityName=${slug}"]`
            ) || Array.from(document.querySelectorAll('a[href*="/preload/custom-invite/"]'))
                  .find(a => (a.getAttribute('aria-label') || '').match(/^Invite .+ to connect$/i));
            out.connectHref = connectLink ? connectLink.getAttribute('href') : null;

            // ---- Pending invite ----
            // Aria-labels for the pending state include the word "Pending"
            // and a hint to withdraw. Scope: any button whose aria-label
            // references THIS lead.
            const leadFirstName = (heading?.textContent || '').trim().split(/\s+/)[0] || '';
            const allBtns = Array.from(document.querySelectorAll('button[aria-label], a[role="button"][aria-label]'));
            const pendingBtn = allBtns.find(b => {
                const al = b.getAttribute('aria-label') || '';
                return /Pending|click to withdraw|Withdraw invitation/i.test(al);
            });
            out.pendingAriaLabel = pendingBtn ? pendingBtn.getAttribute('aria-label') : null;

            // ---- Follow button (signal that the only allowed action is Follow) ----
            const followBtn = allBtns.find(b => {
                const al = b.getAttribute('aria-label') || '';
                return new RegExp(`^Follow\\s+${leadFirstName}\\b`, 'i').test(al);
            });
            out.followAriaLabel = followBtn ? followBtn.getAttribute('aria-label') : null;

            // ---- Degree badge ----
            // Find an aria-label like "Reid Hoffman • 3rd+ degree connection"
            // or visible text "· 3rd". Search ONLY near the heading to avoid
            // matching "People you may know" cards which carry their own
            // degree labels for OTHER people.
            let degree = null;
            if (heading) {
                // Walk up a few ancestors and collect text.
                let el = heading;
                let collected = '';
                for (let i = 0; i < 6 && el && el !== document.body; i++) {
                    collected = (el.textContent || '').replace(/\s+/g, ' ').slice(0, 2000);
                    if (/·\s*(1st|2nd|3rd\+|3rd)\b/.test(collected)) break;
                    el = el.parentElement;
                }
                const m = collected.match(/·\s*(3rd\+|1st|2nd|3rd)\b/);
                degree = m ? m[1] : null;
            }
            out.degree = degree;

            // ---- Final boolean signals ----
            out.hasMessageButtonOnProfile = !!out.composeUrl;
            out.hasConnectButtonOnProfile = !!out.connectHref;
            out.hasPendingButtonOnProfile = !!out.pendingAriaLabel;
            out.hasFollowOnlyOnProfile = !!out.followAriaLabel && !out.composeUrl && !out.connectHref && !out.pendingAriaLabel;

            return out;
        }, { targetUrl: targetProfile, slug: slugForWait });

        Object.assign(result, signals);

        // ---- Decision matrix ----
        //
        // Compose-link existence is the strongest single signal — if the
        // DOM exposes /messaging/compose/?profileUrn for this lead, the
        // current session can DM them, period. That covers 1st-degree
        // leads AND Open Profile leads.
        //
        // If no compose link: fall back to button text. Connect / Pending
        // / Follow tell us exactly what next step is allowed.
        if (result.composeUrl) {
            result.decision = 'DMABLE';
            result.decisionReason = 'compose link present in DOM';
        } else if (result.hasPendingButtonOnProfile) {
            result.decision = 'INVITE_PENDING';
            result.decisionReason = 'Pending/Withdraw button visible — invite already sent';
        } else if (result.hasConnectButtonOnProfile) {
            result.decision = 'NEEDS_CONNECT';
            result.decisionReason = 'Connect button visible — not connected yet';
        } else if (result.hasFollowOnlyOnProfile) {
            result.decision = 'NO_RELATION';
            result.decisionReason = 'Only Follow visible — lead has blocked or hidden Connect/Message';
        } else if (result.degree === '1st') {
            // 1st-degree but no compose link AND no Connect button — page
            // probably didn't render the action area. Flag, don't guess.
            result.decision = 'ANOMALY';
            result.decisionReason = 'Degree=1st but no compose link or buttons found — DOM may not have rendered. Retry.';
        } else {
            result.decision = 'ANOMALY';
            result.decisionReason = `Inconclusive: degree=${result.degree}, no compose link, no recognized action button.`;
        }

    } catch (err) {
        if (!result.decision) {
            result.decision = 'ANOMALY';
            result.decisionReason = `Threw: ${err.message}`;
        }
    }

    // Persist artefacts so we can iterate offline without re-fetching.
    const artefactDir = path.join(__dirname, '_artefacts');
    if (!fs.existsSync(artefactDir)) fs.mkdirSync(artefactDir, { recursive: true });
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    const base = path.join(artefactDir, `${slug}_${stamp}`);

    try {
        await page.screenshot({ path: `${base}.png`, fullPage: true });
    } catch {}
    if (saveHtml) {
        try {
            const html = await page.content();
            fs.writeFileSync(`${base}.html`, html);
        } catch {}
    }
    fs.writeFileSync(`${base}.json`, JSON.stringify(result, null, 2));

    console.log('\n========== DETECTION RESULT ==========');
    console.log(JSON.stringify(result, null, 2));
    console.log(`\nartefacts → ${base}.{json,png${saveHtml ? ',html' : ''}}`);

    await browser.close();
}

main().catch(e => { console.error(e); process.exit(1); });
