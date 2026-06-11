/**
 * Test: Can we call LinkedIn API from pure Node.js (no browser, no CDP)?
 * This answers whether Waalaxy's cloud mode could use pure HTTP.
 */
const https = require('https');
const fs = require('fs');
const path = require('path');

const cookies = JSON.parse(fs.readFileSync(path.join(__dirname, 'screenshots', 'session', 'cookies.json'), 'utf8'));

const liAt = cookies.find((c) => c.name === 'li_at');
const jsId = cookies.find((c) => c.name === 'JSESSIONID');

if (!liAt || !jsId) {
    console.error('Missing cookies!');
    process.exit(1);
}

const cookieStr = cookies
    .filter((c) => c.domain.includes('linkedin'))
    .map((c) => c.name + '=' + c.value)
    .join('; ');

const csrf = jsId.value.replace(/"/g, '');

console.log('[TEST] Making PURE Node.js HTTPS request to LinkedIn API');
console.log(`[TEST] li_at: ${liAt.value.substring(0, 30)}...`);
console.log(`[TEST] CSRF: ${csrf.substring(0, 30)}...`);

const options = {
    hostname: 'www.linkedin.com',
    path: '/voyager/api/me',
    method: 'GET',
    headers: {
        accept: 'application/vnd.linkedin.normalized+json+2.1',
        'x-restli-protocol-version': '2.0.0',
        'csrf-token': csrf,
        cookie: cookieStr,
        'user-agent':
            'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36',
        'sec-ch-ua': '"Chromium";v="148", "Google Chrome";v="148", "Not)A;Brand";v="99"',
    },
};

const req = https.request(options, (res) => {
    let data = '';
    res.on('data', (chunk) => (data += chunk));
    res.on('end', () => {
        console.log(`[TEST] Status: ${res.statusCode}`);
        console.log(`[TEST] Response: ${data.substring(0, 300)}`);

        if (res.statusCode === 200) {
            console.log('\n✅ SUCCESS: LinkedIn API works from PURE Node.js — no browser, no Playwright, no CDP!');
            console.log('   This explains Waalaxy cloud mode: just cookies + HTTP.');
        } else {
            console.log(`\n❌ Failed: ${res.statusCode}`);
            console.log('   LinkedIn API from Node.js requires a browser context.');
        }
    });
});

req.on('error', (e) => console.error('[TEST] Error:', e.message));
req.end();
