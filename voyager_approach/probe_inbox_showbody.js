// Show full response body for empty test 1
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

  // Capture csrf + page-instance from a real voyager request
  let capturedCsrf = null, capturedPageInstance = null;
  page.on("request", (r) => {
    if (r.url().includes("/voyager/") && !capturedCsrf) {
      capturedCsrf = r.headers()["csrf-token"];
      capturedPageInstance = r.headers()["x-li-page-instance"];
    }
  });

  await page.goto("https://www.linkedin.com/messaging/", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(5000);

  // Use the EXACT page-instance the real UI used (with a fresh one for each call)
  // by re-capturing the latest one
  async function callAndShow(url, referer) {
    // Re-listen for the latest page-instance value (it can change per call)
    return await page.evaluate(async ({ url, csrf, referer }) => {
      // Re-read csrf from the latest meta (in case it rotated)
      const meta = document.querySelector('meta[name="csrf-token"]');
      const csrfFromMeta = meta ? meta.getAttribute("content") : csrf;
      const r = await fetch(url, {
        credentials: "include",
        headers: {
          "csrf-token": csrfFromMeta || csrf,
          "x-restli-protocol-version": "2.0.0",
          "accept": "application/graphql",
          "x-li-lang": "en_US",
          "referer": referer,
        }
      });
      return { status: r.status, body: await r.text() };
    }, { url, csrf: capturedCsrf, referer });
  }

  // Replicate EXACTLY what the real UI sent: full thread list call
  const listUrl = `https://www.linkedin.com/voyager/api/voyagerMessagingGraphQL/graphql?queryId=messengerConversations.0d5e6781bbee71c3e51c8843c6519f48&variables=(mailboxUrn:${encodeURIComponent(mailboxUrn)})`;
  console.log("=== THREAD LIST ===");
  const r1 = await callAndShow(listUrl, "https://www.linkedin.com/messaging/");
  console.log(`Status: ${r1.status}`);
  console.log(`Body length: ${r1.body.length}`);
  console.log(`Body: ${r1.body.substring(0, 3000)}`);

  // Messages in conversation
  console.log("\n=== MESSAGES IN CONVO ===");
  const messagesUrl = `https://www.linkedin.com/voyager/api/voyagerMessagingGraphQL/graphql?queryId=messengerMessages.5846eeb71c981f11e0134cb6626cc314&variables=(conversationUrn:${encodeURIComponent(conversationUrn)})`;
  const r2 = await callAndShow(messagesUrl, "https://www.linkedin.com/messaging/");
  console.log(`Status: ${r2.status}`);
  console.log(`Body: ${r2.body.substring(0, 2000)}`);

  await ctx.close();
  await browser.close();
})().catch((e) => { console.error("FATAL:", e.message, e.stack); process.exit(1); });
