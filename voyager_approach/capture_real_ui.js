// Open messaging page, hook fetch BEFORE LinkedIn's code runs, then click around
// to capture the EXACT body the real UI builds when sending a message.

const { chromium } = require("patchright");
const fs = require("fs");
const path = require("path");

const PROXY = {
  server: "http://82.41.252.111:46222",
  username: "xBVyYdUpx84nWx7",
  password: "dwwTxtvv5a10RXn",
};

const SESSION = path.join(__dirname, "sessions", "live", "cookies.json");

(async () => {
  const cookies = JSON.parse(fs.readFileSync(SESSION, "utf8"));
  const browser = await chromium.launch({
    headless: false,
    channel: "chrome",
    args: ["--no-first-run"],
    proxy: PROXY,
    slowMo: 200,
  });
  const ctx = await browser.newContext({
    userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36",
    locale: "en-IN",
    timezoneId: "Asia/Kolkata",
    viewport: { width: 1440, height: 900 },
  });
  await ctx.addCookies(cookies);

  // Hook fetch at the top of every page
  await ctx.addInitScript(() => {
    window.__captured = [];
    const origFetch = window.fetch;
    window.fetch = function (...args) {
      try {
        const url = typeof args[0] === "string" ? args[0] : args[0].url;
        const method = args[1]?.method || "GET";
        const body = args[1]?.body;
        if (url && url.includes("/voyager/api/") && method === "POST" && body) {
          window.__captured.push({
            url,
            method,
            body: typeof body === "string" ? body : "[non-string]",
            time: Date.now(),
          });
        }
      } catch (e) {}
      return origFetch.apply(this, args);
    };
  });

  const page = await ctx.newPage();

  // Capture all responses too
  const responses = [];
  page.on("response", async (r) => {
    if (r.request().method() === "POST" && r.url().includes("/voyager/api/")) {
      try {
        responses.push({ url: r.url(), status: r.status(), body: (await r.text()).substring(0, 1500) });
      } catch {}
    }
  });
  // Also capture request bodies via Playwright's request event (hooks every transport)
  const requests = [];
  page.on("request", (r) => {
    if (r.method() === "POST" && r.url().includes("/voyager/api/")) {
      try {
        requests.push({ url: r.url(), body: r.postData()?.substring(0, 2000) || "[no body]" });
      } catch {}
    }
  });

  await page.goto("https://www.linkedin.com/messaging/", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(5000);
  console.log("On:", page.url());

  // Find compose icon and click — try several selectors
  let composeBtn = null;
  const composeSelectors = [
    'button[aria-label*="compose" i]',
    'button[aria-label*="new message" i]',
    'button[aria-label*="New" i]',
    'a[aria-label*="compose" i]',
    'a[href*="/messaging/compose"]',
    'button[class*="compose" i]',
    'msg-typing-indicator',
    'button:has-text("New message")',
    'button[data-test-icon="compose-medium"]',
  ];
  for (const sel of composeSelectors) {
    try {
      composeBtn = await page.$(sel);
      if (composeBtn) { console.log("Found compose via:", sel); break; }
    } catch {}
  }

  if (composeBtn) {
    await composeBtn.click();
    await page.waitForTimeout(2000);
  } else {
    console.log("No compose button. Going to /messaging/compose/thread/new/");
    await page.goto("https://www.linkedin.com/messaging/compose/thread/new/", { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(3000);
  }

  // Type recipient
  const toSelectors = [
    'input[placeholder*="Type a name" i]',
    'input[placeholder*="search" i]',
    'input[aria-label*="search" i]',
    'input[aria-label*="To" i]',
    'input[role="combobox"]',
    'input.msg-connections-typeahead__search-field',
  ];
  let toInput = null;
  for (const sel of toSelectors) {
    try {
      toInput = await page.$(sel);
      if (toInput) { console.log("Found To input via:", sel); break; }
    } catch {}
  }
  if (toInput) {
    await toInput.click();
    await toInput.fill("");
    await toInput.type("Shiva Singh", { delay: 80 });
    await page.waitForTimeout(3000);

    // Click first suggestion
    const sugSelectors = [
      'li[role="option"]',
      'div[role="option"]',
      'button[aria-label*="Shiva" i]',
      '.typeahead-result',
      'li.msg-connections-typeahead__connection',
    ];
    let sug = null;
    for (const sel of sugSelectors) {
      try {
        const all = await page.$$(sel);
        if (all && all.length) {
          sug = all[0];
          console.log("Found suggestion via:", sel, "(", all.length, "items)");
          break;
        }
      } catch {}
    }
    if (sug) {
      await sug.click();
      await page.waitForTimeout(2000);
    } else {
      console.log("No suggestion found. HTML around to-input:");
      const html = await page.evaluate(() => {
        const ti = document.querySelector('input[placeholder*="Type" i]') || document.querySelector('input');
        return ti ? ti.outerHTML : "(no input)";
      });
      console.log(html);
    }
  }

  // Type message
  const msgSelectors = [
    'div[contenteditable="true"]',
    'div[aria-label*="Write a message" i]',
    'div.msg-form__contenteditable',
    'textarea[placeholder*="message" i]',
  ];
  let msgInput = null;
  for (const sel of msgSelectors) {
    try {
      msgInput = await page.$(sel);
      if (msgInput) { console.log("Found msg input via:", sel); break; }
    } catch {}
  }
  if (msgInput) {
    await msgInput.click();
    await msgInput.type("__voyager_capture__test " + Date.now(), { delay: 50 });
    await page.waitForTimeout(1000);

    // Click send
    const sendSelectors = [
      'button[type="submit"]',
      'button.msg-form__send-button',
      'button:has-text("Send")',
      'button[aria-label*="Send" i]',
    ];
    let sendBtn = null;
    for (const sel of sendSelectors) {
      try {
        sendBtn = await page.$(sel);
        if (sendBtn) { console.log("Found send via:", sel); break; }
      } catch {}
    }
    if (sendBtn) {
      await sendBtn.click();
      await page.waitForTimeout(5000);
    }
  }

  // Dump captured
  const captured = await page.evaluate(() => window.__captured || []);
  console.log("\n=== Captured fetch POSTs ===");
  console.log("(count:", (captured || []).length, ")");
  (captured || []).forEach((c) => {
    console.log(`\n${c.method}  ${c.url}`);
    console.log("  BODY:", (c.body || "").substring(0, 1000));
  });
  console.log("\n=== Captured responses ===");
  responses.forEach((r) => {
    console.log(`\n${r.status}  ${r.url}`);
    console.log("  RES:", r.body?.substring(0, 500));
  });

  fs.writeFileSync(
    path.join(__dirname, "sessions", "live", "real_ui_capture.json"),
    JSON.stringify({ captured, responses, requests }, null, 2)
  );
  console.log("\nSaved to real_ui_capture.json");

  await page.waitForTimeout(5000);
  await ctx.close();
  await browser.close();
})().catch((e) => { console.error("FATAL:", e.message, e.stack); process.exit(1); });
