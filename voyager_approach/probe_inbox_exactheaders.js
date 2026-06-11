// Capture the EXACT request headers from the real UI's first messenger call
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
const M = "ACoAAGj45loB-nQmKeQasQoZJdn3YHCj5cYXRle0";
const mailboxUrn = `urn:li:fsd_profile:${M}`;

(async () => {
  const cookies = JSON.parse(fs.readFileSync(path.join(SESSION, "cookies.json"), "utf8"));
  const browser = await chromium.launch({
    headless: true, proxy: PROXY,
    args: ["--disable-blink-features=AutomationControlled"],
  });
  const ctx = await browser.newContext({
    userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36",
    locale: "en-IN", timezoneId: "Asia/Kolkata", proxy: PROXY,
  });
  await ctx.addCookies(cookies);
  const page = await ctx.newPage();

  // Capture the first messenger request in full
  const firstRequest = { value: null };
  page.on("request", (r) => {
    if (r.url().includes("messengerConversations.0d5e") && !firstRequest.value) {
      firstRequest.value = {
        url: r.url(),
        method: r.method(),
        headers: r.headers(),
        body: r.postData()?.substring(0, 1000),
      };
    }
  });

  await page.goto("https://www.linkedin.com/messaging/", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(5000);

  console.log("=== EXACT REQUEST FROM REAL UI ===");
  console.log(`URL: ${firstRequest.value.url}`);
  console.log(`Method: ${firstRequest.value.method}`);
  console.log(`\nAll headers:`);
  for (const [k, v] of Object.entries(firstRequest.value.headers)) {
    console.log(`  ${k}: ${v}`);
  }

  // Now re-fire with EXACT same headers
  const r1 = await page.evaluate(async ({ req }) => {
    const r = await fetch(req.url, {
      method: req.method,
      headers: req.headers,
      credentials: "include",
    });
    return { status: r.status, body: (await r.text()).substring(0, 2000) };
  }, { req: firstRequest.value });
  console.log(`\n\n=== RE-FIRED WITH EXACT SAME HEADERS ===`);
  console.log(`Status: ${r1.status}`);
  console.log(`Body: ${r1.body}`);

  await ctx.close();
  await browser.close();
})().catch((e) => { console.error("FATAL:", e.message, e.stack); process.exit(1); });
