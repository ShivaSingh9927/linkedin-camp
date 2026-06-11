// Hit the inbox THREAD page directly, then immediately fire a messages call
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

  // Capture ALL voyager call headers (latest wins)
  let latestCsrf = null, latestPi = null;
  page.on("request", (r) => {
    if (r.url().includes("/voyager/")) {
      latestCsrf = r.headers()["csrf-token"];
      latestPi = r.headers()["x-li-page-instance"];
    }
  });

  // Navigate DIRECTLY to the thread page
  console.log("Navigating to thread page...");
  await page.goto("https://www.linkedin.com/messaging/thread/2-OGRhYWFmM2ItNTYxYi00MDI3LTk2YWItMTg5NTE0NGFiYThmXzEwMA==/", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(10000);
  console.log(`After thread page load: csrf=${latestCsrf?.substring(0, 30)}, pi=${latestPi?.substring(0, 60)}`);

  // Fire the messages call with the freshest headers
  const convUrn = "urn%3Ali%3Amsg_conversation%3A%28urn%3Ali%3Afsd_profile%3AACoAAGj45loB-nQmKeQasQoZJdn3YHCj5cYXRle0%2C2-OGRhYWFmM2ItNTYxYi00MDI3LTk2YWItMTg5NTE0NGFiYThmXzEwMA%3D%3D%29";
  const msgUrl = `https://www.linkedin.com/voyager/api/voyagerMessagingGraphQL/graphql?queryId=messengerMessages.5846eeb71c981f11e0134cb6626cc314&variables=(conversationUrn:${convUrn})`;
  const r = await page.evaluate(async ({ url, csrf, pi }) => {
    const resp = await fetch(url, {
      method: "GET", credentials: "include",
      headers: {
        "csrf-token": csrf, "x-restli-protocol-version": "2.0.0",
        "accept": "application/graphql",
        "x-li-lang": "en_US", "x-li-page-instance": pi,
      }
    });
    return { status: resp.status, body: await resp.text() };
  }, { url: msgUrl, csrf: latestCsrf, pi: latestPi });

  console.log(`\nMessages status: ${r.status}`);
  const parsed = JSON.parse(r.body);
  console.log(`Full body (first 1500): ${r.body.substring(0, 1500)}`);

  await ctx.close();
  await browser.close();
})().catch((e) => { console.error("FATAL:", e.message, e.stack); process.exit(1); });
