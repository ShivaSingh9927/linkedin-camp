// Inbox API viability probe — 4 specific endpoints that real UI uses
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
  const csrf = cookies.find(c => c.name === "JSESSIONID").value.replace(/"/g, "");
  const cookieStr = cookies.map(c => `${c.name}=${c.value}`).join("; ");

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
  await page.goto("https://www.linkedin.com/feed/", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(4000);

  async function call(method, url, body) {
    return await page.evaluate(async ({ method, url, csrf, body }) => {
      const opts = {
        method,
        headers: {
          "csrf-token": csrf,
          "x-restli-protocol-version": "2.0.0",
          "accept": "application/vnd.linkedin.normalized+json+2.1",
          "content-type": "application/json",
        },
      };
      if (body) opts.body = JSON.stringify(body);
      const r = await fetch(url, opts);
      const text = await r.text();
      return { status: r.status, body: text };
    }, { method, url, csrf, body });
  }

  // Capture ALL voyager calls during the test to discover queryIds automatically
  const liveVoyagerCalls = [];
  page.on("response", async (r) => {
    if (r.url().includes("/voyager/api/voyagerMessaging") || r.url().includes("/voyager/api/messaging/")) {
      try {
        liveVoyagerCalls.push({ url: r.url(), status: r.status(), body: (await r.text()).substring(0, 5000) });
      } catch {}
    }
  });

  console.log("=".repeat(80));
  console.log("PROBE 1: Navigate to /messaging/ to capture real thread list queryId");
  console.log("=".repeat(80));
  await page.goto("https://www.linkedin.com/messaging/", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(8000);
  console.log(`Captured ${liveVoyagerCalls.length} messaging calls during page load`);

  // Print unique queryIds found
  const queryIds = new Set();
  for (const c of liveVoyagerCalls) {
    const m = c.url.match(/queryId=([a-zA-Z0-9._-]+)/);
    if (m) queryIds.add(m[1]);
  }
  console.log(`\nUnique queryIds: ${[...queryIds].join(", ")}`);

  // Save raw captures
  fs.writeFileSync(
    path.join(__dirname, "sessions", "live", "inbox_probe_raw.json"),
    JSON.stringify(liveVoyagerCalls, null, 2)
  );
  console.log("Saved to sessions/live/inbox_probe_raw.json");

  // Show first 200 chars of each unique call
  console.log("\n=== UNIQUE CALLS BY URL ===");
  const seen = new Set();
  for (const c of liveVoyagerCalls) {
    const key = c.url.split("?")[0];
    if (seen.has(key)) continue;
    seen.add(key);
    console.log(`\n[${c.status}] ${c.url.substring(0, 200)}`);
    console.log(`  ${c.body.substring(0, 300).replace(/\n/g, " ")}...`);
  }

  await ctx.close();
  await browser.close();
})().catch((e) => { console.error("FATAL:", e.message, e.stack); process.exit(1); });
