const { chromium } = require('playwright-extra');
const stealth = require('puppeteer-extra-plugin-stealth')();
const fs = require('fs');
const path = require('path');

chromium.use(stealth);

const wait = (ms) => new Promise(res => setTimeout(res, ms));

async function extractExperience(profileUrl) {
  let cookies;

  try {
    const cookiesPath = path.join(__dirname, 'cookies.json');
    cookies = JSON.parse(fs.readFileSync(cookiesPath, 'utf8'));
  } catch (err) {
    console.log('❌ Missing or invalid cookies.json.', err.message);
    return null;
  }

  const browser = await chromium.launch({ headless: false, args: ['--no-sandbox'] });
  
  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
    locale: 'en-IN',
    timezoneId: 'Asia/Kolkata'
  });

  await context.addCookies(cookies);
  const page = await context.newPage();

  await page.route('**/*', (route) => {
    const type = route.request().resourceType();
    if (['image', 'media', 'font'].includes(type) || route.request().url().includes('analytics')) {
      return route.abort();
    }
    return route.continue();
  });

  const result = {
    profile: profileUrl,
    experience: []
  };

  try {
    console.log(`\n👤 Opening: ${profileUrl}`);
    await page.goto(profileUrl, { waitUntil: 'domcontentloaded' });
    await wait(4000);

    console.log('📜 Scrolling to load all content...');
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await wait(3000);
    
    for (let i = 0; i < 5; i++) {
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
      await wait(1500);
    }
    await page.evaluate(() => window.scrollTo(0, 0));
    await wait(1000);

    await page.evaluate(() => {
      const h2s = Array.from(document.querySelectorAll('h2'));
      const expH2 = h2s.find(h => h.innerText.trim().toLowerCase() === 'experience');
      if (expH2) expH2.scrollIntoView({ behavior: 'instant', block: 'start' });
    });
    await wait(2000);
    
    await page.evaluate(() => {
      for (let i = 0; i < 3; i++) window.scrollBy(0, 800);
    });
    await wait(2000);

    console.log('🔍 Extracting experience...');
    
    const experienceData = await page.evaluate(() => {
      const h2s = Array.from(document.querySelectorAll('h2'));
      const header = h2s.find(h => h.innerText.trim().toLowerCase() === 'experience');
      if (!header) return { error: 'No Experience section found' };

      const section = header.closest('section');
      if (!section) return { error: 'No section found' };

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
          
          if (classList.includes('_33517241')) {
            if (!data.jobTitle && text.length > 2 && text.length < 100) {
              data.jobTitle = text;
            }
          }
          
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

    if (experienceData.error) {
      console.log(`⚠️ ${experienceData.error}`);
    } else {
      result.experience = experienceData;
      console.log(`✅ Found ${experienceData.length} experience(s)`);
    }

  } catch (err) {
    console.log(`❌ Error: ${err.message}`);
  }

  await browser.close();
  return result;
}

async function main() {
  const leadListPath = path.join(__dirname, 'lead_list.txt');
  const leads = fs.readFileSync(leadListPath, 'utf8').split('\n').filter(l => l.trim());
  
  console.log(`\n📋 Processing ${leads.length} leads...\n`);
  
  const results = [];
  
  for (const profileUrl of leads) {
    const result = await extractExperience(profileUrl.trim());
    if (result) {
      results.push(result);
      console.log(JSON.stringify(result, null, 2));
    }
    await wait(2000);
  }

  const outputPath = path.join(__dirname, 'experience_output.json');
  fs.writeFileSync(outputPath, JSON.stringify(results, null, 2));
  console.log(`\n💾 Saved to ${outputPath}`);
}

main();