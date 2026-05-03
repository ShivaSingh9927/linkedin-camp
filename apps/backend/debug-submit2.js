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
  page.setDefaultTimeout(15000);
  
  await page.goto('https://www.linkedin.com/feed/update/urn:li:activity:7433555515122647040/', { waitUntil: 'domcontentloaded' });
  await new Promise(r => setTimeout(r, 10000));
  
  // Scroll down to comment section
  await page.mouse.wheel(0, 1200);
  await new Promise(r => setTimeout(r, 3000));
  
  // Find ALL editable/comment-related elements
  const elements = await page.evaluate(() => {
    // Check tiptap
    const tiptap = document.querySelector('.tiptap');
    // Check ProseMirror
    const pm = document.querySelector('.ProseMirror');
    // Check contenteditable
    const ce = document.querySelector('[contenteditable="true"]');
    // Check aria-label
    const editor = document.querySelector('[aria-label*="comment"]');
    // Check all buttons with comment/post
    const btns = document.querySelectorAll('button');
    const commentBtns = [];
    for (const btn of btns) {
      const text = btn.textContent?.trim() || '';
      const rect = btn.getBoundingClientRect();
      if ((text.includes('Comment') || text.includes('Post') || text.includes('Reply')) && rect.width > 0 && rect.height > 0) {
        commentBtns.push({ text, disabled: btn.disabled, visible: rect.y > 0, y: rect.y, classes: btn.className.substring(0, 80) });
      }
    }
    
    return {
      tiptap: tiptap ? { tag: tiptap.tagName, classes: tiptap.className?.substring(0, 80), contenteditable: tiptap.getAttribute('contenteditable'), role: tiptap.getAttribute('role'), ariaLabel: tiptap.getAttribute('aria-label'), visible: tiptap.getBoundingClientRect().width > 0 } : null,
      proseMirror: pm ? { tag: pm.tagName, classes: pm.className?.substring(0, 80), contenteditable: pm.getAttribute('contenteditable') } : null,
      contenteditable: ce ? { tag: ce.tagName, classes: ce.className?.substring(0, 80), role: ce.getAttribute('role'), ariaLabel: ce.getAttribute('aria-label') } : null,
      ariaComment: editor ? { tag: editor.tagName, classes: editor.className?.substring(0, 80) } : null,
      commentButtons: commentBtns,
      pageUrl: window.location.href
    };
  });
  
  console.log('=== Page Elements ===');
  console.log(JSON.stringify(elements, null, 2));
  
  await page.screenshot({ path: '/tmp/comment-page3.png' });
  await browser.close();
}

debug().catch(e => console.error(e));
