/**
 * Test Option C v6: Browser handles the actual HTTP request.
 * Add cookies to browser context, navigate to LinkedIn, 
 * then use native fetch from LinkedIn origin.
 */
const { chromium } = require('patchright');
const fs = require('fs');
const path = require('path');

const COOKIES_FILE = path.join(__dirname, 'cookies.json');

(async () => {
    console.log('=== Option C: Browser-Native Fetch from LinkedIn ===\n');

    const cookies = JSON.parse(fs.readFileSync(COOKIES_FILE, 'utf8'));
    const linkedinCookies = cookies.filter(c => c.domain && c.domain.includes('linkedin'));
    
    console.log(`Cookies: ${linkedinCookies.length}\n`);

    const browser = await chromium.launch({
        headless: false, channel: 'chrome',
        args: ['--no-first-run', '--disable-blink-features=AutomationControlled'],
    });
    const context = await browser.newContext({ locale: 'en-US' });

    // Inject cookies into browser context
    await context.addCookies(linkedinCookies.map(c => ({
        name: c.name, value: c.value,
        domain: c.domain.replace(/^\./, ''),
        path: c.path || '/',
        secure: true, httpOnly: c.httpOnly || false,
        sameSite: c.sameSite || 'None',
    })));

    const page = await context.newPage();

    // Navigate to LinkedIn WITH cookies
    console.log('Navigating to LinkedIn (with injected cookies)...');
    let onFeed = false;
    try {
        await page.goto('https://www.linkedin.com/feed/', { 
            waitUntil: 'domcontentloaded', timeout: 20000 
        });
        onFeed = page.url().includes('/feed');
        console.log(`Page: ${page.url()}\n`);
    } catch (e) {
        console.log(`Navigation: ${e.message.substring(0, 80)}`);
        console.log(`Current URL: ${page.url()}\n`);
    }

    if (onFeed) {
        console.log('✅ Logged in! Capture native fetch before LinkedIn overrides it...\n');
        
        // Save native fetch IMMEDIATELY
        await page.evaluate(() => {
            window.__nf = window.fetch.bind(window);
        });

        // Wait for page to stabilize
        await page.waitForTimeout(3000);

        // Test 1: GET /me from LinkedIn origin
        console.log('--- GET /me (native fetch, LinkedIn origin) ---');
        let result = await page.evaluate(async () => {
            const f = window.__nf;
            const res = await f('https://www.linkedin.com/voyager/api/me');
            const t = await res.text();
            return { s: res.status, d: t.substring(0, 1500) };
        });
        console.log(`  Status: ${result.s}`);
        if (result.s === 200) {
            try {
                const j = JSON.parse(result.d);
                console.log(`  ✅ GET works! PlainID: ${j.data?.plainId || 'N/A'}`);
                
                // Test 2: POST message
                console.log('\n--- POST Send Message ---');
                const payload = {
                    message: {
                        body: { text: 'Browser-native test ' + Date.now(), attributes: [] },
                        renderContentUnions: [],
                        originToken: 'native-' + Date.now(),
                    },
                    hostRecipientUrns: ['urn:li:fsd_profile:ACoAACdYnukB_Rgm7qVvte0xhLy9SZGEbuvKMd0'],
                };
                result = await page.evaluate(async (p) => {
                    const f = window.__nf;
                    const res = await f(
                        'https://www.linkedin.com/voyager/api/voyagerMessagingDashMessengerMessages?action=createMessage',
                        { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(p) }
                    );
                    const t = await res.text();
                    return { s: res.status, d: t.substring(0, 1000) };
                }, payload);
                console.log(`  Status: ${result.s}`);
                console.log(`  Body: ${result.d.substring(0, 400)}`);
                
                if (result.s === 200 || result.s === 201) {
                    console.log('\n✅✅✅ WRITE WORKS!!! Browser-native fetch from LinkedIn origin!');
                } else {
                    console.log(`\n❌ Write: ${result.s}`);
                }
            } catch (e) {
                console.log(`  Parse err: ${e.message}`);
                console.log(`  Raw: ${result.d.substring(0, 300)}`);
            }
        } else {
            console.log(`  Body: ${result.d.substring(0, 300)}`);
        }
    } else {
        console.log('⚠ Not on feed — cookies may not be valid for full session');
        // Try anyway
        await page.evaluate(() => { window.__nf = window.fetch.bind(window); });
        await page.waitForTimeout(1000);
        
        console.log('--- GET /me attempt ---');
        let result = await page.evaluate(async () => {
            const f = window.__nf || fetch;
            try {
                const res = await f('https://www.linkedin.com/voyager/api/me');
                const t = await res.text();
                return { s: res.status, d: t.substring(0, 500) };
            } catch (e) { return { s: 0, d: e.message }; }
        });
        console.log(`  Status: ${result.s}`);
        console.log(`  Body: ${result.d.substring(0, 300)}`);
    }

    console.log('\n=== Done (browser open 30s) ===');
    await page.waitForTimeout(30000);
    await context.close();
    await browser.close();
})().catch(e => { console.error('FATAL:', e.message); process.exit(1); });
