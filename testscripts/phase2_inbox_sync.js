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
async function syncInbox() {
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
    viewport: { width: 1920, height: 1080 },
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

  await page.route('**/*', (route) => {
    const type = route.request().resourceType();
    const url = route.request().url();
    if (['image', 'media', 'font'].includes(type) || url.includes('analytics') || url.includes('ads')) {
      return route.abort();
    }
    return route.continue();
  });

  const INBOX_URL = "https://www.linkedin.com/messaging/";
  
  const result = {
    syncedThreads: 0,
    threads: []
  };

  try {
    // ---------------- 1. WARMUP ----------------
    console.log('\n🔥 Warming up on Feed (Initializing LinkedIn WebSockets)...');
    await safeGoto(page, 'https://www.linkedin.com/feed/');
    await wait(5000); 

    // ---------------- 2. NAVIGATE TO INBOX ----------------
    console.log('\n📬 Navigating to Inbox...');
    await safeGoto(page, INBOX_URL);
    await wait(4000); 

    // ---------------- 3. EXTRACT THREADS ----------------
    console.log('\n📇 Scanning left pane for active conversations...');
    
    try {
        await page.waitForSelector('.msg-conversation-listitem', { timeout: 15000 });
        console.log('✅ Conversation list rendered.');
    } catch (e) {
        console.log('⚠️ Timed out waiting for conversation list to render.');
    }

    const leftPane = page.locator('.msg-conversations-container__list, ul.msg-conversations-container__conversations-list').first();
    
    if (await leftPane.isVisible()) {
        await leftPane.click({ force: true }).catch(() => {}); 
        await wait(1000);
        
        console.log('📜 Scrolling conversation list...');
        for (let i = 0; i < 4; i++) {
            await page.keyboard.press('PageDown'); 
            await wait(1000);
        }
    }

    // ---------------- 4. ITERATE AND CLICK ----------------
    const threadItems = page.locator('.msg-conversation-listitem');
    const threadCount = await threadItems.count();

    if (threadCount === 0) {
        console.log('⚠️ Found 0 threads. LinkedIn may have altered the root class name again.');
    } else {
        const syncLimit = Math.min(threadCount, 3);
        console.log(`✅ Found ${threadCount} total threads. Syncing the top ${syncLimit}...`);

        for (let i = 0; i < syncLimit; i++) {
            const currentItem = threadItems.nth(i);
            
            const nameLoc = currentItem.locator('.msg-conversation-listitem__participant-names, .msg-conversation-card__participant-names').first();
            let participantName = "Unknown";
            if (await nameLoc.isVisible()) {
                const rawName = await nameLoc.innerText();
                participantName = rawName.split('\n')[0].trim();
            }

            console.log(`\n💬 Loading thread ${i + 1}/${syncLimit} with ${participantName}...`);
            
            await currentItem.click({ force: true });
            await wait(4000); // Give the right pane time to fetch messages
            
            const threadUrl = page.url(); 

            // Scroll UP to load history
            const messageListContainer = page.locator('.msg-s-message-list-container, .msg-s-message-list').first();
            if (await messageListContainer.isVisible()) {
                await messageListContainer.click({ force: true }).catch(() => {});
                for (let j = 0; j < 3; j++) {
                     await page.keyboard.press('PageUp'); 
                     await wait(1500);
                }
            }

            // --- REBUILT PARSER ---
            console.log('🔍 Parsing message bubbles...');
            const chatHistory = await page.evaluate(() => {
                const msgs = [];
                // Target the ROOT event node so we don't accidentally double-count nested elements
                const eventNodes = Array.from(document.querySelectorAll('.msg-s-message-list__event, li.msg-s-message-list__event'));

                for (let eventNode of eventNodes) {
                    // Find the actual text body
                    const bodyNode = eventNode.querySelector('.msg-s-event-listitem__body, .msg-s-event__content');
                    if (!bodyNode) continue;

                    const text = bodyNode.innerText.trim();
                    if (text.length === 0) continue;

                    let sender = "Unknown";
                    
                    // STRATEGY 1: Look for any element with the "Options for..." aria-label (Highly Reliable)
                    const optionEl = eventNode.querySelector('[aria-label*="Options for"]');
                    if (optionEl) {
                        const ariaLabel = optionEl.getAttribute('aria-label');
                        if (ariaLabel.includes('your message')) {
                            sender = "You";
                        } else {
                            // Pulls "Raja" out of "Options for the message from Raja: Hi Shiva!..."
                            const match = ariaLabel.match(/message from (.*?):/);
                            if (match && match[1]) {
                                sender = match[1].trim();
                            }
                        }
                    }

                    // STRATEGY 2: Visual Indicator Fallback
                    // Outgoing messages have a "sending indicator" (the little checkmark)
                    if (sender === "Unknown") {
                        const sendingIndicator = eventNode.querySelector('.msg-s-event-with-indicator__sending-indicator');
                        if (sendingIndicator || eventNode.classList.contains('msg-s-event-listitem--message-bubble-outgoing')) {
                            sender = "You";
                        }
                    }

                    msgs.push({
                        sender: sender,
                        text: text
                    });
                }
                return msgs;
            });

            result.threads.push({
                threadUrl: threadUrl,
                participantName: participantName,
                messages: chatHistory
            });
            
            result.syncedThreads++;
            console.log(`✅ Extracted ${chatHistory.length} messages from thread.`);
        }
    }

  } catch (err) {
    console.log('\n❌ FATAL ERROR:', err.message);
  }

  console.log('\n========== FINAL RESULT ==========\n');
  console.log(JSON.stringify(result, null, 2));

  await wait(3000); 
  await browser.close();
}

syncInbox();