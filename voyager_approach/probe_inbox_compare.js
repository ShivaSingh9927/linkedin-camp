// Compare: real UI call vs page.evaluate re-fire
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

  // Track all voyager calls (request + response with body)
  const allCalls = [];
  page.on("request", (r) => {
    if (r.url().includes("messengerConversations.0d5e")) {
      allCalls.push({
        source: "real",
        url: r.url(),
        headers: r.headers(),
        time: Date.now(),
      });
    }
  });
  page.on("response", async (r) => {
    if (r.url().includes("messengerConversations.0d5e")) {
      const last = allCalls[allCalls.length - 1];
      if (last && last.url === r.url() && !last.status) {
        last.status = r.status();
        try { last.body = await r.text(); } catch {}
      }
    }
  });

  await page.goto("https://www.linkedin.com/messaging/", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(8000);

  // Get the headers from the real call
  const realCall = allCalls[0];
  if (!realCall) { console.log("No real call captured"); process.exit(1); }
  const realHeaders = realCall.headers;
  console.log(`Real call status: ${realCall.status}`);
  console.log(`Real call body length: ${realCall.body?.length || 0}`);
  if (realCall.body) {
    const parsed = JSON.parse(realCall.body);
    const elements = parsed.data?.data?.messengerConversationsBySyncToken?.elements || [];
    console.log(`Real call returned ${elements.length} threads`);
  }
  console.log(`\n=== Real headers ===`);
  for (const [k, v] of Object.entries(realHeaders)) {
    console.log(`${k}: ${v}`);
  }

  // Now do the page.evaluate re-fire
  const listUrl = `https://www.linkedin.com/voyager/api/voyagerMessagingGraphQL/graphql?queryId=messengerConversations.0d5e6781bbee71c3e51c8843c6519f48&variables=(mailboxUrn:${encodeURIComponent(mailboxUrn)})`;
  const r1 = await page.evaluate(async ({ url, headers }) => {
    // Build a Headers object
    const h = new Headers();
    for (const [k, v] of Object.entries(headers)) {
      h.set(k, v);
    }
    const r = await fetch(url, { method: "GET", headers: h, credentials: "include" });
    return { status: r.status, body: await r.text() };
  }, { url: listUrl, headers: realHeaders });
  console.log(`\n\n=== Re-fire status: ${r1.status} ===`);
  console.log(`Body: ${r1.body.substring(0, 800)}`);

  // Now try via page.context().request which is Playwright's HTTP client (not page.evaluate fetch)
  console.log("\n\n=== TRY: context.request (Playwright HTTP) ===");
  try {
    const ctxReq = await ctx.request.get(listUrl, {
      headers: realHeaders,
    });
    const ctxBody = await ctxReq.text();
    console.log(`Status: ${ctxReq.status()}`);
    const parsedCtx = JSON.parse(ctxBody);
    const elementsCtx = parsedCtx.data?.data?.messengerConversationsBySyncToken?.elements || [];
    console.log(`Threads: ${elementsCtx.length}`);
  } catch (e) {
    console.log(`Error: ${e.message}`);
  }

  await ctx.close();
  await browser.close();
})().catch((e) => { console.error("FATAL:", e.message, e.stack); process.exit(1); });
