// Click the Contact info link on 1st-degree profile
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
    headless: false, proxy: PROXY, // headful so we can see what's happening
    args: ["--disable-blink-features=AutomationControlled", "--start-maximized"],
  });
  const ctx = await browser.newContext({
    viewport: null,
    userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36",
    locale: "en-IN", timezoneId: "Asia/Kolkata", proxy: PROXY,
  });
  await ctx.addCookies(cookies);
  const page = await ctx.newPage();

  // Capture all voyager calls during contact-info click
  const calls = [];
  page.on("response", async (res) => {
    if (res.url().includes("/voyager/api/")) {
      try {
        const text = await res.text();
        const hasEmail = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/.test(text);
        const hasPhone = /(\+?\d[\d\s\-\(\)]{8,})/.test(text);
        if (hasEmail || hasPhone || res.url().includes("contactInfo") || res.url().includes("ContactInfo")) {
          calls.push({
            url: res.url().replace("https://www.linkedin.com", ""),
            status: res.status(),
            hasEmail,
            hasPhone,
            body: text.substring(0, 2000),
          });
        }
      } catch {}
    }
  });

  await page.goto(`https://www.linkedin.com/in/${vanity}`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(5000);
  console.log("On profile:", page.url());

  // Click the "Contact info" link
  const ciLink = await page.$('a:has-text("Contact info")');
  if (ciLink) {
    console.log("Clicking 'Contact info' link...");
    await ciLink.click();
    await page.waitForTimeout(4000);
    console.log("After click, URL:", page.url());
  } else {
    console.log("No contact info link found");
  }

  // Get the modal/section text
  const modalText = await page.evaluate(() => document.body.innerText);
  // Look for email/phone
  const emailMatch = modalText.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
  const phoneMatch = modalText.match(/(\+?\d[\d\s\-\(\)]{8,})/g);
  console.log("\n--- DETECTED ---");
  console.log("Email:", emailMatch ? emailMatch[0] : "(none)");
  console.log("Phones:", phoneMatch ? phoneMatch.slice(0, 5) : "(none)");

  // Save screenshot of contact info modal
  await page.screenshot({ path: "/tmp/opencode/contact_info_1st.png", fullPage: true });
  console.log("Screenshot: /tmp/opencode/contact_info_1st.png");

  console.log("\n--- VOYAGER CALLS DURING CLICK ---");
  calls.forEach(c => {
    console.log(`\n[${c.status}] ${c.url}  hasEmail=${c.hasEmail} hasPhone=${c.hasPhone}`);
    if (c.body) {
      // Look for email/phone in body
      const m = c.body.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g);
      const p = c.body.match(/\+?\d[\d\s\-\(\)]{8,}/g);
      if (m) console.log("  EMAILS:", m);
      if (p) console.log("  PHONES:", p);
    }
  });

  await page.waitForTimeout(5000);
  await ctx.close();
  await browser.close();
})().catch((e) => { console.error("FATAL:", e.message, e.stack); process.exit(1); });
