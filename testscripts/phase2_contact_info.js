const { chromium } = require('playwright-extra');
const stealth = require('puppeteer-extra-plugin-stealth')();
const fs = require('fs');
const path = require('path');

chromium.use(stealth);

const wait = (ms) => new Promise(res => setTimeout(res, ms));

async function extractLinkedInDataDesktop() {
  let cookies;

  try {
    const cookiesPath = path.join(__dirname, 'cookies.json');
    cookies = JSON.parse(fs.readFileSync(cookiesPath, 'utf8'));
  } catch (err) {
    console.log('❌ Missing or invalid cookies.json.', err.message);
    return;
  }

  const browser = await chromium.launch({ headless: false, args: ['--no-sandbox'] });
  
  // ---------------------------------------------------------
  // THE FIX: Standard Desktop Viewport (No Mobile UA)
  // ---------------------------------------------------------
  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 }, // Full HD Desktop
    locale: 'en-IN',
    timezoneId: 'Asia/Kolkata'
  });

  await context.addCookies(cookies);
  const page = await context.newPage();

  // Block heavy resources to speed up scraping
  await page.route('**/*', (route) => {
    const type = route.request().resourceType();
    if (['image', 'media', 'font'].includes(type) || route.request().url().includes('analytics')) {
        return route.abort();
    }
    return route.continue();
  });

  const profileUrl = "https://www.linkedin.com/in/saloni-singh-05a456234/";

  const result = {
    profile: profileUrl,
    topCard: { name: null, headline: null, location: null, rawDetails: [] },
    aboutInfo: null,
    experience: [],
    education: [],
    contactDetails: { email: null, phone: null, connectedDate: null, profileLink: null }
  };

  try {
    console.log('\n🔥 Warming up...');
    await page.goto('https://www.linkedin.com/feed/', { waitUntil: 'domcontentloaded' });
    await wait(3000);

    console.log(`\n👤 Opening profile: ${profileUrl}`);
    await page.goto(profileUrl, { waitUntil: 'domcontentloaded' });
    await wait(4000);

    // ---------------------------------------------------------
    // SMOOTH SCROLL: Forces lazy-loaded Desktop sections to render
    // ---------------------------------------------------------
    console.log('📜 Scrolling to render lazy-loaded sections...');
    await page.evaluate(async () => {
        await new Promise((resolve) => {
            let totalHeight = 0;
            const distance = 400; 
            const timer = setInterval(() => {
                const scrollHeight = document.body.scrollHeight;
                window.scrollBy(0, distance);
                totalHeight += distance;
                if (totalHeight >= scrollHeight - window.innerHeight) {
                    clearInterval(timer);
                    resolve();
                }
            }, 500); 
        });
    });
    
    await wait(2000);
    await page.evaluate(() => window.scrollTo(0, 0)); // Scroll back to top
    await wait(1000);

    console.log('🔍 Extracting data from Desktop DOM...');

    // ---------------- EXTRACT TOP CARD ----------------
    try {
        const topCardData = await page.evaluate(() => {
            const data = { name: null, headline: null, location: null, rawDetails: [] };
            
            // Find Contact info link to locate the top card
            const contactLinks = Array.from(document.querySelectorAll('a')).filter(a => a.innerText.toLowerCase().includes('contact info') || (a.id && a.id.includes('contact-info')));
            
            if (contactLinks.length > 0) {
                const section = contactLinks[0].closest('section');
                if (section) {
                    const rawText = section.innerText.split('\n')
                        .map(t => t.trim())
                        .filter(t => t.length > 0 && !t.includes('connections') && !t.includes('Message'));
                    
                    data.rawDetails = [...new Set(rawText)]; // Deduplicate
                    
                    if (data.rawDetails.length > 0) {
                       data.name = data.rawDetails[0];
                       // Clean up pronouns from the name
                       ['He/Him', 'She/Her', 'They/Them'].forEach(p => {
                         if (data.name.endsWith(p)) data.name = data.name.replace(p, '').trim();
                       });
                    }
                    
                    const potentialHeadlines = data.rawDetails.filter(t => t.length > 15 && t !== data.name && !t.includes(','));
                    if (potentialHeadlines.length > 0) data.headline = potentialHeadlines[0];
                    
                    data.location = data.rawDetails.find(t => t.includes(',') && !t.includes('Mutual'));
                }
            }
            return data;
        });
        result.topCard = topCardData;
    } catch (e) {
        console.log(`⚠️ Failed to extract Top Card: ${e.message}`);
    }

    // ---------------- EXTRACT ABOUT ----------------
    try {
        const aboutText = await page.evaluate(() => {
            const h2s = Array.from(document.querySelectorAll('h2'));
            const aboutH2 = h2s.find(h => h.innerText.trim().toLowerCase() === 'about');
            if (!aboutH2) return null;

            const section = aboutH2.closest('section');
            if (!section) return null;

            // Find the visual text box inside the section
            const textBox = section.querySelector('.display-flex.ph5.pv3, [data-testid="expandable-text-box"]') || section;
            return textBox.innerText.replace('About\n', '').trim();
        });
        result.aboutInfo = aboutText;
    } catch (e) {
        console.log(`⚠️ Failed to extract About info: ${e.message}`);
    }

    // ---------------- EXTRACT EXP & EDU ----------------
    const extractDesktopSection = async (sectionTitle) => {
        return await page.evaluate((title) => {
            const h2s = Array.from(document.querySelectorAll('h2'));
            const header = h2s.find(h => h.innerText.trim().toLowerCase() === title.toLowerCase());
            if (!header) return [];

            const section = header.closest('section');
            if (!section) return [];

            // Grab the main list items
            const listItems = Array.from(section.querySelectorAll('ul > li.artdeco-list__item, ul > li.pvs-list__paged-list-item, ul > li'));
            
            return listItems.map(li => {
                // Split text, remove empty lines and hidden screen reader spans
                const lines = li.innerText.split('\n')
                    .map(l => l.trim())
                    .filter(l => l.length > 0 && !l.includes('skills') && l !== '·');
                
                return [...new Set(lines)]; // Deduplicate
            }).filter(arr => arr.length > 2); // Ignore empty/malformed items
        }, sectionTitle);
    };

    try {
        result.experience = await extractDesktopSection('Experience');
        result.education = await extractDesktopSection('Education');
    } catch (e) {
        console.log(`⚠️ Failed to extract Exp/Edu: ${e.message}`);
    }

    // ---------------- EXTRACT CONTACT INFO ----------------
    console.log('\n📇 Opening Contact Info modal...');
    try {
      const contactBtn = page.locator('a:has-text("Contact info"), a#top-card-text-details-contact-info').first();
      
      if (await contactBtn.isVisible()) {
        await contactBtn.click();
        
        // Wait for the dialog/overlay to render
        await page.waitForTimeout(2000); 
        
        const extractedData = await page.evaluate(() => {
            const data = { email: null, phone: null, connectedDate: null, profileLink: null };
            
            // Get the container that holds the contact info. It usually has an h2 with "Contact info" or we can just use the body text.
            let container = document.body;
            const h2s = Array.from(document.querySelectorAll('h2'));
            const contactH2 = h2s.find(h => h.innerText.toLowerCase().includes('contact info') && h.closest('section'));
            if (contactH2) {
                container = contactH2.closest('section') || contactH2.parentElement.parentElement || document.body;
            }

            // Grab the entire text block of the container
            const fullText = container.innerText;

            // Regex extraction ignores HTML nesting entirely
            const emailMatch = fullText.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
            if (emailMatch) data.email = emailMatch[0];

            if (fullText.includes('Phone')) {
                const afterPhone = fullText.split('Phone')[1].trim();
                const phoneLine = afterPhone.split('\n')[0];
                data.phone = phoneLine.replace(/[a-zA-Z()]/g, '').trim();
            }

            if (fullText.includes('Connected since')) {
                const afterConnected = fullText.split('Connected since')[1].trim();
                data.connectedDate = afterConnected.split('\n')[0].trim();
            }

            const profileMatch = fullText.match(/linkedin\.com\/in\/[a-zA-Z0-9_-]+/);
            if (profileMatch) data.profileLink = profileMatch[0];

            return data;
        });

        result.contactDetails = extractedData;

        // Press Escape to close the modal
        await page.keyboard.press('Escape');
        await page.waitForTimeout(1000);

      } else {
        console.log('⚠️ Contact info button not visible.');
      }
    } catch (e) {
      console.log(`⚠️ Failed to extract contact info: ${e.message}`);
    }

  } catch (err) {
    console.log('\n❌ FATAL ERROR:', err.message);
  }

  console.log('\n========== FINAL RESULT ==========\n');
  console.log(JSON.stringify(result, null, 2));

  await browser.close();
}

extractLinkedInDataDesktop();