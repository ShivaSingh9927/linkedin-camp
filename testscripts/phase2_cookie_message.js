const { chromium } = require('playwright-extra');
const stealth = require('puppeteer-extra-plugin-stealth')();
const path = require('path');
const fs = require('fs');

chromium.use(stealth);

// ---------------------
// HUMAN HELPERS
// ---------------------
const wait = (ms) => new Promise(res => setTimeout(res, ms));
const randomRange = (min, max) =>
  Math.floor(Math.random() * (max - min + 1) + min);

// ---------------------
// MAIN
// ---------------------
async function startPhase2CookieAutomation() {

  console.log('\n[PHASE 2] DIRECT COMPOSE FLOW (NO BUTTON CLICK)\n');

  // 1. LOAD SESSION FILES
  let cookies, userAgent, localStorageData;

  try {
    cookies = JSON.parse(fs.readFileSync(path.join(__dirname, 'cookies.json'), 'utf-8'));

    const fp = JSON.parse(fs.readFileSync(path.join(__dirname, 'fingerprint.json'), 'utf-8'));
    userAgent = fp.userAgent;

    if (fs.existsSync(path.join(__dirname, 'localStorage.json'))) {
      localStorageData = JSON.parse(fs.readFileSync(path.join(__dirname, 'localStorage.json'), 'utf-8'));
    }

  } catch (e) {
    console.log('❌ Missing cookies/fingerprint/localStorage');
    return;
  }

  // 2. LAUNCH BROWSER
  const browser = await chromium.launch({
    headless: true,
    args: [
      '--disable-blink-features=AutomationControlled',
      '--start-maximized',
      '--no-sandbox'
    ]
  });

  const context = await browser.newContext({
    userAgent: userAgent,
    viewport: null,
    locale: 'en-IN',
    timezoneId: 'Asia/Kolkata',
    proxy: {
      server: 'http://82.41.252.111:46222',
      username: 'xBVyYdUpx84nWx7',
      password: 'dwwTxtvv5a10RXn'
    }
  });

  await context.addCookies(cookies);

  const page = await context.newPage();
  page.setDefaultTimeout(120000);

  // Inject localStorage
  if (localStorageData) {
    await page.addInitScript((data) => {
      const parsed = JSON.parse(data);
      for (const [k, v] of Object.entries(parsed)) {
        window.localStorage.setItem(k, v);
      }
    }, JSON.stringify(localStorageData));
  }

  try {

    const targetProfile = "https://www.linkedin.com/in/shiva-singh-genai-llm/";
    const message = "Hi Shiva! I saw your GenAI work — really impressive. Would love to connect and exchange ideas.";

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
      await page.screenshot({ path: 'compose_link_missing.png' });
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
      await page.screenshot({ path: 'textbox_not_found.png' });
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

    console.log('\n✅ SUCCESS: Message sent without clicking profile button\n');

  } catch (err) {
    console.error('\n❌ ERROR:', err.message);
  }

  console.log('Closing in 60 seconds...');
  await wait(60000);
  await browser.close();
}

startPhase2CookieAutomation();