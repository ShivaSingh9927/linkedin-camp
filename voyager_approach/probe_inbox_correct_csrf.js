// Get csrf-token the right way — from any voyager request the page makes
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

  // Capture a real voyager request's csrf header
  let capturedCsrf = null;
  let capturedPageInstance = null;
  let capturedReferer = null;
  page.on("request", (r) => {
    if (r.url().includes("/voyager/") && !capturedCsrf) {
      capturedCsrf = r.headers()["csrf-token"];
      capturedPageInstance = r.headers()["x-li-page-instance"];
      capturedReferer = r.headers()["referer"];
    }
  });

  console.log("Step 1: Visit /messaging/ to capture csrf-token from real request...");
  await page.goto("https://www.linkedin.com/messaging/", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(5000);
  console.log(`Captured csrf: ${capturedCsrf}`);
  console.log(`Captured page-instance: ${capturedPageInstance}`);
  console.log(`Captured referer: ${capturedReferer}`);

  // Now fire the actual calls we want with the captured csrf
  async function call(url, pageInstance, referer) {
    return await page.evaluate(async ({ url, csrf, pageInstance, referer }) => {
      const r = await fetch(url, {
        credentials: "include",
        headers: {
          "csrf-token": csrf,
          "x-restli-protocol-version": "2.0.0",
          "accept": "application/graphql",
          "x-li-lang": "en_US",
          "x-li-page-instance": pageInstance,
          "referer": referer,
        }
      });
      return { status: r.status, body: (await r.text()).substring(0, 80000) };
    }, { url, csrf: capturedCsrf, pageInstance, referer });
  }

  console.log("\n=== TEST 1: Thread list (initial, no cursor) ===");
  const listUrl = `https://www.linkedin.com/voyager/api/voyagerMessagingGraphQL/graphql?queryId=messengerConversations.0d5e6781bbee71c3e51c8843c6519f48&variables=(mailboxUrn:${encodeURIComponent(mailboxUrn)})`;
  const r1 = await call(listUrl, capturedPageInstance, "https://www.linkedin.com/messaging/");
  console.log(`Status: ${r1.status}`);
  if (r1.status === 200) {
    const parsed = JSON.parse(r1.body);
    const ct = parsed.data?.data?.messengerConversationsBySyncToken;
    const elements = ct?.["*elements"] || [];
    const included = parsed.data?.included || [];
    console.log(`✅ Got ${elements.length} thread URNs + ${included.length} inline objects`);
    elements.forEach((urn, i) => {
      const convo = included.find(x => x.entityUrn === urn);
      if (convo) {
        const me = convo.conversationParticipants?.find(p => p.distance === 'SELF')?.participantType?.member;
        const other = convo.conversationParticipants?.find(p => p.distance !== 'SELF')?.participantType?.member;
        const preview = convo.events?.[0]?.eventContent?.message?.body?.text || convo.lastMessageContent?.text || "(no preview)";
        console.log(`  ${i+1}. [${other?.firstName?.text} ${other?.lastName?.text}] (${other?.headline?.text?.substring(0, 30)}) — unread=${convo.unreadCount} preview="${preview?.substring(0, 50)}"`);
      } else {
        console.log(`  ${i+1}. [urn only] ${urn.substring(0, 100)}`);
      }
    });
    console.log(`syncToken: ${ct?.metadata?.newSyncToken}`);
    fs.writeFileSync(path.join(__dirname, "sessions", "live", "voyager_inbox_threads.json"), r1.body);
  } else {
    console.log(`Body: ${r1.body.substring(0, 500)}`);
  }

  console.log("\n=== TEST 2: Messages in conversation ===");
  const messagesUrl = `https://www.linkedin.com/voyager/api/voyagerMessagingGraphQL/graphql?queryId=messengerMessages.5846eeb71c981f11e0134cb6626cc314&variables=(conversationUrn:${encodeURIComponent(conversationUrn)})`;
  const r2 = await call(messagesUrl, "urn:li:page:d_flagship3_messaging_conversation_detail;600e8a90-d563-454e-85bd-fa79046447bb", "https://www.linkedin.com/messaging/");
  console.log(`Status: ${r2.status}`);
  if (r2.status === 200) {
    const parsed = JSON.parse(r2.body);
    const ct = parsed.data?.data?.messengerMessagesBySyncToken;
    const elements = ct?.["*elements"] || [];
    const included = parsed.data?.included || [];
    console.log(`✅ Got ${elements.length} message URNs + ${included.length} inline objects`);
    elements.forEach((urn, i) => {
      const msg = included.find(x => x.entityUrn === urn);
      if (msg) {
        const sender = msg.sender?.participantType?.member;
        const isFromMe = sender?.distance === 'SELF';
        const text = msg.body?.text?.substring(0, 80);
        const delivered = msg.deliveredAt ? new Date(msg.deliveredAt).toISOString() : '?';
        console.log(`  ${i+1}. [${isFromMe ? 'ME' : (sender?.firstName?.text || '?')}] ${text}`);
      }
    });
    fs.writeFileSync(path.join(__dirname, "sessions", "live", "voyager_inbox_messages.json"), r2.body);
  } else {
    console.log(`Body: ${r2.body.substring(0, 500)}`);
  }

  await ctx.close();
  await browser.close();
})().catch((e) => { console.error("FATAL:", e.message, e.stack); process.exit(1); });
