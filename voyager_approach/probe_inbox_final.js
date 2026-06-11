// Get the full thread + messages with correct headers (extract csrf: prefix + page-instance)
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
  await page.goto("https://www.linkedin.com/feed/", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(3000);

  // Read csrf WITH the ajax: prefix from the page
  const csrfAjax = await page.evaluate(() => {
    // LinkedIn sets this as a meta tag
    const meta = document.querySelector('meta[name="csrf-token"]');
    return meta ? meta.getAttribute("content") : null;
  });
  console.log(`csrf-token (with prefix): ${csrfAjax}`);

  // Get x-li-page-instance (page context)
  // For inbox, the page-instance is `urn:li:page:d_messaging_index` for list view,
  // and `urn:li:page:d_flagship3_messaging_conversation_detail` for thread view
  // For our case, let's use the inbox-list one (we want to list all threads)

  async function call(method, url, body, extraHeaders = {}) {
    return await page.evaluate(async ({ method, url, csrfAjax, body, extraHeaders }) => {
      const opts = {
        method,
        headers: {
          "csrf-token": csrfAjax,
          "x-restli-protocol-version": "2.0.0",
          "accept": "application/graphql",
          "x-li-lang": "en_US",
          ...extraHeaders,
        },
        credentials: "include",
      };
      if (body) opts.body = JSON.stringify(body);
      const r = await fetch(url, opts);
      return { status: r.status, body: (await r.text()).substring(0, 80000) };
    }, { method, url, csrfAjax, body, extraHeaders });
  }

  // Test 1: Thread list with proper page-instance
  console.log("\n=== TEST 1: Thread list with proper page-instance ===");
  const listUrl = `https://www.linkedin.com/voyager/api/voyagerMessagingGraphQL/graphql?queryId=messengerConversations.0d5e6781bbee71c3e51c8843c6519f48&variables=(mailboxUrn:${encodeURIComponent(mailboxUrn)})`;
  const r1 = await call("GET", listUrl, null, {
    "x-li-page-instance": "urn:li:page:d_messaging_index;600e8a90-d563-454e-85bd-fa79046447bb",
    "referer": "https://www.linkedin.com/messaging/",
  });
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
        console.log(`  ${i+1}. [${me?.firstName?.text} ${me?.lastName?.text}] <-> [${other?.firstName?.text} ${other?.lastName?.text}] (${other?.headline?.text?.substring(0, 40)})`);
        console.log(`     unread=${convo.unreadCount} activity=${new Date(convo.lastActivityAt).toISOString()}`);
        console.log(`     urn: ${urn}`);
      } else {
        console.log(`  ${i+1}. [urn only] ${urn}`);
      }
    });
    console.log(`syncToken: ${ct?.metadata?.newSyncToken}`);
    fs.writeFileSync(path.join(__dirname, "sessions", "live", "voyager_inbox_threads.json"), r1.body);
    console.log("Saved to voyager_inbox_threads.json");
  } else {
    console.log(`Body: ${r1.body.substring(0, 1000)}`);
  }

  // Test 2: Get messages in a conversation
  console.log("\n=== TEST 2: Messages in conversation ===");
  const messagesUrl = `https://www.linkedin.com/voyager/api/voyagerMessagingGraphQL/graphql?queryId=messengerMessages.5846eeb71c981f11e0134cb6626cc314&variables=(conversationUrn:${encodeURIComponent(conversationUrn)})`;
  const r2 = await call("GET", messagesUrl, null, {
    "x-li-page-instance": "urn:li:page:d_flagship3_messaging_conversation_detail;600e8a90-d563-454e-85bd-fa79046447bb",
    "referer": "https://www.linkedin.com/messaging/thread/2-OGRhYWFmM2ItNTYxYi00MDI3LTk2YWItMTg5NTE0NGFiYThmXzEwMA==/",
  });
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
        console.log(`  ${i+1}. [${isFromMe ? 'ME' : sender?.firstName?.text}] ${text} (${delivered})`);
      }
    });
    console.log(`syncToken: ${ct?.metadata?.newSyncToken}`);
    fs.writeFileSync(path.join(__dirname, "sessions", "live", "voyager_inbox_messages.json"), r2.body);
  } else {
    console.log(`Body: ${r2.body.substring(0, 500)}`);
  }

  await ctx.close();
  await browser.close();
})().catch((e) => { console.error("FATAL:", e.message, e.stack); process.exit(1); });
