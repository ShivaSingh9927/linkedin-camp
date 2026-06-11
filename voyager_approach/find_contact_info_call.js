// Find the exact voyager call that returns contact info
const { chromium } = require("playwright-extra");
const stealth = require("puppeteer-extra-plugin-stealth")();
const path = require("path");
const fs = require("fs");
chromium.use(stealth);

const PROXY = {
  server: "http://82.41.252.111:46222",
  username: "xBVyYdUpx84nWx7",
  password: "dwwTxtvv5a10RXn",
};
const SESSION = path.join(__dirname, "..", "testscripts", "sessions", "snehlata");
const vanity = "shiva-singh-genai-llm";

(async () => {
  const cookies = JSON.parse(fs.readFileSync(path.join(SESSION, "cookies.json"), "utf8"));
  const browser = await chromium.launch({
    headless: false, proxy: PROXY,
    args: ["--disable-blink-features=AutomationControlled", "--start-maximized"],
  });
  const ctx = await browser.newContext({
    viewport: null,
    userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36",
    locale: "en-IN", timezoneId: "Asia/Kolkata", proxy: PROXY,
  });
  await ctx.addCookies(cookies);
  const page = await ctx.newPage();

  // Capture REQUEST bodies and RESPONSE bodies, look for actual email/phone
  const reqs = [];
  page.on("request", (r) => {
    if (r.url().includes("/voyager/api/")) {
      reqs.push({
        phase: "req",
        url: r.url().replace("https://www.linkedin.com", ""),
        method: r.method(),
        body: r.postData()?.substring(0, 1000),
      });
    }
  });
  page.on("response", async (res) => {
    if (res.url().includes("/voyager/api/")) {
      try {
        const text = await res.text();
        const hasEmail = /[a-zA-Z0-9._%+-]+@gmail\.com/.test(text) || /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/.test(text);
        const hasPhone = /9368084140/.test(text);
        if (hasEmail || hasPhone) {
          reqs.push({
            phase: "res",
            url: res.url().replace("https://www.linkedin.com", ""),
            status: res.status(),
            hasEmail,
            hasPhone,
            body: text,
          });
        }
      } catch {}
    }
  });

  await page.goto(`https://www.linkedin.com/in/${vanity}`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(5000);

  // Click Contact info - try multiple selectors
  let clicked = false;
  const selectors = [
    'a:has-text("Contact info")',
    'button:has-text("Contact info")',
    'a[href*="overlay/contact-info"]',
    'a[href*="contact-info"]',
    'a[href*="contactInfo"]',
  ];
  for (const sel of selectors) {
    try {
      const el = await page.$(sel);
      if (el) {
        console.log(`Found via: ${sel}`);
        await el.click();
        clicked = true;
        break;
      }
    } catch (e) { console.log(`  ${sel}: ${e.message.split("\n")[0]}`); }
  }
  if (clicked) {
    await page.waitForTimeout(5000);
  } else {
    // Maybe the contact info is already in the top card
    console.log("Trying to fetch contact info via direct URL...");
    await page.goto(`https://www.linkedin.com/in/${vanity}/overlay/contact-info`, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(5000);
  }

  // Print all reqs/res that mentioned email/phone
  console.log("=== CAPTURED CALLS WITH EMAIL/PHONE ===");
  reqs.filter(r => r.hasEmail || r.hasPhone).forEach(r => {
    console.log(`\n${r.phase.toUpperCase()} [${r.status || "?"}] ${r.url}`);
    if (r.body) {
      // Extract only relevant fields
      const m = r.body.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g);
      const p = r.body.match(/(?:phoneNumber|emailAddress|"phone"|"email")[^,}]*/gi);
      if (m) console.log("  EMAILS:", m);
      if (p) console.log("  PHONE/EMAIL fields:", p);
    }
  });

  // Also check the modal HTML
  const modalHtml = await page.evaluate(() => {
    const modal = document.querySelector('[role="dialog"]') || document.querySelector('.artdeco-modal') || document.querySelector('[class*="modal" i]');
    return modal ? modal.innerText : document.body.innerText.substring(0, 2000);
  });
  console.log("\n=== MODAL CONTENT ===");
  console.log(modalHtml);

  // Now extract the contact info entity from the response
  const contactInfoCall = reqs.find(r => r.hasEmail || r.hasPhone);
  if (contactInfoCall) {
    console.log("\n=== FULL RESPONSE OF CONTACT INFO CALL ===");
    console.log(contactInfoCall.body);
  }

  await ctx.close();
  await browser.close();
})().catch((e) => { console.error("FATAL:", e.message, e.stack); process.exit(1); });
