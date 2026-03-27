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
// async function testExperienceExtraction() {
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
//     currentExperience: {
//       companyUrl: null,
//       details: []
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
    
//     // ---------------- SCROLL TO LOAD EXPERIENCE ----------------
//     console.log('\n📜 Scrolling to trigger lazy-loaded sections...');
//     await page.locator('body').click({ force: true }).catch(() => {});
    
//     for (let i = 0; i < 8; i++) {
//         await page.keyboard.press('PageDown');
//         await wait(1000);
//     }

//     // ---------------- EXTRACT EXPERIENCE INFO ----------------
//     console.log('\n💼 Extracting most recent Experience...');
    
//     const extractedExp = await page.evaluate(() => {
//         // 1. Find the Experience section header
//         const textNodes = Array.from(document.querySelectorAll('span[aria-hidden="true"], h2 span, div span, h2'));
//         const expNode = textNodes.find(node => node.innerText.trim() === 'Experience');

//         if (!expNode) return { error: "Could not find the word 'Experience' as a section header." };

//         const expSection = expNode.closest('section');
//         if (!expSection) return { error: "Found 'Experience' but could not find its parent <section>." };

//         // 2. Find the first company link inside the Experience section
//         const firstCompanyLink = expSection.querySelector('a[href*="/company/"]');
        
//         let jobContainer = null;
//         let companyUrl = null;

//         if (firstCompanyLink) {
//              companyUrl = firstCompanyLink.href.split('?')[0]; 
             
//              // 3. INTELLIGENT TRAVERSAL: Walk up the DOM tree until we hit the container holding the job duration
//              let currentElement = firstCompanyLink;
//              while (currentElement && currentElement.tagName !== 'SECTION') {
//                  const text = currentElement.innerText || "";
//                  // If the text includes standard LinkedIn duration markers, this is our main container block!
//                  if (text.includes('yr') || text.includes('mo') || text.includes('mos') || text.includes('Present')) {
//                      jobContainer = currentElement;
//                      break;
//                  }
//                  currentElement = currentElement.parentElement;
//              }

//              // Fallback just in case the while loop misses it
//              if (!jobContainer) {
//                  jobContainer = firstCompanyLink.parentElement.parentElement;
//              }
//         } else {
//              // Fallback for self-employed with no company link
//              jobContainer = expSection.querySelector('ul > li') || expSection.querySelector('div[data-component-type="LazyColumn"] > div');
//         }

//         if (!jobContainer) return { error: "Could not isolate the specific job container block." };

//         // 4. Extract the clean, human-readable text
//         const rawText = jobContainer.innerText;
        
//         // Clean the array, trim it, and remove duplicates
//         const textLines = rawText.split('\n').map(line => line.trim()).filter(line => line.length > 0);
//         const uniqueLines = [...new Set(textLines)];

//         return {
//             companyUrl: companyUrl,
//             details: uniqueLines
//         };
//     });

//     if (extractedExp.error) {
//         console.log(`⚠️ ${extractedExp.error}`);
//     } else {
//         result.currentExperience = extractedExp;
//         console.log('✅ Current experience extracted successfully!');
//     }

//   } catch (err) {
//     console.log('\n❌ FATAL ERROR:', err.message);
//   }

//   console.log('\n========== FINAL RESULT ==========\n');
//   console.log(JSON.stringify(result, null, 2));

//   await wait(4000); 
//   await browser.close();
// }

// testExperienceExtraction();

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
async function testExperienceExtraction() {
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
    currentExperience: {
      companyName: null,
      jobTitle: null,
      companyUrl: null,
      details: []
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
    
    // ---------------- SCROLL TO LOAD EXPERIENCE ----------------
    console.log('\n📜 Scrolling to trigger lazy-loaded sections...');
    await page.locator('body').click({ force: true }).catch(() => {});
    
    for (let i = 0; i < 8; i++) {
        await page.keyboard.press('PageDown');
        await wait(1000);
    }

    // ---------------- EXTRACT EXPERIENCE INFO ----------------
    console.log('\n💼 Extracting most recent Experience with decoupled mapping...');
    
    const extractedExp = await page.evaluate(() => {
        // 1. Find the Experience section header
        const textNodes = Array.from(document.querySelectorAll('span[aria-hidden="true"], h2 span, div span, h2'));
        const expNode = textNodes.find(node => node.innerText.trim() === 'Experience');

        if (!expNode) return { error: "Could not find 'Experience' header." };
        const expSection = expNode.closest('section');
        if (!expSection) return { error: "Found 'Experience' but could not find its parent <section>." };

        // 2. Extract Company Link and Company Name GLOBALLY from the section
        const firstCompanyLink = expSection.querySelector('a[href*="/company/"]');
        const companyUrl = firstCompanyLink ? firstCompanyLink.href.split('?')[0] : null;

        let companyName = "Unknown";
        // Grab the very first company logo in the entire section, regardless of nesting
        const firstLogoImg = expSection.querySelector('a[href*="/company/"] img');
        if (firstLogoImg && firstLogoImg.getAttribute('alt')) {
            // Converts "Meril logo" to "Meril"
            companyName = firstLogoImg.getAttribute('alt').replace(/logo$/i, '').trim();
        } else if (firstCompanyLink && firstCompanyLink.getAttribute('aria-label')) {
            // Fallback to aria-label
            companyName = firstCompanyLink.getAttribute('aria-label').replace(/logo$/i, '').trim();
        }

        // 3. Target the job details block
        const firstJobItem = expSection.querySelector('ul > li') || 
                             expSection.querySelector('.pvs-list__paged-list-item') ||
                             expSection.querySelector('div[data-component-type="LazyColumn"] > div');

        if (!firstJobItem) return { error: "Could not find the first job container list item." };

        // 4. Extract and clean the array
        const rawLines = firstJobItem.innerText.split('\n').map(l => l.trim()).filter(l => l.length > 0);
        const details = [];
        for (let i = 0; i < rawLines.length; i++) {
            if (i === 0 || rawLines[i] !== rawLines[i-1]) {
                details.push(rawLines[i]);
            }
        }

        // 5. SECURE JOB TITLE EXTRACTION
        let jobTitle = "Unknown";
        if (details.length > 0) {
            // If the first line of text contains the Company Name, it's an Umbrella layout
            // and the Job title is further down the array.
            if (companyName !== "Unknown" && details[0].toLowerCase().includes(companyName.toLowerCase())) {
                jobTitle = details.length > 3 ? details[3] : "Unknown";
            } else {
                // If the first line is NOT the company name, then the first line IS the Job Title!
                jobTitle = details[0];
            }
        }

        return {
            companyName,
            jobTitle,
            companyUrl,
            details: details
        };
    });

    if (extractedExp.error) {
        console.log(`⚠️ ${extractedExp.error}`);
    } else {
        result.currentExperience = extractedExp;
        console.log('✅ Current experience extracted successfully!');
    }

  } catch (err) {
    console.log('\n❌ FATAL ERROR:', err.message);
  }

  console.log('\n========== FINAL RESULT ==========\n');
  console.log(JSON.stringify(result, null, 2));

  await wait(4000); 
  await browser.close();
}

testExperienceExtraction();