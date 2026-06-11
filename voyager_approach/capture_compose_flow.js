// Try the "new conversation" flow: open LinkedIn messaging, click Compose,
// type a name, select, then send — capture all createMessage + create-conversation calls

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
  });
  const ctx = await browser.newContext({
    userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36",
    locale: "en-IN",
    timezoneId: "Asia/Kolkata",
    viewport: { width: 1440, height: 900 },
  });
  await ctx.addCookies(cookies);
  const page = await ctx.newPage();

  // Capture ALL voyager POST calls
  const posts = [];
  page.on("request", (r) => {
    if (r.method() === "POST" && r.url().includes("/voyager/api/")) {
      posts.push({ url: r.url(), method: "POST", body: r.postData()?.substring(0, 2000) });
    }
  });
  page.on("response", async (r) => {
    if (r.request().method() === "POST" && r.url().includes("/voyager/api/")) {
      const idx = posts.findIndex((p) => p.url === r.url() && !p.status);
      if (idx >= 0) {
        try {
          posts[idx].status = r.status();
          posts[idx].response = (await r.text()).substring(0, 1000);
        } catch {}
      }
    }
  });

  await page.goto("https://www.linkedin.com/messaging/", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(6000);
  console.log("At messaging page:", page.url());

  // Click "Compose" / new message button
  // Look for a button or icon for new message
  const composeBtn = await page.$('button[aria-label*="New message" i], button[aria-label*="Compose" i], a[href*="/messaging/compose"]');
  if (composeBtn) {
    console.log("Clicking compose...");
    await composeBtn.click();
    await page.waitForTimeout(2000);
  } else {
    console.log("No compose button found. Trying direct URL...");
    await page.goto("https://www.linkedin.com/messaging/compose/", { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(3000);
  }

  // Type a name in the "To" field
  const toInput = await page.$('input[placeholder*="Search" i], input[aria-label*="To" i], input[name="query"]');
  if (toInput) {
    console.log("Typing recipient name...");
    await toInput.fill("Shiva Singh");
    await page.waitForTimeout(3000);
    // Click first suggestion
    const suggestion = await page.$('div[role="option"], li[role="option"], button[aria-label*="Shiva" i]');
    if (suggestion) {
      console.log("Clicking suggestion...");
      await suggestion.click();
      await page.waitForTimeout(2000);
    }
  } else {
    console.log("No 'To' input found");
  }

  // Now find the message input and type
  const msgInput = await page.$('div[contenteditable="true"], textarea[placeholder*="message" i]');
  if (msgInput) {
    console.log("Typing message...");
    await msgInput.click();
    await msgInput.type("__voyager capture test__");
    await page.waitForTimeout(1000);

    // Click send
    const sendBtn = await page.$('button[type="submit"]:has-text("Send"), button[aria-label*="Send" i]');
    if (sendBtn) {
      console.log("Clicking send...");
      await sendBtn.click();
      await page.waitForTimeout(5000);
    }
  }

  console.log("\n=== Captured POST calls ===");
  posts.forEach((p) => {
    console.log(`\n${p.status || "?"}  ${p.url}`);
    if (p.body) console.log("  REQ:", p.body.substring(0, 500));
    if (p.response) console.log("  RES:", p.response.substring(0, 500));
  });

  // Save full log
  fs.writeFileSync(path.join(__dirname, "sessions", "live", "compose_capture.json"), JSON.stringify(posts, null, 2));
  console.log("\nSaved to compose_capture.json");

  await page.waitForTimeout(5000);
  await ctx.close();
  await browser.close();
})().catch((e) => { console.error("FATAL:", e.message, e.stack); process.exit(1); });
