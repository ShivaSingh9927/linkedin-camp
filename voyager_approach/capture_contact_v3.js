// Use page.on("request") and "response" — most reliable
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

  const captures = [];
  page.on("request", (r) => {
    if (r.url().includes("/voyager/api/") || r.url().includes("contact-info")) {
      captures.push({ phase: "req", url: r.url(), method: r.method(), body: r.postData()?.substring(0, 500) });
    }
  });
  page.on("response", async (r) => {
    if (r.url().includes("/voyager/api/") || r.url().includes("contact-info")) {
      try {
        const text = await r.text();
        captures.push({ phase: "res", url: r.url(), status: r.status(), body: text.substring(0, 3000) });
      } catch {}
    }
  });

  console.log("Loading profile...");
  await page.goto(`https://www.linkedin.com/in/${vanity}`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(5000);
  console.log("Captures after profile load:", captures.length);

  // Click Contact info
  const ciLink = await page.$('a:has-text("Contact info")');
  if (ciLink) {
    console.log("Clicking Contact info link...");
    await ciLink.click();
    await page.waitForTimeout(6000);
  }
  console.log("Captures after click:", captures.length);

  // Find the one with email or phone
  const withContact = captures.filter(c => {
    const text = c.body || "";
    return /shivasingh9927@gmail\.com/.test(text) || /9368084140/.test(text);
  });
  console.log("\nCaptures with contact info:", withContact.length);
  withContact.forEach(c => {
    console.log(`\n${c.phase} ${c.method || c.status} ${c.url.replace("https://www.linkedin.com", "")}`);
    if (c.body) console.log("  BODY:", c.body.substring(0, 2500));
  });

  // Save all captures
  fs.writeFileSync(
    path.join(__dirname, "sessions", "live", "contact_capture.json"),
    JSON.stringify(captures, null, 2)
  );
  console.log("\nSaved all captures to contact_capture.json");

  await ctx.close();
  await browser.close();
})().catch((e) => { console.error("FATAL:", e.message, e.stack); process.exit(1); });
