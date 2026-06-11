// Try REST endpoint (not GraphQL) with exact same shape as real UI
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
const conversationUrn = `urn:li:msg_conversation:(urn:li:fsd_profile:${M},2-OGRhYWFmM2ItNTYxYi00MDI3LTk2YWItMTg5NTE0NGFiYThmXzEwMA==)`;

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

  // Find csrf from a real voyager call
  const realCsrfRef = { value: null };
  page.on("request", (r) => {
    if (r.url().includes("/voyager/") && !realCsrfRef.value) {
      realCsrfRef.value = r.headers()["csrf-token"];
    }
  });

  await page.goto("https://www.linkedin.com/messaging/thread/2-OGRhYWFmM2ItNTYxYi00MDI3LTk2YWItMTg5NTE0NGFiYThmXzEwMA==/", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(8000);
  console.log(`csrf: ${realCsrfRef.value}`);

  // Capture all voyager calls during this page load
  const calls = [];
  page.on("request", (r) => {
    if (r.url().includes("messenger") || r.url().includes("conversations") || r.url().includes("messages")) {
      calls.push({ method: r.method(), url: r.url(), headers: r.headers() });
    }
  });
  // Already past page load — but we can manually fire more by scrolling
  // Instead, let me just look at the calls that already happened via the response listener
  const responses = [];
  page.on("response", async (r) => {
    if (r.url().includes("messenger") || r.url().includes("conversations") || r.url().includes("messages")) {
      try {
        const text = await r.text();
        responses.push({ url: r.url(), status: r.status(), body: text.substring(0, 30000) });
      } catch {}
    }
  });

  // Reload to capture fresh
  await page.goto("https://www.linkedin.com/messaging/thread/2-OGRhYWFmM2ItNTYxYi00MDI3LTk2YWItMTg5NTE0NGFiYThmXzEwMA==/", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(8000);

  console.log(`\n=== Captured ${responses.length} voyager calls during thread page load ===`);
  for (const r of responses) {
    console.log(`\n[${r.status}] ${r.url.substring(0, 200)}`);
    console.log(`  body: ${r.body.substring(0, 800).replace(/\n/g, " ")}`);
  }

  // Save all
  fs.writeFileSync(
    path.join(__dirname, "sessions", "live", "thread_page_capture.json"),
    JSON.stringify(responses, null, 2)
  );

  await ctx.close();
  await browser.close();
})().catch((e) => { console.error("FATAL:", e.message, e.stack); process.exit(1); });
