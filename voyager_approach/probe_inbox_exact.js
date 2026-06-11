// Capture EXACT URLs of thread list from real UI
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

  const captured = [];
  page.on("request", (r) => {
    if (r.url().includes("voyager") && r.url().includes("messag")) {
      captured.push({
        method: r.method(),
        url: r.url(),
        headers: r.headers(),
        body: r.postData()?.substring(0, 500),
      });
    }
  });
  page.on("response", async (r) => {
    if (r.url().includes("voyager") && r.url().includes("messag")) {
      try {
        const text = await r.text();
        const last = captured[captured.length - 1];
        if (last && last.url === r.url() && !last.status) {
          last.status = r.status();
          last.body = text.substring(0, 5000);
        }
      } catch {}
    }
  });

  console.log("Loading /messaging/...");
  await page.goto("https://www.linkedin.com/messaging/", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(8000);

  console.log(`Captured ${captured.length} voyager messaging calls\n`);

  // Filter to ones with status 200 and a body, and show full URL+body for the thread list candidates
  for (const c of captured) {
    if (c.status === 200) {
      console.log(`[${c.status}] ${c.method} ${c.url.substring(0, 250)}`);
      console.log(`    Body snippet: ${(c.body || "").substring(0, 400).replace(/\n/g, " ")}`);
      console.log();
    }
  }

  fs.writeFileSync(
    path.join(__dirname, "sessions", "live", "inbox_exact_calls.json"),
    JSON.stringify(captured, null, 2)
  );
  console.log("Saved to inbox_exact_calls.json");

  await ctx.close();
  await browser.close();
})().catch((e) => { console.error("FATAL:", e.message, e.stack); process.exit(1); });
