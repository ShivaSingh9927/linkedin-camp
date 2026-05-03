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
  
  const info = await page.evaluate(() => {
    const isLogin = window.location.href.includes('/login') || window.location.href.includes('/authwall');
    
    const allButtons = Array.from(document.querySelectorAll('button'));
    const actionBtns = allButtons.filter(b => {
      const text = b.textContent?.trim() || '';
      return ['Like', 'Comment', 'Repost', 'Celebrate', 'Support', 'Love', 'Insightful', 'Curious'].some(k => text.includes(k));
    }).map(b => ({ text: b.textContent?.trim(), disabled: b.disabled }));
    
    const commentSection = Array.from(document.querySelectorAll('div, section, article')).find(el => {
      const cls = el.className || '';
      return typeof cls === 'string' && (cls.includes('comment') || cls.includes('Comment'));
    });
    
    return {
      isLogin,
      url: window.location.href,
      actionButtons: actionBtns.slice(0, 10),
      hasCommentSection: !!commentSection,
      commentSectionTag: commentSection?.tagName || null
    };
  });
  
  console.log('=== Page Info ===');
  console.log(JSON.stringify(info, null, 2));
  
  // Use Playwright locators to check
  const likeBtn = page.locator('button:has-text("Like")').first();
  const commentBtn = page.locator('button:has-text("Comment")').first();
  
  const likeVisible = await likeBtn.isVisible({ timeout: 5000 }).catch(() => false);
  const commentVisible = await commentBtn.isVisible({ timeout: 5000 }).catch(() => false);
  console.log('Like button visible:', likeVisible);
  console.log('Comment button visible:', commentVisible);
  
  // Scroll to bottom
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await new Promise(r => setTimeout(r, 5000));
  
  const ce = page.locator('[contenteditable="true"]').first();
  const ceVisible = await ce.isVisible({ timeout: 5000 }).catch(() => false);
  console.log('Contenteditable visible after scroll:', ceVisible);
  
  const rt = page.locator('[role="textbox"]').first();
  const rtVisible = await rt.isVisible({ timeout: 5000 }).catch(() => false);
  console.log('Role textbox visible after scroll:', rtVisible);
  
  const tiptap = page.locator('.tiptap.ProseMirror').first();
  const tpVisible = await tiptap.isVisible({ timeout: 5000 }).catch(() => false);
  console.log('TipTap visible after scroll:', tpVisible);
  
  await page.screenshot({ path: '/tmp/comment-page4.png', fullPage: true });
  
  await browser.close();
}

debug().catch(e => console.error(e));
