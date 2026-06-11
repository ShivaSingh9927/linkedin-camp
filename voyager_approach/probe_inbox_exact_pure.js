// Test the EXACT thread list URL captured from real UI, via pure fetch
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
const M = "ACoAAGj45loB-nQmKeQasQoZJdn3YHCj5cYXRe0";  // self — note capital E
const mailboxUrn = `urn:li:fsd_profile:${M}`;
const conversationUrn = `urn:li:msg_conversation:(urn:li:fsd_profile:${M},2-OGRhYWFmM2ItNTYxYi00MDI3LTk2YWItMTg5NTE0NGFiYThmXzEwMA==)`;

(async () => {
  const cookies = JSON.parse(fs.readFileSync(path.join(SESSION, "cookies.json"), "utf8"));
  const csrf = cookies.find(c => c.name === "JSESSIONID").value.replace(/"/g, "");
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
  await page.waitForTimeout(3000);

  async function call(url) {
    return await page.evaluate(async ({ url, csrf }) => {
      const r = await fetch(url, {
        headers: {
          "csrf-token": csrf,
          "x-restli-protocol-version": "2.0.0",
          "accept": "application/vnd.linkedin.normalized+json+2.1",
        }
      });
      return { status: r.status, body: await r.text() };
    }, { url, csrf });
  }

  // THREAD LIST (exact URL from real UI capture)
  const threadListUrl = `https://www.linkedin.com/voyager/api/voyagerMessagingGraphQL/graphql?queryId=messengerConversations.9501074288a12f3ae9e3c7ea243bccbf&variables=(query:(predicateUnions:List((conversationCategoryPredicate:(category:INBOX)))),count:20,mailboxUrn:${encodeURIComponent(mailboxUrn)})`;
  
  console.log("Testing EXACT thread list URL from real UI capture:");
  console.log(threadListUrl);
  console.log();
  const r1 = await call(threadListUrl);
  console.log(`Status: ${r1.status}`);
  console.log(`Body (first 5000 chars):`);
  console.log(r1.body.substring(0, 5000));

  await ctx.close();
  await browser.close();
})().catch((e) => { console.error("FATAL:", e.message, e.stack); process.exit(1); });
