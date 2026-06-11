// Diagnose WHY pure-fetch fails when real UI succeeds
// Test: copy the EXACT real-UI URL with the syncToken from prior call
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

  // Capture what headers the real UI sends
  const realUIHeaders = [];
  page.on("request", (r) => {
    if (r.url().includes("messengerMessages") || r.url().includes("messengerConversations.0d5e")) {
      realUIHeaders.push({
        url: r.url(),
        method: r.method(),
        headers: r.headers(),
        body: r.postData()?.substring(0, 200),
      });
    }
  });

  console.log("Step 1: Visit /messaging/ and let it render fully...");
  await page.goto("https://www.linkedin.com/messaging/", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(8000);

  console.log(`\nCaptured ${realUIHeaders.length} relevant calls from real UI`);
  for (const h of realUIHeaders.slice(0, 3)) {
    console.log(`\n[${h.method}] ${h.url.substring(0, 150)}`);
    console.log("  Headers:");
    for (const [k, v] of Object.entries(h.headers)) {
      if (k.startsWith("x-") || k === "csrf-token" || k === "accept" || k === "content-type" || k === "user-agent" || k === "sec-ch-ua" || k === "origin" || k === "referer") {
        console.log(`    ${k}: ${v.substring(0, 150)}`);
      }
    }
  }

  // Now try the same call with same headers from page.evaluate
  console.log("\n\n=== STEP 2: Re-issue the same call with same headers from page.evaluate ===");
  const lastCall = realUIHeaders[realUIHeaders.length - 1];
  if (lastCall) {
    const r = await page.evaluate(async ({ url, csrf, method, body }) => {
      const opts = {
        method,
        headers: {
          "csrf-token": csrf,
          "x-restli-protocol-version": "2.0.0",
          "accept": "application/vnd.linkedin.normalized+json+2.1",
        },
        credentials: "include",
      };
      if (body) opts.body = body;
      const resp = await fetch(url, opts);
      return { status: resp.status, body: (await resp.text()).substring(0, 2000) };
    }, { url: lastCall.url, csrf, method: lastCall.method, body: lastCall.body });
    console.log(`Re-issued status: ${r.status}`);
    console.log(`Body: ${r.body.substring(0, 1500)}`);
  }

  // Try the exact messages URL with no body
  console.log("\n=== STEP 3: Direct call to messages URL with credentials: include ===");
  const messagesUrl = `https://www.linkedin.com/voyager/api/voyagerMessagingGraphQL/graphql?queryId=messengerMessages.5846eeb71c981f11e0134cb6626cc314&variables=(conversationUrn:${encodeURIComponent(conversationUrn)})`;
  const r2 = await page.evaluate(async ({ url, csrf }) => {
    const resp = await fetch(url, {
      credentials: "include",
      headers: {
        "csrf-token": csrf,
        "x-restli-protocol-version": "2.0.0",
        "accept": "application/vnd.linkedin.normalized+json+2.1",
      }
    });
    return { status: resp.status, body: (await resp.text()).substring(0, 2000) };
  }, { url: messagesUrl, csrf });
  console.log(`Status: ${r2.status}`);
  console.log(`Body: ${r2.body.substring(0, 1500)}`);

  await ctx.close();
  await browser.close();
})().catch((e) => { console.error("FATAL:", e.message, e.stack); process.exit(1); });
