import { chromium } from 'playwright-extra';
import * as fs from 'fs';
import * as path from 'path';

const stealth = require('puppeteer-extra-plugin-stealth')();
chromium.use(stealth);

async function testCampaign() {
  console.log('=== Testing Campaign Execution Manually ===\n');
  
  // Load session files
  const sessionPath = '/home/shiva/Documents/linkedin-camp/testscripts';
  const cookiesPath = path.join(sessionPath, 'cookies.json');
  const fpPath = path.join(sessionPath, 'fingerprint.json');
  
  if (!fs.existsSync(cookiesPath) || !fs.existsSync(fpPath)) {
    console.log('ERROR: Session files not found');
    return;
  }
  
  const cookies = JSON.parse(fs.readFileSync(cookiesPath, 'utf8'));
  const fingerprint = JSON.parse(fs.readFileSync(fpPath, 'utf8'));
  
  console.log('Session loaded:', cookies.length, 'cookies');
  
  // Launch browser
  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox']
  });
  
  const context = await browser.newContext({
    userAgent: fingerprint.userAgent,
    viewport: { width: 1920, height: 1080 },
    locale: 'en-IN',
    timezoneId: 'Asia/Kolkata'
  });
  
  await context.addCookies(cookies);
  const page = await context.newPage();
  
  try {
    // Step 1: Profile Visit
    console.log('\n[1] Profile Visit...');
    await page.goto('https://www.linkedin.com/in/shiva-singh-genai-llm/', { 
      waitUntil: 'domcontentloaded',
      timeout: 60000 
    });
    
    const wait = (ms: number) => new Promise(res => setTimeout(res, ms));
    await wait(8000);
    
    // Check current URL - redirect to login means session invalid
    const url = page.url();
    console.log('URL after visit:', url);
    
    if (url.includes('login') || url.includes('auth')) {
      console.log('ERROR: Session invalid - redirected to login');
      return;
    }
    
    // Extract name
    const name = await page.$eval('h1', el => el.textContent).catch(() => null);
    console.log('Profile name:', name);
    
    // Check if Message button exists (meaning connected)
    const messageBtn = await page.$('button:has-text("Message")');
    const connected = !!messageBtn;
    console.log('Connected:', connected);
    
    // Check Connect button
    const connectBtn = await page.$('[aria-label*="to connect"]');
    console.log('Connect button visible:', !!connectBtn);
    
    // Step 2: Comment on post if connected
    console.log('\n[2] Checking posts...');
    const activityUrl = 'https://www.linkedin.com/in/shiva-singh-genai-llm/recent-activity/shares/';
    await page.goto(activityUrl, { waitUntil: 'domcontentloaded' });
    await wait(5000);
    
    // Look for posts
    const posts = await page.$$('div[data-urn*="urn:li:"]');
    console.log('Posts found:', posts.length);
    
    // Step 3: Connect
    console.log('\n[3] Connect...');
    await page.goto('https://www.linkedin.com/in/shiva-singh-genai-llm/', { 
      waitUntil: 'domcontentloaded' 
    });
    await wait(5000);
    
    if (connectBtn) {
      await connectBtn.click();
      await wait(2000);
      
      // Click send in modal
      const sendBtn = await page.$('button[aria-label="Send now"], button:has-text("Send")');
      if (sendBtn) {
        await sendBtn.click();
        console.log('Connection request sent!');
        await wait(3000);
      }
    }
    
    console.log('\n=== Campaign Test Complete ===');
    console.log('Result: Execution completed');
    
  } catch (e: any) {
    console.log('ERROR:', e.message);
  } finally {
    await browser.close();
  }
}

testCampaign().then(() => {
  console.log('\nDone');
  process.exit(0);
}).catch(e => {
  console.error(e);
  process.exit(1);
});