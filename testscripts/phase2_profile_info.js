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

  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
  
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

  const profileUrl = process.env.LI_PROFILE_URL || "https://www.linkedin.com/in/shiva-singh-genai-llm/";

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

    console.log(`\n👤 Direct to profile: ${profileUrl}`);
    await page.goto(profileUrl, { waitUntil: 'domcontentloaded' });
    await wait(4000);

    // ---------------------------------------------------------
    // AGGRESSIVE SCROLL: Full page load then scroll to experience
    // ---------------------------------------------------------
    console.log('📜 Scrolling to load all content...');
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await wait(3000);
    
    // Multiple scroll passes - exact copy from working script
    for (let i = 0; i < 5; i++) {
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
      await wait(1500);
    }
    
    // Scroll back to top
    await page.evaluate(() => window.scrollTo(0, 0));
    await wait(1000);

    // Ensure Experience section is loaded by aggressively loading content
    async function ensureExperienceLoaded(p) {
      for (let i = 0; i < 6; i++) {
        const found = await p.evaluate(() => {
          const hs = Array.from(document.querySelectorAll('h2'));
          return hs.some(h => h.innerText.trim().toLowerCase() === 'experience');
        });
        if (found) return true;
        await p.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
        await new Promise(res => setTimeout(res, 1200 * (i + 1)));
      }
      return false;
    }
    const expLoaded = await ensureExperienceLoaded(page);
    if (!expLoaded) {
      console.log('⚠️ Experience header not detected after aggressive load; continuing with best-effort extraction.');
    }
    
    // Scroll to Experience section
    await page.evaluate(() => {
      const h2s = Array.from(document.querySelectorAll('h2'));
      const expH2 = h2s.find(h => h.innerText.trim().toLowerCase() === 'experience');
      if (expH2) expH2.scrollIntoView({ behavior: 'instant', block: 'start' });
    });
    await wait(2000);
    
    // Final scroll pass to ensure all loaded
    await page.evaluate(() => {
      for (let i = 0; i < 3; i++) window.scrollBy(0, 800);
    });
    await wait(3000);
    
    // Check for Experience header before anything else
    const expCheck = await page.evaluate(() => {
      return Array.from(document.querySelectorAll('h2')).map(h => h.innerText.trim());
    });
    console.log('EXP check:', expCheck.filter(t => t.toLowerCase() === 'experience' || t.toLowerCase().includes('experience')));

    console.log('🔍 Extracting data from Desktop DOM...');
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

    // ---------------- EXTRACT EXPERIENCE (Structured) ----------------
    try {
        result.experience = await page.evaluate(() => {
            // Debug: check what's available
            const h2s = Array.from(document.querySelectorAll('h2'));
            const h2Texts = h2s.map(h => h.innerText.trim()).filter(t => t);
            
            const header = h2s.find(h => h.innerText.trim().toLowerCase() === 'experience');
            if (!header) {
                return { debug: 'No Experience header found', h2s: h2Texts };
            }

            const section = header.closest('section');
            if (!section) return [];

            const listItems = section.querySelectorAll('li');
            const topLevelDivs = section.querySelectorAll(':scope > div');
            const allItems = [...listItems, ...topLevelDivs];
            
            return Array.from(allItems).map(li => {
                const data = {
                    jobTitle: null,
                    company: null,
                    employmentType: null,
                    duration: null,
                    yearsExp: null,
                    location: null,
                    mode: null
                };

                const paragraphs = li.querySelectorAll('p');
                
                paragraphs.forEach(p => {
                    const text = p.innerText?.trim();
                    if (!text) return;
                    
                    const classList = p.className || '';
                    
                    // Job title: class _33517241
                    if (classList.includes('_33517241')) {
                        if (!data.jobTitle && text.length > 2 && text.length < 100) {
                            data.jobTitle = text;
                        }
                    }
                    
                    // Company/Duration/Location: class _51112094
                    if (classList.includes('_51112094')) {
                        if (text.includes(' · ')) {
                            const parts = text.split(' · ');
                            
                            if (parts.length >= 2 && (parts[1].includes('Full-time') || parts[1].includes('Part-time') || 
                                parts[1].includes('Internship') || parts[1].includes('Contract') ||
                                parts[1].includes('Freelance'))) {
                                data.company = parts[0].trim();
                                data.employmentType = parts[1].trim();
                            }
                            else if (parts[1] && (parts[1].includes('yr') || parts[1].includes('mo'))) {
                                data.duration = parts[0].trim();
                                data.yearsExp = parts[1].trim();
                            }
                            else if (parts[1] && (parts[1].includes('On-site') || parts[1].includes('Remote') || 
                                         parts[1].includes('Hybrid'))) {
                                data.location = parts[0].trim();
                                data.mode = parts[1].trim();
                            }
                        }
                        else if (!text.includes(' · ')) {
                            if (text.match(/^[A-Z][a-z]{2,8}\s+\d{4}/) && !data.duration) {
                                data.duration = text;
                            }
                        }
                    }
                });

                // Get company from link
                if (!data.company) {
                    const anchorWithCompany = li.closest('div[class*="_20be700a"]');
                    if (anchorWithCompany) {
                        const companyAnchor = anchorWithCompany.querySelector('a[href*="/company/"]') || li.querySelector('a[href*="/company/"]');
                        if (companyAnchor) {
                            const img = companyAnchor.querySelector('img');
                            if (img) {
                                const alt = img.getAttribute('alt');
                                if (alt && alt.length > 0 && alt.length < 50) {
                                    data.company = alt.replace(' logo', '').trim();
                                }
                            }
                        }
                    }
                }

                Object.keys(data).forEach(key => {
                    if (data[key] === null || data[key] === '') data[key] = null;
                });

                return data;
            }).filter(item => item.jobTitle || item.company);
        });
    } catch (e) {
        console.log(`⚠️ Failed to extract Experience: ${e.message}`);
    }

    // ---------------- EXTRACT EDUCATION ----------------
    try {
        result.education = await page.evaluate(() => {
            const h2s = Array.from(document.querySelectorAll('h2'));
            const header = h2s.find(h => h.innerText.trim().toLowerCase() === 'education');
            if (!header) return [];

            const section = header.closest('section');
            if (!section) return [];

            const listItems = section.querySelectorAll('li');
            return Array.from(listItems).map(li => {
                const lines = li.innerText.split('\n')
                    .map(l => l.trim())
                    .filter(l => l.length > 0 && l !== '·' && !l.includes('skills'));
                return [...new Set(lines)];
            }).filter(arr => arr.length > 1);
        });
    } catch (e) {
        console.log(`⚠️ Failed to extract Education: ${e.message}`);
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
