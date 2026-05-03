const { chromium } = require('playwright-extra');
const stealth = require('puppeteer-extra-plugin-stealth')();
chromium.use(stealth);
const fs = require('fs');
const path = require('path');

async function debug() {
  const userDir = '/home/shiva/Documents/linkedin-camp/sessions/eef74901-4b70-44a8-89b9-437f6210d5ff';
  const cookies = JSON.parse(fs.readFileSync(path.join(userDir, 'cookies.json'), 'utf-8'));
  const fp = JSON.parse(fs.readFileSync(path.join(userDir, 'fingerprint.json'), 'utf-8'));
  
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
  const context = await browser.newContext({ userAgent: fp.userAgent, viewport: null, locale: 'en-IN', timezoneId: 'Asia/Kolkata' });
  await context.addCookies(cookies);
  const page = await context.newPage();
  page.setDefaultTimeout(30000);
  
  // First go to feed to warm up
  console.log('Going to feed...');
  await page.goto('https://www.linkedin.com/feed/', { waitUntil: 'domcontentloaded' });
  await new Promise(r => setTimeout(r, 8000));
  console.log('Feed URL:', page.url());
  
  // Check if logged in
  const loggedIn = page.url().includes('/feed');
  console.log('Logged in:', loggedIn);
  
  if (!loggedIn) {
    console.log('Not logged in! URL:', page.url());
    await browser.close();
    return;
  }
  
  // Now go to post
  console.log('Going to post...');
  await page.goto('https://www.linkedin.com/feed/update/urn:li:activity:7433555515122647040/', { waitUntil: 'domcontentloaded' });
  await new Promise(r => setTimeout(r, 10000));
  console.log('Post URL:', page.url());
  
  // Check all buttons
  const buttons = await page.evaluate(() => {
    return Array.from(document.querySelectorAll('button')).map(b => ({
      text: b.textContent?.trim()?.substring(0, 30),
      ariaLabel: b.getAttribute('aria-label')?.substring(0, 50),
      classes: b.className?.substring(0, 60),
      visible: b.getBoundingClientRect().width > 0
    })).filter(b => b.text);
  });
  
  console.log('=== All Buttons (first 20) ===');
  buttons.slice(0, 20).forEach(b => console.log(`  "${b.text}" | visible: ${b.visible} | classes: ${b.classes}`));
  
  // Check comment box via locator
  const rt = page.locator('[role="textbox"]').first();
  const rtVisible = await rt.isVisible({ timeout: 10000 }).catch(() => false);
  console.log('Role textbox visible:', rtVisible);
  
  if (rtVisible) {
    const rtInfo = await rt.evaluate(el => ({
      tag: el.tagName,
      classes: el.className?.substring(0, 80),
      contenteditable: el.getAttribute('contenteditable'),
      ariaLabel: el.getAttribute('aria-label')
    }));
    console.log('Textbox info:', JSON.stringify(rtInfo, null, 2));
  }
  
  await page.screenshot({ path: '/tmp/comment-page5.png' });
  await browser.close();
}

debug().catch(e => console.error(e));
