// Pure fetch test of the discovered messaging queryIds
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

  const M = "ACoAAGj45loB-nQmKeQasQoZJdn3YHCj5cYXRl0";  // self mailbox
  const otherFsd = "ACoAACdYnukB_Rgm7qVvte0xhLy9SZGEbuvKMd0"; // shiva
  const mailboxUrn = `urn:li:fsd_profile:${M}`;
  const conversationUrn = `urn:li:msg_conversation:(urn:li:fsd_profile:${M},2-OGRhYWFmM2ItNTYxYi00MDI3LTk2YWItMTg5NTE0NGFiYThmXzEwMA==)`;

  // Discovered from real UI capture
  const queries = [
    // THREAD LIST (paginated) — primary inbox list
    {
      label: "Thread list (page 0)",
      url: `https://www.linkedin.com/voyager/api/voyagerMessagingGraphQL/graphql?queryId=messengerConversations.0d5e6781bbee71c3e51c8843c6519f48&variables=(mailboxUrn:${encodeURIComponent(mailboxUrn)},previewsRequestSize:10,receivedAt:0,conversationSearchCriteria:(queryString:))`,
    },
    // MAILBOX COUNTS — unread per mailbox
    {
      label: "Mailbox counts",
      url: `https://www.linkedin.com/voyager/api/voyagerMessagingGraphQL/graphql?queryId=messengerMailboxCounts.fc528a5a81a76dff212a4a3d2d48e84b&variables=(mailboxUrn:${encodeURIComponent(mailboxUrn)})`,
    },
    // MESSAGES IN A CONVERSATION
    {
      label: "Messages in conversation (shiva thread)",
      url: `https://www.linkedin.com/voyager/api/voyagerMessagingGraphQL/graphql?queryId=messengerMessages.5846eeb71c981f11e0134cb6626cc314&variables=(conversationUrn:${encodeURIComponent(conversationUrn)},count:20)`,
    },
    // NUDGES (suggested replies)
    { label: "Nudges", url: `https://www.linkedin.com/voyager/api/voyagerMessagingDashConversationNudges` },
    // PRESENCE
    { label: "Presence", url: `https://www.linkedin.com/voyager/api/messaging/dash/presenceStatuses` },
    // BADGE (already known)
    { label: "Messaging badge", url: `https://www.linkedin.com/voyager/api/voyagerMessagingDashMessagingBadge` },
    // SEEN RECEIPTS
    {
      label: "Seen receipts (read)",
      url: `https://www.linkedin.com/voyager/api/voyagerMessagingGraphQL/graphql?queryId=messengerSeenReceipts.dc29d9bcecad524b9dd264acbbde3b5c&variables=(recipientUrns:List(${encodeURIComponent(mailboxUrn)}))`,
    },
    // QUICK REPLIES
    {
      label: "Quick replies",
      url: `https://www.linkedin.com/voyager/api/voyagerMessagingGraphQL/graphql?queryId=messengerQuickReplies.4338d226319203b5b08920ab7621fa45&variables=(conversationUrn:${encodeURIComponent(conversationUrn)})`,
    },
    // PAGINATED THREAD LIST (alt queryId)
    {
      label: "Thread list (alt cursor)",
      url: `https://www.linkedin.com/voyager/api/voyagerMessagingGraphQL/graphql?queryId=messengerConversations.9501074288a12f3ae9e3c7ea243bccbf&variables=(mailboxUrn:${encodeURIComponent(mailboxUrn)},previewsRequestSize:20)`,
    },
  ];

  console.log("Testing 9 messaging endpoints via pure fetch (no UI):\n");
  const results = [];
  for (const q of queries) {
    const r = await call("GET", q.url);
    const text = r.body || "";
    const hasThread = /conversationUrn|conversationId/.test(text);
    const hasSender = /senderName|participantName|firstName.*lastName/.test(text);
    const hasMessage = /messageBody|body.*text|attributedBody/.test(text);
    const hasUnread = /unread|unreadCount|unseen/.test(text);
    const emoji = r.status === 200 ? "✅" : r.status === 403 ? "🔒" : r.status === 404 ? "❌" : r.status === 400 ? "🚫" : "⚠️";
    console.log(`${emoji} [${r.status}] ${q.label}`);
    console.log(`    URL: ${q.url.substring(60, 200)}`);
    if (r.status === 200) {
      const has = [];
      if (hasThread) has.push("thread-meta");
      if (hasSender) has.push("sender");
      if (hasMessage) has.push("message-body");
      if (hasUnread) has.push("unread-count");
      console.log(`    Contains: ${has.length ? has.join(", ") : "(structure unclear)"}`);
      console.log(`    ${text.substring(0, 250).replace(/\n/g, " ")}...`);
    } else {
      console.log(`    Body: ${text.substring(0, 200).replace(/\n/g, " ")}`);
    }
    console.log();
    results.push({ ...q, ...r, has: { hasThread, hasSender, hasMessage, hasUnread } });
  }

  fs.writeFileSync(
    path.join(__dirname, "sessions", "live", "inbox_pure_fetch.json"),
    JSON.stringify(results, null, 2)
  );

  await ctx.close();
  await browser.close();
})().catch((e) => { console.error("FATAL:", e.message, e.stack); process.exit(1); });
