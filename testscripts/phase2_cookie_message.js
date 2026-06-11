const { chromium } = require('playwright-extra');
const stealth = require('puppeteer-extra-plugin-stealth')();
const path = require('path');
const fs = require('fs');

chromium.use(stealth);

const wait = (ms) => new Promise(res => setTimeout(res, ms));
const randomRange = (min, max) =>
  Math.floor(Math.random() * (max - min + 1) + min);

const PROXY = {
  server: 'http://82.41.252.111:46222',
  username: 'xBVyYdUpx84nWx7',
  password: 'dwwTxtvv5a10RXn'
};

async function startPhase2CookieAutomation() {

  // Per-account inputs. Override via env so this same script can run for any
  // saved session under testscripts/sessions/<label>/. The orchestrator
  // (phase4_message_test.js) drives both sequential and parallel sweeps.
  const label = process.env.ACCOUNT_LABEL || 'raja';
  const targetProfile = process.env.TARGET_PROFILE || 'https://www.linkedin.com/in/shiva-singh-genai-llm/';
  // Unique message per account so a duplicate-content filter doesn't
  // contaminate the proxy-correlation signal we're actually testing for.
  const message = process.env.MESSAGE
    || `Hey Shiva — quick test ping from ${label} at ${new Date().toISOString().slice(11,19)} UTC. Ignore.`;
  const headless = process.env.HEADLESS !== 'false';

  console.log(`\n[PHASE 2 / ${label}] DIRECT COMPOSE FLOW`);
  console.log(`  target:  ${targetProfile}`);
  console.log(`  message: ${message.slice(0, 60)}...`);

  const result = {
    label,
    success: false,
    profile: targetProfile,
    message,
    status: 'failed',
    error: null,
    reason: null,
  };

  // 1. LOAD SESSION FILES (per-account)
  const sessionDir = path.join(__dirname, 'sessions', label);
  let cookies, userAgent, localStorageData;

  try {
    cookies = JSON.parse(fs.readFileSync(path.join(sessionDir, 'cookies.json'), 'utf-8'));
    const fp = JSON.parse(fs.readFileSync(path.join(sessionDir, 'fingerprint.json'), 'utf-8'));
    userAgent = fp.userAgent;
    if (fs.existsSync(path.join(sessionDir, 'localStorage.json'))) {
      localStorageData = fs.readFileSync(path.join(sessionDir, 'localStorage.json'), 'utf-8');
    }
  } catch (e) {
    console.log(`❌ Missing session files under ${sessionDir}: ${e.message}`);
    result.reason = `missing session files at ${sessionDir}`;
    console.log(JSON.stringify(result));
    process.exit(2);
  }

  // 2. LAUNCH BROWSER — proxy at LAUNCH level per the sticky-proxy invariant.
  // Context-only proxy lets DNS / telemetry / stealth probes escape to the
  // host IP, which on LinkedIn invalidates the session captured under dispA.
  const browser = await chromium.launch({
    headless,
    proxy: PROXY,
    args: [
      '--disable-blink-features=AutomationControlled',
      '--no-sandbox'
    ]
  });

  const context = await browser.newContext({
    userAgent: userAgent,
    viewport: { width: 1920, height: 1080 },
    locale: 'en-IN',
    timezoneId: 'Asia/Kolkata',
    proxy: PROXY,
  });

  await context.addCookies(cookies);

  // localStorage MUST be set via an init script (origin-scoped, can't be
  // pre-populated). Apply at context level so every page in this context
  // gets it on document_start.
  if (localStorageData) {
    await context.addInitScript((data) => {
      try {
        const parsed = JSON.parse(data);
        for (const [k, v] of Object.entries(parsed)) {
          window.localStorage.setItem(k, v);
        }
      } catch {}
    }, localStorageData);
  }

  const page = await context.newPage();
  page.setDefaultTimeout(120000);

  try {

    // ---------------------
    // STEP 1: OPEN PROFILE
    // ---------------------
    console.log('[STEP 1] Opening profile...');
    await page.goto(targetProfile, { waitUntil: 'domcontentloaded' });

    await wait(randomRange(12000, 18000));

    // ---------------------
    // STEP 2: EXTRACT COMPOSE LINK
    // ---------------------
    console.log('[STEP 2] Extracting compose URL...');

    const composeUrl = await page.evaluate(() => {
      const link = document.querySelector('a[href*="/messaging/compose/?profileUrn"]');
      return link ? link.href : null;
    });

    if (!composeUrl) {
      await page.screenshot({ path: `/tmp/test-sessions/msg_${label}_no_compose.png` });
      result.reason = "Compose link missing from profile. The profile might not have a message button or it might be restricted.";
      throw new Error("Compose URL not found. Screenshot saved.");
    }

    console.log('✅ Compose URL found');
    console.log(composeUrl);

    await wait(randomRange(2000, 4000));

    // ---------------------
    // STEP 3: OPEN COMPOSE DIRECTLY
    // ---------------------
    console.log('[STEP 3] Opening messaging directly...');
    await page.goto(composeUrl, { waitUntil: 'domcontentloaded' });

    await wait(randomRange(15000, 20000));

    // ---------------------
    // STEP 4: FIND TEXTBOX
    // ---------------------
    console.log('[STEP 4] Searching for message box...');

    const textboxSelectors = [
      'div.msg-form__contenteditable[contenteditable="true"]',
      '[role="textbox"]',
      '.msg-form__textarea',
      '.msg-form__contenteditable'
    ];

    let textBox = null;

    for (const sel of textboxSelectors) {
      try {
        const el = page.locator(sel).first();
        if (await el.isVisible({ timeout: 10000 })) {
          textBox = el;
          console.log(`✅ Textbox found using: ${sel}`);
          break;
        }
      } catch {}
    }

    if (!textBox) {
      await page.screenshot({ path: `/tmp/test-sessions/msg_${label}_no_textbox.png` });
      result.reason = "Message box not found. This usually happens if you are not connected to the user.";
      throw new Error('Message textbox not found');
    }

    // ---------------------
    // STEP 5: TYPE MESSAGE (human typing)
    // ---------------------
    console.log('[STEP 5] Typing message...');

    await textBox.click({ force: true });
    await wait(1000);

    for (const char of message) {
      await page.keyboard.type(char, { delay: randomRange(40, 90) });
    }

    await wait(randomRange(2000, 3000));

    // ---------------------
    // STEP 6: CLICK SEND
    // ---------------------
    console.log('[STEP 6] Sending message...');

    const sendBtn = page.locator('button.msg-form__send-button').first();

    await sendBtn.waitFor({ timeout: 15000 });
    await sendBtn.click();

    console.log(`\n✅ SUCCESS [${label}]: message sent\n`);
    result.success = true;
    result.status = "success";

    // Verification screenshot after send to confirm UI state.
    await wait(3000);
    await page.screenshot({ path: `/tmp/test-sessions/msg_${label}_sent.png` }).catch(() => {});

  } catch (err) {
    console.error(`\n❌ ERROR [${label}]:`, err.message);
    result.error = err.message;
    await page.screenshot({ path: `/tmp/test-sessions/msg_${label}_error.png` }).catch(() => {});
  } finally {
    console.log('\n========== FINAL JSON RESULT ==========');
    console.log(JSON.stringify(result));
    console.log('=======================================\n');
  }

  await browser.close();
  process.exit(result.success ? 0 : 1);
}

startPhase2CookieAutomation();