// Full inbox sync test: thread list + messages + mailbox counts
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

  // Capture the EXACT first request headers from the real UI
  const realHeaders = { value: null };
  page.on("request", (r) => {
    if (r.url().includes("messengerConversations.0d5e") && !realHeaders.value) {
      realHeaders.value = r.headers();
    }
  });

  // Open /messaging/ to trigger real call (needed to obtain valid page-instance + csrf)
  await page.goto("https://www.linkedin.com/messaging/", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(12000); // longer wait for full page to render and load thread list
  console.log(`First-captured page-instance: ${realHeaders.value["x-li-page-instance"]}`);

  // Wait for an ADDITIONAL messenger call (the polling loop fires continuously) and use that header set
  await new Promise((resolve) => {
    const onReq = (r) => {
      if (r.url().includes("messengerConversations")) {
        realHeaders.value = r.headers();
        page.off("request", onReq);
        resolve();
      }
    };
    page.on("request", onReq);
    // Wait up to 10s for the next polling call
    setTimeout(() => { page.off("request", onReq); resolve(); }, 10000);
  });
  console.log(`Latest-captured page-instance: ${realHeaders.value["x-li-page-instance"]}`);

  // Now fire all 3 inbox calls using the captured headers
  async function call(url) {
    return await page.evaluate(async ({ url, headers }) => {
      const r = await fetch(url, { method: "GET", headers, credentials: "include" });
      return { status: r.status, body: await r.text() };
    }, { url, headers: realHeaders.value });
  }

  // 1. THREAD LIST
  const listUrl = `https://www.linkedin.com/voyager/api/voyagerMessagingGraphQL/graphql?queryId=messengerConversations.0d5e6781bbee71c3e51c8843c6519f48&variables=(mailboxUrn:${encodeURIComponent(mailboxUrn)})`;
  const r1 = await call(listUrl);
  const parsed1 = JSON.parse(r1.body);
  const ct = parsed1.data?.data?.messengerConversationsBySyncToken;
  const elements = ct?.elements || [];
  const included = parsed1.data?.included || [];
  console.log(`\n✅ THREAD LIST: ${elements.length} threads (${included.length} inline objects)`);
  elements.forEach((c, i) => {
    const other = c.conversationParticipants?.find(p => p.distance !== 'SELF')?.participantType?.member;
    const preview = c.events?.[0]?.eventContent?.message?.body?.text || "";
    console.log(`  ${i+1}. ${other?.firstName?.text} ${other?.lastName?.text} — ${other?.headline?.text}`);
    console.log(`     unread=${c.unreadCount} activity=${new Date(c.lastActivityAt).toISOString()}`);
    console.log(`     preview: "${preview.substring(0, 60)}"`);
    console.log(`     convoUrn: ${c.entityUrn}`);
  });
  const newSyncToken = ct?.metadata?.newSyncToken;

  // 2. MAILBOX COUNTS
  const countsUrl = `https://www.linkedin.com/voyager/api/voyagerMessagingGraphQL/graphql?queryId=messengerMailboxCounts.fc528a5a81a76dff212a4a3d2d48e84b&variables=(mailboxUrn:${encodeURIComponent(mailboxUrn)})`;
  const r2 = await call(countsUrl);
  const parsed2 = JSON.parse(r2.body);
  const counts = parsed2.data?.data?.messengerMailboxCountsByMailbox?.elements || [];
  console.log(`\n✅ MAILBOX COUNTS:`);
  counts.forEach(c => console.log(`  ${c.category}: ${c.unreadConversationCount} unread`));

  // 3. MESSAGES IN FIRST THREAD
  if (elements.length > 0) {
    const firstConvoUrn = elements[0].entityUrn;
    console.log(`\n✅ MESSAGES in: ${firstConvoUrn}`);
    const messagesUrl = `https://www.linkedin.com/voyager/api/voyagerMessagingGraphQL/graphql?queryId=messengerMessages.5846eeb71c981f11e0134cb6626cc314&variables=(conversationUrn:${encodeURIComponent(firstConvoUrn)})`;
    const r3 = await call(messagesUrl);
    const parsed3 = JSON.parse(r3.body);
    const msgsCt = parsed3.data?.data?.messengerMessagesBySyncToken;
    const msgElements = msgsCt?.elements || [];
    const msgIncluded = parsed3.data?.included || [];
    console.log(`  ${msgElements.length} messages (${msgIncluded.length} inline objects)`);
    msgElements.slice(0, 5).forEach((m, i) => {
      const sender = m.sender?.participantType?.member;
      const isFromMe = sender?.distance === 'SELF';
      const text = m.body?.text?.substring(0, 80);
      const delivered = m.deliveredAt ? new Date(m.deliveredAt).toISOString() : '?';
      console.log(`  ${i+1}. [${isFromMe ? 'ME' : sender?.firstName?.text}] (${delivered}) ${text}`);
    });
  }

  // Save all data
  fs.writeFileSync(path.join(__dirname, "sessions", "live", "voyager_inbox_threads.json"), r1.body);
  fs.writeFileSync(path.join(__dirname, "sessions", "live", "voyager_inbox_counts.json"), r2.body);

  await ctx.close();
  await browser.close();
})().catch((e) => { console.error("FATAL:", e.message, e.stack); process.exit(1); });
