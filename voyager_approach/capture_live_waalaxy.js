/**
 * Live capture: Waalaxy app + LinkedIn network traffic
 * Run with Waalaxy app open in Brave/Chrome with LinkedIn logged in
 */
const { chromium } = require('patchright');
const fs = require('fs');
const path = require('path');

const OUT = path.join(__dirname, 'live_capture');
fs.mkdirSync(OUT, { recursive: true });

(async () => {
    const browser = await chromium.launchPersistentContext(
        '/home/shiva/.config/google-chrome/Default',
        {
            headless: false,
            channel: 'chrome',
            args: ['--no-first-run', '--disable-blink-features=AutomationControlled'],
            viewport: null,
        }
    );

    const pages = browser.pages();
    const page = pages[0] || await browser.newPage();
    const log = [];
    const cookies = [];

    page.on('response', async (resp) => {
        const url = resp.url();
        const isRelevant = url.includes('linkedin.com/voyager')
                        || url.includes('stargate')
                        || url.includes('otto')
                        || url.includes('app.waalaxy.com')
                        || url.includes('linkedin.com/oauth');
        if (!isRelevant) return;
        try {
            const status = resp.status();
            const method = resp.request().method();
            const reqHeaders = resp.request().headers();
            const reqBody = resp.request().postData();
            const text = await resp.text().catch(() => '');
            const entry = { ts: new Date().toISOString(), status, method, url, reqHeaders, reqBody, respBody: text.substring(0, 2000) };
            log.push(entry);
            console.log(`[${status}] ${method} ${url.substring(0, 100)}`);
            fs.writeFileSync(path.join(OUT, 'traffic.json'), JSON.stringify(log, null, 2));
        } catch (e) {}
    });

    console.log('Open Waalaxy app or trigger a campaign action');
    console.log('Capturing traffic to live_capture/traffic.json\n');
    console.log('Going to https://app.waalaxy.com...');

    try {
        await page.goto('https://app.waalaxy.com', { waitUntil: 'domcontentloaded', timeout: 30000 });
    } catch (e) {
        console.log('Navigation:', e.message);
    }

    console.log('Current URL:', page.url());
    console.log('Capturing for 5 minutes. Trigger any action you want me to see.\n');

    await page.waitForTimeout(5 * 60 * 1000);

    fs.writeFileSync(path.join(OUT, 'cookies.json'), JSON.stringify(cookies, null, 2));
    fs.writeFileSync(path.join(OUT, 'browser_cookies.json'), JSON.stringify(await browser.cookies(), null, 2));
    console.log('\nDone. Output:', OUT);
    await browser.close();
})();
