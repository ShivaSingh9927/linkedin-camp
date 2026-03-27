const { chromium } = require('playwright-extra');
const stealth = require('puppeteer-extra-plugin-stealth')();
const fs = require('fs');

chromium.use(stealth);

const wait = (ms) => new Promise(res => setTimeout(res, ms));

// ---------------- SAFE NAVIGATION ----------------
async function safeGoto(page, url, retries = 3) {
  for (let i = 0; i < retries; i++) {
    try {
      console.log(`🌐 Navigating (${i + 1}/${retries}) → ${url}`);
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
      return true;
    } catch (err) {
      console.log(`⚠️ Retry ${i + 1} failed: ${err.message}`);
      if (i === retries - 1) throw err;
      await wait(3000);
    }
  }
}

// ---------------- MAIN SCRIPT ----------------
async function createLinkedInPost() {
  let cookies, userAgent;

  try {
    cookies = JSON.parse(fs.readFileSync('./cookies.json'));
    const fp = JSON.parse(fs.readFileSync('./fingerprint.json'));
    userAgent = fp.userAgent;
  } catch {
    console.log('❌ Missing session files (cookies.json / fingerprint.json).');
    return;
  }

  const browser = await chromium.launch({ headless: false, args: ['--no-sandbox'] });
  const context = await browser.newContext({
    userAgent,
    viewport: null,
    locale: 'en-IN',
    timezoneId: 'Asia/Kolkata',
    proxy: {
      server: 'http://disp.oxylabs.io:8001',
      username: 'user-shivasingh_clgdY',
      password: 'Iamironman_3'
    }
  });

  await context.addCookies(cookies);
  const page = await context.newPage();

  page.setDefaultTimeout(30000);
  page.setDefaultNavigationTimeout(60000);

  // Block heavy resources (but allow scripts so the text editor works)
  await page.route('**/*', (route) => {
    const type = route.request().resourceType();
    const url = route.request().url();
    if (['image', 'media', 'font'].includes(type) || url.includes('analytics') || url.includes('ads')) {
      return route.abort();
    }
    return route.continue();
  });

  const postContent = "Testing agentic workflow automation. 🚀\n\nSkills vs Tools is the future of autonomous systems. What are your thoughts?\n\n#AI #Automation #Playwright";

  try {
    // ---------------- WARMUP ----------------
    console.log('\n🔥 Warming up...');
    await safeGoto(page, 'https://www.linkedin.com/feed/');
    await wait(4000);

    // ---------------- OPEN CREATION MODAL ----------------
    console.log('\n📝 Attempting to open post creation modal...');
    
    // Target the specific div/button you provided
    const startPostBtn = page.locator('div[aria-label="Start a post"], button:has-text("Start a post")').first();
    
    if (await startPostBtn.isVisible()) {
        await startPostBtn.click();
        console.log('✅ Clicked "Start a post". Waiting for modal to render...');
        await wait(2500); // Give the React modal time to animate and load the Quill editor
    } else {
        throw new Error('Could not find the "Start a post" button on the feed.');
    }

    // ---------------- ENTER TEXT CONTENT ----------------
    console.log('\n⌨️ Typing post content...');
    
    // Target the Quill editor you identified
    const editor = page.locator('.ql-editor[contenteditable="true"]').first();
    
    if (await editor.isVisible()) {
        // Clear any placeholder text just in case
        await editor.click();
        await wait(500);
        
        // Use type instead of fill to simulate human typing and trigger LinkedIn's React state
        await editor.type(postContent, { delay: 30 });
        console.log('✅ Content typed successfully!');
        await wait(2000); 
    } else {
        throw new Error('Could not find the text editor (.ql-editor).');
    }

    // ---------------- SUBMIT POST ----------------
    console.log('\n🚀 Attempting to publish post...');
    
    // Target the primary Post button you provided
    const publishBtn = page.locator('button.share-actions__primary-action:has-text("Post")').first();
    
    if (await publishBtn.isVisible()) {
        const isDisabled = await publishBtn.getAttribute('disabled');
        if (isDisabled !== null) {
            console.log('⚠️ Post button is disabled. Jiggling input to force React update...');
            await page.keyboard.press('Space');
            await page.keyboard.press('Backspace');
            await wait(1000);
        }

        await publishBtn.click();
        console.log('✅ Clicked Publish!');
        
        // Wait for the modal to close and the success toast to appear
        await wait(5000);
        console.log('🎉 Post successfully published!');
    } else {
        throw new Error('Could not find the final Post button.');
    }

  } catch (err) {
    console.log('\n❌ FATAL ERROR:', err.message);
  }

  await wait(3000); 
  await browser.close();
}

createLinkedInPost();