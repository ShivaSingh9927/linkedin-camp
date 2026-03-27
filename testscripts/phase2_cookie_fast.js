// const { chromium } = require('playwright-extra');
// const stealth = require('puppeteer-extra-plugin-stealth')();
// const fs = require('fs');
// const path = require('path');

// chromium.use(stealth);

// const wait = (ms) => new Promise(res => setTimeout(res, ms));
// const randomRange = (min, max) =>
//   Math.floor(Math.random() * (max - min + 1) + min);

// // ---------------------
// // SAFE NAVIGATION (KEY FIX)
// // ---------------------
// async function safeGoto(page, url, retries = 3) {
//   for (let i = 0; i < retries; i++) {
//     try {
//       console.log(`🌐 Navigating (${i + 1}/${retries}) → ${url}`);

//       await page.goto(url, {
//         waitUntil: 'domcontentloaded',
//         timeout: 60000
//       });

//       return true;

//     } catch (err) {
//       console.log(`⚠️ Retry ${i + 1} failed: ${err.message}`);

//       if (i === retries - 1) throw err;

//       await wait(3000);
//     }
//   }
// }

// // ---------------------
// // MAIN
// // ---------------------
// async function startUltraStable() {

//   // ---------------- LOAD SESSION ----------------
//   let cookies, userAgent;

//   try {
//     cookies = JSON.parse(fs.readFileSync('./cookies.json'));
//     const fp = JSON.parse(fs.readFileSync('./fingerprint.json'));
//     userAgent = fp.userAgent;
//   } catch {
//     console.log('❌ Missing session files');
//     return;
//   }

//   const browser = await chromium.launch({
//     headless: false,
//     args: ['--no-sandbox']
//   });

//   const context = await browser.newContext({
//     userAgent,
//     viewport: null,
//     locale: 'en-IN',
//     timezoneId: 'Asia/Kolkata',
//     proxy: {
//       server: 'http://disp.oxylabs.io:8001',
//       username: 'user-shivasingh_clgdY',
//       password: 'Iamironman_3'
//     }
//   });

//   await context.addCookies(cookies);

//   const page = await context.newPage();

//   page.setDefaultTimeout(30000);
//   page.setDefaultNavigationTimeout(60000);

//   // ---------------- NETWORK OPTIMIZATION ----------------
//   await page.route('**/*', (route) => {
//     const url = route.request().url();
//     const type = route.request().resourceType();

//     if (
//       ['image', 'media', 'font'].includes(type) ||
//       url.includes('analytics') ||
//       url.includes('ads') ||
//       url.includes('tracking') ||
//       url.includes('doubleclick')
//     ) {
//       return route.abort();
//     }

//     return route.continue();
//   });

//   // Disable animations
//   await page.addInitScript(() => {
//     const style = document.createElement('style');
//     style.innerHTML = `*{animation:none!important;transition:none!important}`;
//     document.head.appendChild(style);
//   });

//   const result = {
//     profile: null,
//     contactInfo: null,
//     postContent: null,
//     actions: {
//       followed: false,
//       connected: false,
//       liked: false,
//       commented: false,
//       messaged: false
//     }
//   };

//   try {

//     const profile = "https://www.linkedin.com/in/shiva-singh-genai-llm/";
//     result.profile = profile;

//     // ---------------- STEP 1: WARMUP ----------------
//     console.log('\n🔥 Warming up session...');
//     await safeGoto(page, 'https://www.linkedin.com/feed/');
//     await wait(5000);

//     // ---------------- STEP 2: PROFILE ----------------
//     console.log('\n👤 Opening profile...');
//     try {
//       await safeGoto(page, profile);
//     } catch {
//       console.log('⚠️ Retry via feed...');
//       await safeGoto(page, 'https://www.linkedin.com/feed/');
//       await wait(3000);
//       await safeGoto(page, profile);
//     }

//     await wait(5000);

//     // ---------------- STEP 3: CONTACT INFO ----------------
//     console.log('\n📇 Extracting contact info...');
//     const contactBtn = await page.$('a[href*="contact-info"]');

//     if (contactBtn) {
//       await page.evaluate(el => el.click(), contactBtn);
//       await wait(2000);

//       result.contactInfo = await page.$eval('.pv-contact-info', el => el.innerText).catch(() => null);

//       await page.keyboard.press('Escape');
//     }

//     // ---------------- STEP 4: POST CONTENT ----------------
//     console.log('\n📝 Extracting post...');
//     result.postContent = await page
//       .$eval('[data-testid="expandable-text-box"]', el => el.innerText)
//       .catch(() => null);

//     // ---------------- STEP 5: FOLLOW ----------------
//     console.log('\n➕ Follow...');
//     const followBtn = await page.$('button[aria-label^="Follow"]');

//     if (followBtn) {
//       await page.evaluate(el => el.click(), followBtn);
//       result.actions.followed = true;
//     }

//     await wait(randomRange(2000, 4000));

//     // ---------------- STEP 6: CONNECT ----------------
//     console.log('\n🤝 Connect...');
//     const connectBtn = await page.$('a[href*="custom-invite"]');

//     if (connectBtn) {
//       await page.evaluate(el => el.click(), connectBtn);
//       await wait(2000);

//       const sendBtn = await page.$('button:has-text("Send")');

//       if (sendBtn) {
//         await page.evaluate(el => el.click(), sendBtn);
//         result.actions.connected = true;
//       }
//     }

//     await wait(randomRange(2000, 4000));

//     // ---------------- STEP 7: LIKE ----------------
//     console.log('\n👍 Like...');
//     const likeBtn = await page.$('button[aria-label*="Reaction button"]');

//     if (likeBtn) {
//       const label = await page.evaluate(el => el.getAttribute('aria-label'), likeBtn);

//       if (label && label.includes('no reaction')) {
//         await page.evaluate(el => el.click(), likeBtn);
//         result.actions.liked = true;
//       }
//     }

//     await wait(randomRange(2000, 4000));

//     // ---------------- STEP 8: COMMENT ----------------
//     console.log('\n💬 Comment...');
//     const commentBtn = await page.$('button:has-text("Comment")');

//     if (commentBtn) {
//       await page.evaluate(el => el.click(), commentBtn);
//       await wait(2000);

//       const box = await page.$('[contenteditable="true"]');

//       if (box) {
//         await box.type("Great post! 🚀", { delay: 30 });

//         const postBtn = await page.$('button:has-text("Post")');

//         if (postBtn) {
//           await page.evaluate(el => el.click(), postBtn);
//           result.actions.commented = true;
//         }
//       }
//     }

//     await wait(randomRange(3000, 5000));

//     // ---------------- STEP 9: MESSAGE ----------------
//     console.log('\n📩 Messaging...');
//     const composeUrl = await page.evaluate(() => {
//       const a = document.querySelector('a[href*="/messaging/compose"]');
//       return a ? a.href : null;
//     });

//     if (composeUrl) {
//       await safeGoto(page, composeUrl);
//       await wait(4000);

//       const box = await page.$('[role="textbox"]');

//       if (box) {
//         await box.type("Hi Shiva, really liked your GenAI work!", { delay: 30 });

//         const sendBtn = await page.$('button.msg-form__send-button');

//         if (sendBtn) {
//           await page.evaluate(el => el.click(), sendBtn);
//           result.actions.messaged = true;
//         }
//       }
//     }

//   } catch (err) {
//     console.log('\n❌ ERROR:', err.message);
//   }

//   console.log('\n========== FINAL RESULT ==========\n');
//   console.log(JSON.stringify(result, null, 2));

//   await wait(15000);
//   await browser.close();
// }

// startUltraStable();