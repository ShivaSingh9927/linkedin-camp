// Debug the messages endpoint shape
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
const convUrn = "urn:li:msg_conversation:(urn:li:fsd_profile:ACoAAGj45loB-nQmKeQasQoZJdn3YHCj5cYXRle0,2-OGRhYWFmM2ItNTYxYi00MDI3LTk2YWItMTg5NTE0NGFiYThmXzEwMA==)";

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

  const csrfRef = { value: null };
  const piRef = { value: null };
  page.on("request", (r) => {
    if (r.url().includes("/voyager/") && !csrfRef.value) {
      csrfRef.value = r.headers()["csrf-token"];
      piRef.value = r.headers()["x-li-page-instance"];
    }
  });

  await page.goto("https://www.linkedin.com/messaging/", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(12000); // let threads render

  // After page load, capture LATEST page-instance from a polling call
  const allHeaders = [];
  page.on("request", (r) => {
    if (r.url().includes("messengerConversations") || r.url().includes("messengerMessages")) {
      allHeaders.push({
        url: r.url(),
        csrf: r.headers()["csrf-token"],
        pi: r.headers()["x-li-page-instance"],
        time: Date.now(),
      });
    }
  });

  // Get the thread list first to find the active convo URN
  const listUrl = `https://www.linkedin.com/voyager/api/voyagerMessagingGraphQL/graphql?queryId=messengerConversations.0d5e6781bbee71c3e51c8843c6519f48&variables=(mailboxUrn:${encodeURIComponent(mailboxUrn)})`;
  const listResult = await page.evaluate(async ({ url, csrf, pi }) => {
    const r = await fetch(url, {
      method: "GET", credentials: "include",
      headers: {
        "csrf-token": csrf, "x-restli-protocol-version": "2.0.0",
        "accept": "application/graphql",
        "x-li-lang": "en_US", "x-li-page-instance": pi,
      }
    });
    return { status: r.status, body: await r.text() };
  }, { url: listUrl, csrf: csrfRef.value, pi: piRef.value });

  console.log(`List status: ${listResult.status}`);
  const list = JSON.parse(listResult.body);
  const elements = list.data?.data?.messengerConversationsBySyncToken?.elements || [];
  console.log(`Threads: ${elements.length}`);
  if (elements.length > 0) {
    const first = elements[0];
    console.log(`First thread keys: ${Object.keys(first).join(", ")}`);
    console.log(`First thread entityUrn: ${first.entityUrn}`);
    const included = list.data?.data?.included || [];
    const fullConvo = included.find(e => e.entityUrn === first.entityUrn);
    if (fullConvo) {
      console.log(`First thread full data: ${JSON.stringify(fullConvo).substring(0, 500)}`);
    }
  }

  // Get messages using a URN from the just-fetched list
  let realConvUrn = convUrn;
  if (elements.length === 0) {
    console.log("\nList returned 0 — trying with a different page-instance from latest voyager call");
    // The first list call may have stale page-instance. Re-fetch with fresh.
  }

  // Try messages in a hardcoded URN with FULL URL-encoding (the issue is the comma/parenthesis inside the URN)
  const convUrn2 = "urn%3Ali%3Amsg_conversation%3A%28urn%3Ali%3Afsd_profile%3AACoAAGj45loB-nQmKeQasQoZJdn3YHCj5cYXRle0%2C2-OGRhYWFmM2ItNTYxYi00MDI3LTk2YWItMTg5NTE0NGFiYThmXzEwMA%3D%3D%29";
  console.log(`\n=== MESSAGES IN: ${decodeURIComponent(convUrn2).substring(0, 60)}... ===`);
  const msgUrl = `https://www.linkedin.com/voyager/api/voyagerMessagingGraphQL/graphql?queryId=messengerMessages.5846eeb71c981f11e0134cb6626cc314&variables=(conversationUrn:${convUrn2})`;
  const msgResult = await page.evaluate(async ({ url, csrf, pi }) => {
    const r = await fetch(url, {
      method: "GET", credentials: "include",
      headers: {
        "csrf-token": csrf, "x-restli-protocol-version": "2.0.0",
        "accept": "application/graphql",
        "x-li-lang": "en_US", "x-li-page-instance": pi,
      }
    });
    return { status: r.status, body: await r.text() };
  }, { url: msgUrl, csrf: csrfRef.value, pi: piRef.value });
  console.log(`Status: ${msgResult.status}`);
  const msgJson = JSON.parse(msgResult.body);
  const ct = msgJson.data?.data?.messengerMessagesBySyncToken;
  console.log(`Keys: ${Object.keys(ct || {}).join(", ")}`);
  console.log(`elements type: ${typeof ct?.elements}, isArray: ${Array.isArray(ct?.elements)}`);
  if (Array.isArray(ct?.elements)) {
    console.log(`element count: ${ct.elements.length}`);
    ct.elements.forEach((e, i) => {
      if (typeof e === "string") {
        console.log(`  [${i}] URN: ${e.substring(0, 80)}...`);
      } else {
        console.log(`  [${i}] object keys: ${Object.keys(e).join(", ")}`);
        console.log(`       body: ${JSON.stringify(e.body).substring(0, 200)}`);
      }
    });
  } else if (ct?.["*elements"]) {
    console.log(`*elements: ${ct["*elements"].length}`);
    ct["*elements"].forEach(e => console.log(`  URN: ${e.substring(0, 100)}`));
  }
  console.log(`included: ${(msgJson.data?.included || []).length}`);
  (msgJson.data?.included || []).slice(0, 3).forEach((e, i) => {
    console.log(`  included[${i}]: ${JSON.stringify(e).substring(0, 300)}`);
  });
  fs.writeFileSync(path.join(__dirname, "sessions", "live", "messages_debug.json"), msgResult.body);

  await ctx.close();
  await browser.close();
})().catch((e) => { console.error("FATAL:", e.message, e.stack); process.exit(1); });
