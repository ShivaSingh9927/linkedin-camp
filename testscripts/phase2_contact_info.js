// const { chromium } = require('playwright-extra');
// const stealth = require('puppeteer-extra-plugin-stealth')();
// const fs = require('fs');

// chromium.use(stealth);

// const wait = (ms) => new Promise(res => setTimeout(res, ms));

// // ---------------- SAFE NAVIGATION ----------------
// async function safeGoto(page, url, retries = 3) {
//   for (let i = 0; i < retries; i++) {
//     try {
//       console.log(`🌐 Navigating (${i + 1}/${retries}) → ${url}`);
//       await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
//       return true;
//     } catch (err) {
//       console.log(`⚠️ Retry ${i + 1} failed: ${err.message}`);
//       if (i === retries - 1) throw err;
//       await wait(3000);
//     }
//   }
// }

// // ---------------- MAIN SCRIPT ----------------
// async function testContactExtraction() {
//   let cookies, userAgent;

//   try {
//     cookies = JSON.parse(fs.readFileSync('./cookies.json'));
//     const fp = JSON.parse(fs.readFileSync('./fingerprint.json'));
//     userAgent = fp.userAgent;
//   } catch {
//     console.log('❌ Missing session files (cookies.json / fingerprint.json).');
//     return;
//   }

//   const browser = await chromium.launch({ headless: false, args: ['--no-sandbox'] });
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

//   // Block heavy resources
//   await page.route('**/*', (route) => {
//     const type = route.request().resourceType();
//     const url = route.request().url();
//     if (['image', 'media', 'font'].includes(type) || url.includes('analytics') || url.includes('ads')) {
//       return route.abort();
//     }
//     return route.continue();
//   });

//   const profileUrl = "https://www.linkedin.com/in/shiva-singh-genai-llm/";

//   const result = {
//     profile: profileUrl,
//     contactDetails: {
//       email: null,
//       phone: null,
//       connectedDate: null,
//       profileLink: null
//     }
//   };

//   try {
//     // ---------------- WARMUP ----------------
//     console.log('\n🔥 Warming up...');
//     await safeGoto(page, 'https://www.linkedin.com/feed/');
//     await wait(3000);

//     // ---------------- OPEN PROFILE ----------------
//     console.log(`\n👤 Opening profile: ${profileUrl}`);
//     await safeGoto(page, profileUrl);
//     await wait(4000);

//     // ---------------- EXTRACT CONTACT INFO ----------------
//     console.log('\n📇 Opening Contact Info modal...');
//     try {
//       const contactBtn = page.locator('a[href*="/overlay/contact-info/"]').first();
      
//       if (await contactBtn.isVisible()) {
//         await contactBtn.evaluate(el => el.click());
//         await wait(2000); // Wait for modal to fully animate in
        
//         console.log('🔍 Parsing structured data based on new HTML...');
        
//         const extractedData = await page.evaluate(() => {
//             const data = { email: null, phone: null, connectedDate: null, profileLink: null };
            
//             // Get all the labels in the modal (e.g., "Email", "Phone", "Shiva's profile")
//             const labels = Array.from(document.querySelectorAll('div[data-component-type="LazyColumn"] p:first-child'));

//             for (let label of labels) {
//                 const labelText = label.innerText.trim();
//                 // The actual value is usually in the next sibling <p> element
//                 const valueNode = label.nextElementSibling;
                
//                 if (valueNode) {
//                     if (labelText === 'Email') {
//                         data.email = valueNode.innerText.trim();
//                     } else if (labelText === 'Phone') {
//                         // For phones, LinkedIn often puts the number and "(Mobile)" in separate spans
//                         // e.g., <span class="_312d08bc">9368084140</span>
//                         const firstSpan = valueNode.querySelector('span');
//                         data.phone = firstSpan ? firstSpan.innerText.trim() : valueNode.innerText.trim();
//                     } else if (labelText === 'Connected since') {
//                         data.connectedDate = valueNode.innerText.trim();
//                     } else if (labelText.includes('profile')) {
//                         // E.g., "Shiva's profile"
//                         data.profileLink = valueNode.innerText.trim();
//                     }
//                 }
//             }

//             return data;
//         });

//         result.contactDetails = extractedData;

//         // Close the modal cleanly
//         const closeBtn = page.locator('button[aria-label="Dismiss"]').first();
//         if (await closeBtn.isVisible()) {
//             await closeBtn.evaluate(el => el.click());
//         } else {
//             await page.keyboard.press('Escape');
//         }
//         await wait(1000);

