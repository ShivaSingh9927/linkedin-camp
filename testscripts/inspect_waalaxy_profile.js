/**
 * Inspect Waalaxy with Chrome profile (includes extension)
 */
const { chromium } = require('patchright');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { execSync } = require('child_process');

const OUT = path.join(__dirname, 'waalaxy_inspection');
fs.mkdirSync(OUT, { recursive: true });

const realProfile = path.join(os.homedir(), '.config/google-chrome');
const copyProfile = '/tmp/chrome-profile-copy';

async function main() {
    // Clean up old copy
    if (fs.existsSync(copyProfile)) fs.rmSync(copyProfile, { recursive: true, force: true });

    // Copy only the Extension data (not full profile — too heavy with cache)
    console.log('Copying profile with Waalaxy extension...');
    execSync(`cp -r "${realProfile}/Default" "${copyProfile}"`, { timeout: 120000 });
    execSync(`cp "${realProfile}/Local State" "${copyProfile}/Local State" 2>/dev/null || true`, { timeout: 5000 });
    console.log('Profile copied');

    const context = await chromium.launchPersistentContext(copyProfile, {
        headless: false,
        channel: 'chrome',
        args: ['--no-first-run', '--disable-blink-features=AutomationControlled'],
        viewport: null,
        locale: 'en-US',
        timezoneId: 'America/New_York',
    });

    const pages = context.pages();
    const page = pages.length > 0 ? pages[0] : await context.newPage();

    const networkLog = [];

    page.on('response', async (resp) => {
        const url = resp.url();
        if (
            url.includes('waalaxy.com') ||
            url.includes('stargate') ||
            url.includes('otto') ||
            url.includes('linkedin.com/voyager') ||
            url.includes('linkedin.com/checkpoint') ||
            url.includes('linkedin.com/login')
        ) {
            try {
                const body = await resp.text();
                const isLi = url.includes('linkedin.com/voyager');
                const isStar = url.includes('stargate');
                const isCheckpoint = url.includes('checkpoint');
                const prefix = isStar ? '⭐STAR' : isLi ? '🔗LI' : isCheckpoint ? '🛡CHK' : '📡WAL';

                const short = url.substring(0, 160);
                console.log(prefix, resp.status(), resp.request().method(), short);

                if (isStar || isLi || isCheckpoint) {
                    networkLog.push({
                        url: short,
                        status: resp.status(),
                        method: resp.request().method(),
                        body: body.substring(0, 600),
                        headers: resp.headers(),
                    });
                    fs.writeFileSync(path.join(OUT, 'network_log.json'), JSON.stringify(networkLog, null, 2));
                }

                // Track set-cookie
                const setCookie = resp.headers()['set-cookie'];
                if (setCookie) {
                    fs.appendFileSync(
                        path.join(OUT, 'set_cookies.txt'),
                        `${new Date().toISOString()} ${url.substring(0, 100)}\n` +
                            (Array.isArray(setCookie) ? setCookie.join('\n') : setCookie) +
                            '\n---\n'
                    );
                }
            } catch (e) {}
        }
    });

    // Navigate to Waalaxy
    console.log('\nOpening app.waalaxy.com with extension...');
    await page.goto('https://app.waalaxy.com', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(3000);

    // Check cookies
    const cookies = await context.cookies();
    const waalaxyCookies = cookies.filter((c) => c.domain.includes('waalaxy'));
    const liCookies = cookies.filter((c) => c.domain.includes('linkedin'));

    console.log(`\nWaalaxy cookies: ${waalaxyCookies.length}`);
    waalaxyCookies.forEach((c) => console.log('  ', c.name, '=', c.value.substring(0, 30)));
    console.log(`LinkedIn cookies: ${liCookies.length}`);
    const liAt = liCookies.find((c) => c.name === 'li_at');
    console.log(`li_at: ${liAt ? 'PRESENT (' + liAt.value.substring(0, 20) + '...)' : 'MISSING'}`);

    fs.writeFileSync(
        path.join(OUT, 'cookies.json'),
        JSON.stringify(
            cookies
                .filter((c) => c.domain.includes('waalaxy') || c.domain.includes('linkedin'))
                .map((c) => ({ domain: c.domain, name: c.name, value: c.value.substring(0, 40) })),
            null,
            2
        )
    );

    await page.screenshot({ path: path.join(OUT, 'app_with_extension.png') });

    console.log('\n✅ Browser open with extension. Connect LinkedIn — I will capture everything.');
    console.log('Waiting 5 minutes...\n');

    // Monitor for 5 minutes
    await page.waitForTimeout(5 * 60 * 1000);

    console.log('\nDone. Saving final state...');
    fs.writeFileSync(path.join(OUT, 'network_log_final.json'), JSON.stringify(networkLog, null, 2));
    await context.close();
}

main().catch((e) => {
    console.error(e.message);
    process.exit(1);
});
