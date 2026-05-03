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
  const context = await browser.newContext({
    userAgent: fp.userAgent,
    viewport: null,
    locale: 'en-IN',
    timezoneId: 'Asia/Kolkata'
  });
  await context.addCookies(cookies);
  const page = await context.newPage();
  
  await page.goto('https://www.linkedin.com/in/shiva-singh-genai-llm/recent-activity/shares/', { waitUntil: 'domcontentloaded' });
  await new Promise(r => setTimeout(r, 5000));
  
  const postLink = await page.evaluate(() => {
    const wrappers = document.querySelectorAll('div[data-urn*="urn:li:activity"], div[data-urn*="urn:li:ugcPost"]');
    if (wrappers.length > 0) {
      const urn = wrappers[0].getAttribute('data-urn');
      return `https://www.linkedin.com/feed/update/${urn}/`;
    }
    const links = document.querySelectorAll('a[href*="/feed/update/urn:li:"]');
    for (const l of links) {
      if (!l.href.includes('?commentUrn=')) return l.href.split('?')[0];
    }
    return null;
  });
  
  console.log('Post URL:', postLink);
  if (!postLink) return;
  
  await page.goto(postLink, { waitUntil: 'domcontentloaded' });
  await new Promise(r => setTimeout(r, 8000));
  
  const debugInfo = await page.evaluate(() => {
    const selectors = [
      'div[role="textbox"][aria-label*="Add a comment"]',
      'div[data-placeholder="Add a comment…"]',
      'div[data-placeholder="Add a comment"]',
      'div.ql-editor[contenteditable="true"]',
      'div[contenteditable="true"][data-placeholder*="comment"]',
      '.comments-comment-box__contenteditable',
      'div.comments-comment-box',
      '.comments-comment-textbox',
      '[role="textbox"]',
      '[contenteditable="true"]',
      'div.msg-form__contenteditable',
      'div.comments-comment-box__contenteditable',
      'div[contenteditable="true"]',
      '.ql-editor'
    ];
    const results = {};
    for (const sel of selectors) {
      const el = document.querySelector(sel);
      results[sel] = el ? { found: true, tag: el.tagName, id: el.id, classes: el.className.substring(0, 80), placeholder: el.getAttribute('data-placeholder') || el.getAttribute('aria-placeholder') || '', ariaLabel: el.getAttribute('aria-label') || '' } : { found: false };
    }
    return results;
  });
  
  console.log('=== Element Debug ===');
  console.log(JSON.stringify(debugInfo, null, 2));
  
  await page.screenshot({ path: '/tmp/comment-page.png', fullPage: true });
  console.log('Screenshot saved');
  
  await browser.close();
}

debug().catch(e => console.error(e));
