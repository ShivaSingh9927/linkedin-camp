/**
 * Test: Voyager API calls from SAME browser session (Waalaxy approach).
 * 
 * 1. Open Chrome + proxy
 * 2. User logs in manually (handles CAPTCHA)
 * 3. Browser has live cookies + real TLS fingerprint
 * 4. Use page.evaluate() with native fetch + CSRF to call voyager
 * 5. Test both GET /me and POST message
 * 
 * This is how Waalaxy sends messages:
 * OAuth consent → browser gets cookies → extension calls voyager from browser context
 */
const { chromium } = require('patchright');
const fs = require('fs');
const path = require('path');

(async () => {
    console.log('=== Voyager from Browser (Waalaxy Pattern) ===\n');
    console.log('1. Login → 2. NATIVE fetch from LinkedIn → 3. Message send\n');

    const browser = await chromium.launch({
        headless: false,
        channel: 'chrome',
        args: ['--no-first-run', '--start-maximized', '--disable-blink-features=AutomationControlled'],
    });

    const context = await browser.newContext({
        viewport: null,
        locale: 'en-US',
    });
    const page = await context.newPage();

    await page.goto('https://www.linkedin.com/login', { waitUntil: 'domcontentloaded', timeout: 30000 });
    console.log('Login page loaded: ' + page.url());
    console.log('\n👉 LOG IN NOW — tests run automatically after you reach /feed/\n');

    // Detects successful login
    page.on('framenavigated', async (frame) => {
        const url = frame.url();
        if (!url.includes('/feed')) return;
        
        if (frame._voyagerTestRan) return;
        frame._voyagerTestRan = true;

        console.log('✅ Logged in! Waiting for page to stabilize...\n');
        await page.waitForTimeout(3000);

        // Get live cookies from browser context
        const cookies = await context.cookies('https://www.linkedin.com');
        const jsid = cookies.find(c => c.name === 'JSESSIONID');
        const liAt = cookies.find(c => c.name === 'li_at');
        const csrf = jsid ? jsid.value.replace(/"/g, '') : '';

        console.log(`li_at: ${liAt?.value?.substring(0, 25)}...`);
        console.log(`JSESSIONID: ${jsid?.value?.substring(0, 25)}...`);
        console.log(`CSRF: ${csrf.substring(0, 25)}...`);
        console.log(`Cookies: ${cookies.length}\n`);

        // Save native fetch before LinkedIn overrides it
        await page.evaluate(() => {
            window.__nf = window.fetch.bind(window);
        });

        // ─── TEST 1: GET /me ───
        console.log('─── GET /me ───');
        let r = await page.evaluate(async (csrf) => {
            const f = window.__nf;
            const res = await f('https://www.linkedin.com/voyager/api/me', {
                headers: {
                    'csrf-token': csrf,
                    'x-restli-protocol-version': '2.0.0',
                    accept: 'application/vnd.linkedin.normalized+json+2.1',
                },
            });
            const t = await res.text();
            return { s: res.status, d: t };
        }, csrf);

        console.log(`  Status: ${r.s}`);
        if (r.s === 200) {
            const j = JSON.parse(r.d);
            const plainId = j.data?.plainId || 'N/A';
            const miniUrn = j.data?.['*miniProfile'] || '';
            const encryptedId = miniUrn.split(':').pop() || '';
            console.log(`  ✅ PlainID: ${plainId}`);
            console.log(`  Encrypted ID: ${encryptedId.substring(0, 30)}...`);

            // ─── TEST 2: GET profile ───
            console.log('\n─── GET Profile Highlights ───');
            r = await page.evaluate(async (csrf, encryptedId) => {
                const f = window.__nf;
                const res = await f(
                    `https://www.linkedin.com/voyager/api/identity/profiles/${encryptedId}/highlights`,
                    {
                        headers: {
                            'csrf-token': csrf,
                            'x-restli-protocol-version': '2.0.0',
                        },
                    }
                );
                const t = await res.text();
                return { s: res.status, d: t.substring(0, 300) };
            }, csrf, encryptedId);
            console.log(`  Status: ${r.s} — ${r.s === 200 ? '✅' : '❌'} ${r.d}`);

            // ─── TEST 3: GET connections ───
            console.log('\n─── GET Connections ───');
            r = await page.evaluate(async (csrf) => {
                const f = window.__nf;
                const res = await f(
                    'https://www.linkedin.com/voyager/api/relationships/connectionsSummary',
                    {
                        headers: {
                            'csrf-token': csrf,
                            'x-restli-protocol-version': '2.0.0',
                        },
                    }
                );
                const t = await res.text();
                let num = '?';
                try { num = JSON.parse(t).data?.numConnections || '?'; } catch (e) {}
                return { s: res.status, num };
            }, csrf);
            console.log(`  Status: ${r.s} — ${r.s === 200 ? '✅' : '❌'} Connections: ${r.num}`);

            // ─── TEST 4: POST SEND MESSAGE ───
            console.log('\n─── POST Send Message (WRITE TEST) ───');
            
            // Use recipient from suggestions or our known target
            // First get a recipient
            console.log('  Getting recipient...');
            r = await page.evaluate(async (csrf) => {
                const f = window.__nf;
                const res = await f(
                    'https://www.linkedin.com/voyager/api/voyagerMessagingPeripheralRecipientSuggestions',
                    {
                        headers: {
                            'csrf-token': csrf,
                            'x-restli-protocol-version': '2.0.0',
                        },
                    }
                );
                const t = await res.text();
                let recipient = null;
                try {
                    const j = JSON.parse(t);
                    const el = j.data?.elements || [];
                    if (el[0]?.suggestedRecipients?.[0]) {
                        const r = el[0].suggestedRecipients[0];
                        const miniUrn = r.suggestedRecipientProfile?.['*miniProfile'] || '';
                        recipient = miniUrn.replace('fs_miniProfile', 'fsd_profile');
                    }
                } catch (e) {}
                return { s: res.status, recipient };
            }, csrf);

            const fsdUrn = r.recipient || 'urn:li:fsd_profile:ACoAACdYnukB_Rgm7qVvte0xhLy9SZGEbuvKMd0';
            console.log(`  Recipient: ${fsdUrn}`);

            // Now send the message
            const msgPayload = {
                message: {
                    body: { text: 'Hello! Voyager API test from browser at ' + new Date().toISOString(), attributes: [] },
                    renderContentUnions: [],
                    originToken: 'browser-test-' + Date.now(),
                },
                hostRecipientUrns: [fsdUrn],
            };

            r = await page.evaluate(async (body, csrf) => {
                const f = window.__nf;
                const res = await f(
                    'https://www.linkedin.com/voyager/api/voyagerMessagingDashMessengerMessages?action=createMessage',
                    {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'csrf-token': csrf,
                            'x-restli-protocol-version': '2.0.0',
                            accept: 'application/json',
                        },
                        body: JSON.stringify(body),
                    }
                );
                const t = await res.text();
                return { s: res.status, d: t.substring(0, 800) };
            }, msgPayload, csrf);

            console.log(`  Status: ${r.s}`);
            console.log(`  Body: ${r.d}`);
            
            if (r.s === 200 || r.s === 201) {
                console.log('\n✅✅✅ VOYAGER WRITE WORKS FROM BROWSER!');
                console.log('Architecture: Browser session + voyager API = Waalaxy-level capabilities');
            } else if (r.s === 400 || r.s === 403) {
                const body = JSON.stringify(r.d);
                const err = r.d.includes('PROFILE_CANT') ? 'PROFILE_CANT_BE_ACCESSED' :
                           r.d.includes('MESSAGE_REQUEST') ? 'MESSAGE_REQUEST_RESTRICTED' :
                           r.d.includes('CONNECT_RESTRICTED') ? 'CONNECT_RESTRICTED' :
                           r.d.includes('status') ? 'Unknown restriction' : 'Unknown';
                console.log(`\n⚠ Write blocked: ${err}`);
                console.log('  The voyager endpoint requires certain conditions (connected, open profile, etc.)');
            }
        } else {
            console.log(`  ❌ GET /me failed: ${r.d.substring(0, 200)}`);
        }

        // Save cookies
        const finalCookies = await context.cookies();
        const outDir = path.join(__dirname, 'sessions', 'live-test');
        fs.mkdirSync(outDir, { recursive: true });
        fs.writeFileSync(path.join(outDir, 'cookies.json'), JSON.stringify(finalCookies, null, 2));
        console.log(`\nCookies saved to sessions/live-test/cookies.json`);

        console.log('\n═ Test complete. Browser open 60s. ═');
        await page.waitForTimeout(60000);
        await context.close();
        await browser.close();
        process.exit(0);
    });

    // 3 minute total wait
    await page.waitForTimeout(180000).catch(() => {});
    console.log('\nTimeout — no login detected.');
    await context.close();
    await browser.close();
    process.exit(1);
})().catch(e => { console.error('FATAL:', e.message); process.exit(1); });
