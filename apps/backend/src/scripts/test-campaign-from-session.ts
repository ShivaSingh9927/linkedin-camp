import { chromium } from 'playwright-extra';
const stealth = require('puppeteer-extra-plugin-stealth')();
import path from 'path';
import fs from 'fs';

chromium.use(stealth);

const wait = (ms: number) => new Promise((res) => setTimeout(res, ms));
const randomRange = (min: number, max: number) =>
  Math.floor(Math.random() * (max - min + 1) + min);

async function main() {
  console.log('\n=== TEST: Use same session as phase2_cookie_message.js ===\n');

  // 1️⃣ Load session files
  const testScriptsDir = '/root/linkedin-camp/testscripts';
  let cookies: any, fingerprint: any, localStorageData: any;

  try {
    cookies = JSON.parse(fs.readFileSync(path.join(testScriptsDir, 'cookies.json'), 'utf-8'));
    fingerprint = JSON.parse(fs.readFileSync(path.join(testScriptsDir, 'fingerprint.json'), 'utf-8'));
    if (fs.existsSync(path.join(testScriptsDir, 'localStorage.json'))) {
      localStorageData = JSON.parse(fs.readFileSync(path.join(testScriptsDir, 'localStorage.json'), 'utf-8'));
    }
    console.log('[SESSION] Loaded cookies, fingerprint, localStorage');
  } catch (e) {
    console.error('[SESSION] ERROR loading files:', e);
    process.exit(1);
  }

  // 2️⃣ Launch browser
  console.log('\n[ENGINE] Launching browser...\n');

  const browser = await chromium.launch({
    headless: true,
    args: [
      '--disable-blink-features=AutomationControlled',
      '--start-maximized',
      '--no-sandbox',
    ],
  });

  // Proxy (use the same as phase2_cookie_message.js)
  const proxy = {
    server: 'http://82.41.252.111:46222',
    username: 'xBVyYdUpx84nWx7',
    password: 'dwwTxtvv5a10RXn',
  };

  const context = await browser.newContext({
    userAgent: fingerprint.userAgent,
    viewport: null,
    locale: 'en-IN',
    timezoneId: 'Asia/Kolkata',
    proxy,
  });

  await context.addCookies(cookies);

  const page = await context.newPage();

  if (localStorageData) {
    await page.addInitScript((data: any) => {
      const parsed = JSON.parse(data);
      for (const [k, v] of Object.entries(parsed)) {
        (window as any).localStorage.setItem(k, v as string);
      }
    }, JSON.stringify(localStorageData));
  }

  const targetProfile = 'https://www.linkedin.com/in/shiva-singh-genai-llm/';

  try {
    // ==== STEP 1: Profile Visit ====
    console.log('[STEP 1] Visiting profile...');
    await page.goto(targetProfile, { waitUntil: 'domcontentloaded' });
    await wait(randomRange(12000, 18000));

    const url = page.url();
    if (url.includes('authwall') || url.includes('login') || url.includes('checkpoint')) {
      console.error('[STEP 1] Session invalid! Redirected to:', url);
      await browser.close();
      process.exit(1);
    }
    console.log('[STEP 1] ✅ Profile loaded');

    // ==== STEP 2: Extract compose URL ====
    console.log('[STEP 2] Extracting compose URL...');
    const composeUrl = await page.evaluate(() => {
      const link = document.querySelector('a[href*="/messaging/compose/?profileUrn"]') as HTMLAnchorElement | null;
      return link ? link.href : null;
    });

    if (!composeUrl) {
      console.error('[STEP 2] Compose URL not found');
      await browser.close();
      process.exit(1);
    }
    console.log('[STEP 2] Compose URL found:', composeUrl);

    await wait(randomRange(2000, 4000));

    // ==== STEP 3: Open messaging ====
    console.log('[STEP 3] Opening messaging...');
    await page.goto(composeUrl, { waitUntil: 'domcontentloaded' });
    await wait(randomRange(15000, 20000));

    // ==== STEP 4: Find message box ====
    console.log('[STEP 4] Searching for message box...');
    const textboxSelectors = [
      'div.msg-form__contenteditable[contenteditable="true"]',
      '[role="textbox"]',
      '.msg-form__textarea',
      '.msg-form__contenteditable',
    ];

    let textBox: any = null;
    for (const sel of textboxSelectors) {
      try {
        const el = page.locator(sel).first();
        if (await el.isVisible({ timeout: 10000 })) {
          textBox = el;
          console.log('[STEP 4] ✅ Textbox found with selector:', sel);
          break;
        }
      } catch {}
    }

    if (!textBox) {
      console.error('[STEP 4] Message textbox not found');
      await browser.close();
      process.exit(1);
    }

    // ==== STEP 5: Type message with human delays ====
    const message = 'Hi Shiva! I saw your profile and wanted to connect.';
    await textBox.click({ force: true });
    await wait(1000);

    for (const char of message) {
      await page.keyboard.type(char, { delay: randomRange(40, 90) });
    }

    await wait(randomRange(2000, 3000));

    // ==== STEP 6: Click send ====
    console.log('[STEP 6] Clicking send...');
    const sendBtn = page.locator('button.msg-form__send-button').first();
    await sendBtn.waitFor({ timeout: 15000 });
    await sendBtn.click();

    console.log('\n✅ SUCCESS: Profile Visit → Message completed via backend!\n');
  } catch (err: any) {
    console.error('\n❌ ERROR:', err.message);
  }

  console.log('Closing browser in 60 seconds...');
  await wait(60000);
  await browser.close();

  console.log('\n=== TEST COMPLETE ===\n');
}

main()
  .catch((e) => {
    console.error('Fatal error:', e);
    process.exit(1);
  });