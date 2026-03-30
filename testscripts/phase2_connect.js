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

// ---------------- MAIN ----------------
async function testFollowConnect() {
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

  // Block heavy resources for speed
  await page.route('**/*', (route) => {
    const type = route.request().resourceType();
    const url = route.request().url();
    if (['image', 'media', 'font'].includes(type) || url.includes('analytics') || url.includes('ads')) {
      return route.abort();
    }
    return route.continue();
  });

  const result = {
    profile: "https://www.linkedin.com/in/shiva-singh-genai-llm/",
    actions: { followed: false, connected: false }
  };

  try {
    // ---------------- WARMUP ----------------
    console.log('\n🔥 Warming up...');
    await safeGoto(page, 'https://www.linkedin.com/feed/');
    await wait(randomRange(3000, 5000));

    // ---------------- PROFILE ----------------
    console.log(`\n👤 Opening profile: ${result.profile}`);
    await safeGoto(page, result.profile);
    await wait(4000);
    
    // Scroll a bit to trigger dynamic DOM rendering
    await page.mouse.wheel(0, 600);
    await wait(2000);

    // ---------------- FOLLOW ----------------
    console.log('\n➕ Attempting to Follow...');
    try {
      let followBtn = page.locator('button:has(span:text-is("Follow"))').first();
      
      // If Follow isn't primary, check the "More" menu
      if (!(await followBtn.isVisible())) {
        console.log('🔍 Follow button not visible, checking "More" menu...');
        const moreBtn = page.locator('button:has(span:text-is("More"))').first();
        
        if (await moreBtn.isVisible()) {
          // Use force click to bypass sticky headers
          await moreBtn.evaluate(el => el.click());
          await wait(1500); 
          followBtn = page.locator('[role="menuitem"]:has-text("Follow"), [role="menuitem"] span:text-is("Follow")').first();
        }
      }

      if (await followBtn.isVisible()) {
        await followBtn.evaluate(el => el.click());
        result.actions.followed = true;
        console.log('✅ Follow button clicked!');
        await wait(2000); // Give menu time to close if it was open
        
        // Refresh page or press Escape to close the More dropdown safely before Connecting
        await page.keyboard.press('Escape');
      } else {
        console.log('⚠️ Follow button not found anywhere (might already be following).');
      }
    } catch (e) {
      console.log(`⚠️ Follow failed: ${e.message}`);
    }

    await wait(randomRange(2000, 4000));

    // ---------------- CONNECT ----------------
    console.log('\n🤝 Attempting to Connect...');
    try {
      let connectBtn = page.locator('[aria-label*="to connect"]').first();

      // If not on the main screen, check "More" menu
      if (!(await connectBtn.isVisible())) {
        console.log('🔍 Connect button not visible, checking "More" menu...');
        const moreBtn = page.locator('button:has(span:text-is("More"))').first();
        
        if (await moreBtn.isVisible()) {
          await moreBtn.evaluate(el => el.click());
          await wait(1500);
          connectBtn = page.locator('[aria-label*="to connect"], a[role="menuitem"]:has-text("Connect")').first();
        }
      }

      if (await connectBtn.isVisible()) {
        // ULTRA-STABLE CLICK: Bypasses sticky headers entirely
        await connectBtn.evaluate(el => el.click());
        console.log('✅ Connect button clicked! now pending for approval, Handling modal...');
        await wait(3000); // Wait for modal to render

        // --- HANDLE THE CONNECTION MODAL ---
        const sendBtn = page.locator('button[aria-label="Send now"], button:has(span:text-is("Send without a note")), button:has(span:text-is("Send"))').first();
        
        if (await sendBtn.isVisible()) {
            await sendBtn.evaluate(el => el.click());
            result.actions.connected = true;
            console.log('✅ Connection request sent!, now pending for approval');
        } else {
            console.log('⚠️ Clicked Connect, but could not find the final "Send" button in the modal.');
        }
      } else {
        console.log('⚠️ Connect button could not be found anywhere on the page.');
      }
    } catch (e) {
      console.log(`⚠️ Connect failed: ${e.message}`);
    }

  } catch (err) {
    console.log('\n❌ FATAL ERROR:', err.message);
  }

  console.log('\n========== FINAL RESULT ==========\n');
  console.log(JSON.stringify(result, null, 2));

  // Leave browser open slightly longer so you can see what happened
  await wait(8000); 
  await browser.close();
}

testFollowConnect();