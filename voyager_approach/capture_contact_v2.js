// Aggressive capture: hook fetch + XHR + GraphQL
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

  // Inject fetch+XMLHttpRequest hook at page level (more reliable)
  const page = await ctx.newPage();
  await page.addInitScript(() => {
    window.__fetchCaptures = [];
    const origFetch = window.fetch;
    window.fetch = function (...args) {
      const url = typeof args[0] === "string" ? args[0] : args[0]?.url || "";
      const body = args[1]?.body;
      const method = args[1]?.method || "GET";
      const result = origFetch.apply(this, args).then(async (r) => {
        try {
          const text = await r.clone().text();
          if (url.includes("/voyager/api/")) {
            window.__fetchCaptures.push({ url, method, body, status: r.status, respBody: text.substring(0, 5000) });
          }
        } catch {}
        return r;
      });
      return result;
    };
  });

  await page.goto(`https://www.linkedin.com/in/${vanity}`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(5000);
  const beforeCount = await page.evaluate(() => window.__fetchCaptures?.length || 0);
  console.log("Captures before click:", beforeCount);

  // Click Contact info
  const ciLink = await page.$('a:has-text("Contact info")');
  if (ciLink) {
    console.log("Clicking Contact info...");
    await ciLink.click();
    await page.waitForTimeout(5000);
  }

  const captures = await page.evaluate(() => window.__fetchCaptures || []);
  console.log("Total captures after click:", captures.length);

  // Filter for ones with email/phone
  const withContact = captures.filter(c => /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/.test(c.respBody) || /9368084140/.test(c.respBody) || /phoneNumber|emailAddress/i.test(c.respBody));
  console.log("Captures with contact data:", withContact.length);
  withContact.forEach(c => {
    console.log(`\n${c.method} ${c.status} ${c.url.replace("https://www.linkedin.com", "")}`);
    if (c.body) console.log("  REQ body:", c.body.substring(0, 200));
    console.log("  RESP:", c.respBody.substring(0, 2000));
  });

  await ctx.close();
  await browser.close();
})().catch((e) => { console.error("FATAL:", e.message, e.stack); process.exit(1); });
