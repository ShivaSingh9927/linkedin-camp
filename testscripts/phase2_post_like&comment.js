const { chromium } = require('playwright-extra');
const stealth = require('puppeteer-extra-plugin-stealth')();
const fs = require('fs');

chromium.use(stealth);

const wait = (ms) => new Promise(res => setTimeout(res, ms));
const randomRange = (min, max) => Math.floor(Math.random() * (max - min + 1) + min);

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
async function startUltraStable() {
  let cookies, userAgent;

  try {
    cookies = JSON.parse(fs.readFileSync('./cookies.json'));
    const fp = JSON.parse(fs.readFileSync('./fingerprint.json'));
    userAgent = fp.userAgent;
  } catch {
    console.log('❌ Missing session files (cookies.json / fingerprint.json).');
    return;
  }

  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
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

  // Block heavy resources
  await page.route('**/*', (route) => {
    const type = route.request().resourceType();
    const url = route.request().url();
    if (['image', 'media', 'font'].includes(type) || url.includes('analytics') || url.includes('ads')) {
      return route.abort();
    }
    return route.continue();
  });

  // Target Profile
  const profileUrl = "https://www.linkedin.com/in/shiva-singh-genai-llm/";

  const result = {
    profile: profileUrl,
    contactInfo: null,
    postUrl: null,
    postContent: null,
    actions: { liked: false, commented: false }
  };

  try {
    // ---------------- 1. WARMUP ----------------
    console.log('\n🔥 Warming up...');
    await safeGoto(page, 'https://www.linkedin.com/feed/');
    await wait(randomRange(3000, 5000));

    // ---------------- 2. PROFILE & CONTACT INFO ----------------
    console.log(`\n👤 Opening profile: ${profileUrl}`);
    await safeGoto(page, profileUrl);
    await wait(4000);
    
    await page.mouse.wheel(0, 600);
    await wait(2000);

    console.log('\n📇 Extracting contact info...');
    try {
      const contactBtn = page.locator('a[href*="/overlay/contact-info/"]').first();
      if (await contactBtn.isVisible()) {
        await contactBtn.evaluate(el => el.click());
        await wait(2000);
        result.contactInfo = await page.$eval('.pv-contact-info, section.pv-contact-info__contact-type', el => el.innerText).catch(() => null);
        
        const closeBtn = page.locator('button[aria-label="Dismiss"]').first();
        if (await closeBtn.isVisible()) {
            await closeBtn.evaluate(el => el.click());
        } else {
            await page.keyboard.press('Escape');
        }
        await wait(1000);
      } else {
        console.log('⚠️ Contact info button not visible.');
      }
    } catch {
      console.log('⚠️ Failed to extract contact info.');
    }

    // ---------------- 3. FIND RECENT POST ----------------
    console.log('\n🧭 Navigating to user\'s "Posts" feed...');
    const activityUrl = profileUrl.replace(/\/$/, '') + '/recent-activity/shares/';
    await safeGoto(page, activityUrl);
    await wait(4000);
    
    await page.mouse.wheel(0, 500);
    await wait(2000);

    const postLink = await page.evaluate(() => {
      const postWrapper = document.querySelector('div[data-urn*="urn:li:activity"], div[data-urn*="urn:li:ugcPost"], div[data-urn*="urn:li:share"]');
      if (postWrapper) {
        const urn = postWrapper.getAttribute('data-urn');
        return `https://www.linkedin.com/feed/update/${urn}/`;
      }
      const links = Array.from(document.querySelectorAll('a[href*="/feed/update/urn:li:"]'));
      for (let link of links) {
        if (!link.href.includes('?commentUrn=')) {
          return link.href.split('?')[0]; 
        }
      }
      return null;
    });

    if (postLink) {
      result.postUrl = postLink;
      console.log(`🌐 Found latest post! Navigating to: ${postLink}`);
      await safeGoto(page, postLink);
      await wait(5000); 

      // ---------------- 4. EXTRACT POST TEXT ----------------
      console.log('\n📝 Extracting post content...');
      try {
        const moreBtn = page.locator('button[data-testid="expandable-text-button"]').first();
        if (await moreBtn.isVisible()) {
          await moreBtn.evaluate(el => el.click());
          await wait(1000);
        }
        result.postContent = await page.$eval('.update-components-text, [data-testid="expandable-text-box"]', el => el.innerText).catch(() => null);
      } catch {
        console.log('⚠️ Failed to extract post text.');
      }

      // ---------------- 5. LIKE ----------------
      console.log('\n👍 Attempting to Like...');
      try {
        const likeBtn = page.locator('button:has(span:text-is("Like"))').first();
        if (await likeBtn.isVisible()) {
          const isPressed = await likeBtn.getAttribute('aria-pressed');
          if (isPressed !== 'true') {
            await likeBtn.evaluate(el => el.click());
            result.actions.liked = true;
            console.log('✅ Liked the post!');
          } else {
            console.log('⚠️ Post is already liked.');
            result.actions.liked = true;
          }
        }
      } catch (e) {
        console.log(`⚠️ Failed to Like: ${e.message}`);
      }

      await wait(randomRange(2000, 3000));

      // ---------------- 6. COMMENT ----------------
      console.log('\n💬 Attempting to Comment...');
      try {
        const commentBox = page.locator('div[role="textbox"][aria-label*="Add a comment"], div[data-placeholder="Add a comment…"]').first();
        
        if (await commentBox.isVisible()) {
            await commentBox.scrollIntoViewIfNeeded();
            await commentBox.click(); 
            await wait(1000);
            
            await commentBox.type("Excellent insights here! 🚀", { delay: 40 });
            await wait(1500); 

            // Looking specifically for the blue primary button
            const submitBtn = page.locator('button.comments-comment-box__submit-button, button.artdeco-button--primary:has-text("Comment"), button.artdeco-button--primary:has-text("Post")').first();
            
            if (await submitBtn.isVisible()) {
                // Safety check: if button is disabled, jiggle the input to trigger React
                const disabled = await submitBtn.getAttribute('disabled');
                if (disabled !== null) {
                    console.log('⚠️ Button disabled. Jiggling input to trigger React state...');
                    await page.keyboard.press('Space');
                    await page.keyboard.press('Backspace');
                    await wait(1000);
                }

                // USE A TRUSTED PLAYWRIGHT CLICK (not evaluate) for React forms
                await submitBtn.click({ force: true });
                result.actions.commented = true;
                console.log('✅ Comment submitted!');
                
                console.log('⏳ Waiting 4 seconds for comment to process...');
                await wait(4000); 
            } else {
                console.log('⚠️ Submit button not found after typing.');
            }
        }
      } catch (e) {
        console.log(`⚠️ Failed to Comment: ${e.message}`);
      }
    } else {
        console.log('⚠️ No recent posts found for this user.');
    }

    await wait(randomRange(2000, 4000));

    
  } catch (err) {
    console.log('\n❌ FATAL ERROR:', err.message);
  }

  console.log('\n========== FINAL RESULT ==========\n');
  console.log(JSON.stringify(result, null, 2));

  await wait(5000); 
  await browser.close();
}

startUltraStable();