//       } else {
//         console.log('⚠️ Contact info button not visible.');
//       }
//     } catch (e) {
//       console.log(`⚠️ Failed to extract contact info: ${e.message}`);
//     }

//   } catch (err) {
//     console.log('\n❌ FATAL ERROR:', err.message);
//   }

//   console.log('\n========== FINAL RESULT ==========\n');
//   console.log(JSON.stringify(result, null, 2));

//   await wait(4000); 
//   await browser.close();
// }

// testContactExtraction();

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
async function testContactAndAboutExtraction() {
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

  // Block heavy resources
  await page.route('**/*', (route) => {
    const type = route.request().resourceType();
    const url = route.request().url();
    if (['image', 'media', 'font'].includes(type) || url.includes('analytics') || url.includes('ads')) {
      return route.abort();
    }
    return route.continue();
  });

  const profileUrl = "https://www.linkedin.com/in/shiva-singh-genai-llm/";

  const result = {
    profile: profileUrl,
    aboutInfo: null,
    contactDetails: {
      email: null,
      phone: null,
      connectedDate: null,
      profileLink: null
    }
  };

  try {
    // ---------------- WARMUP ----------------
    console.log('\n🔥 Warming up...');
    await safeGoto(page, 'https://www.linkedin.com/feed/');
    await wait(3000);

    // ---------------- OPEN PROFILE ----------------
    console.log(`\n👤 Opening profile: ${profileUrl}`);
    await safeGoto(page, profileUrl);
    await wait(4000);
    
    // Scroll a bit to trigger dynamic DOM rendering for the About section
    await page.mouse.wheel(0, 800);
    await wait(2000);

    // ---------------- EXTRACT CONTACT INFO ----------------
    console.log('\n📇 Opening Contact Info modal...');
    try {
      const contactBtn = page.locator('a[href*="/overlay/contact-info/"]').first();
      
      if (await contactBtn.isVisible()) {
        await contactBtn.evaluate(el => el.click());
        await wait(2000);
        
        console.log('🔍 Parsing structured contact data...');
        const extractedData = await page.evaluate(() => {
            const data = { email: null, phone: null, connectedDate: null, profileLink: null };
            const labels = Array.from(document.querySelectorAll('div[data-component-type="LazyColumn"] p:first-child'));

            for (let label of labels) {
                const labelText = label.innerText.trim();
                const valueNode = label.nextElementSibling;
                
                if (valueNode) {
                    if (labelText === 'Email') {
                        data.email = valueNode.innerText.trim();
                    } else if (labelText === 'Phone') {
                        const firstSpan = valueNode.querySelector('span');
                        data.phone = firstSpan ? firstSpan.innerText.trim() : valueNode.innerText.trim();
                    } else if (labelText === 'Connected since') {
                        data.connectedDate = valueNode.innerText.trim();
                    } else if (labelText.includes('profile')) {
                        data.profileLink = valueNode.innerText.trim();
                    }
                }
            }
            return data;
        });

        result.contactDetails = extractedData;

        // Close modal
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
    } catch (e) {
      console.log(`⚠️ Failed to extract contact info: ${e.message}`);
    }

    // ---------------- EXTRACT ABOUT INFO ----------------
    console.log('\n📖 Extracting About info...');
    try {
      // Robust locator: Find the section that contains the div with id="about", or an h2 with the text "About"
      const aboutSection = page.locator('section:has(div[id="about"]), section:has(h2:has-text("About"))').first();
      
      if (await aboutSection.isVisible()) {
        // Look for the "... more" button specifically inside the About section
        const moreBtn = aboutSection.locator('button[data-testid="expandable-text-button"]').first();
        
        if (await moreBtn.isVisible()) {
            console.log('🖱️ Clicking "... more" to expand About section...');
            await moreBtn.evaluate(el => el.click());
            await wait(1000);
        }

        // Grab the text from the expandable text box
        const aboutBox = aboutSection.locator('[data-testid="expandable-text-box"]').first();
        if (await aboutBox.isVisible()) {
            result.aboutInfo = await aboutBox.innerText();
            console.log('✅ About info extracted successfully!');
        } else {
            console.log('⚠️ About text box not found within the About section.');
        }
      } else {
          console.log('⚠️ About section not found on this profile.');
      }
    } catch (e) {
      console.log(`⚠️ Failed to extract About info: ${e.message}`);
    }

  } catch (err) {
    console.log('\n❌ FATAL ERROR:', err.message);
  }

  console.log('\n========== FINAL RESULT ==========\n');
  console.log(JSON.stringify(result, null, 2));

  await wait(4000); 
  await browser.close();
}

testContactAndAboutExtraction();