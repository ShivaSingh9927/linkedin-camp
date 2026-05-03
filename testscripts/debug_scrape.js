const { chromium } = require('playwright-extra');
const stealth = require('puppeteer-extra-plugin-stealth')();
const fs = require('fs');
const path = require('path');

chromium.use(stealth);

async function run() {
  const cookiesPath = path.join(__dirname, 'cookies.json');
  const cookies = JSON.parse(fs.readFileSync(cookiesPath, 'utf8'));

  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
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

  await page.goto('https://www.linkedin.com/feed/', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(3000);

  const profileUrl = "https://www.linkedin.com/in/shiva-singh-genai-llm/";
  await page.goto(profileUrl, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(4000);

  await page.screenshot({ path: 'debug_profile.png' });
  const html = await page.content();
  fs.writeFileSync('debug_profile.html', html);
  console.log("Screenshot and HTML saved.");
  
  await browser.close();
}

run().catch(console.error);
