// End-to-end test: launch the real browser, call inbox-sync-voyager node
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

  // Capture csrf + page-instance from first voyager call
  const csrfRef = { value: null };
  const piRef = { value: null };
  page.on("request", (r) => {
    if (r.url().includes("/voyager/") && !csrfRef.value) {
      csrfRef.value = r.headers()["csrf-token"];
      piRef.value = r.headers()["x-li-page-instance"];
    }
  });

  await page.goto("https://www.linkedin.com/messaging/", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(5000);
  console.log(`csrf: ${csrfRef.value?.substring(0, 30)}...`);
  console.log(`page-instance: ${piRef.value}`);

  // Run the full inbox sync via page.context().request
  const result = await page.evaluate(async ({ csrf, pi }) => {
    // Step 1: Get self mailbox URN
    const meR = await fetch("https://www.linkedin.com/voyager/api/me", {
      method: "GET", credentials: "include",
      headers: {
        "csrf-token": csrf, "x-restli-protocol-version": "2.0.0",
        "accept": "application/vnd.linkedin.normalized+json+2.1",
        "x-li-lang": "en_US", "x-li-page-instance": pi,
      }
    });
    const me = await meR.json();
    const included = me.included || [];
    const mpUrn = me.data["*miniProfile"];
    const mp = included.find(e => e.entityUrn === mpUrn);
    const mailboxUrn = mp?.dashEntityUrn;
    if (!mailboxUrn) return { error: "no dashEntityUrn" };

    // Step 2: Inbox list
    const listR = await fetch(`https://www.linkedin.com/voyager/api/voyagerMessagingGraphQL/graphql?queryId=messengerConversations.0d5e6781bbee71c3e51c8843c6519f48&variables=(mailboxUrn:${encodeURIComponent(mailboxUrn)})`, {
      method: "GET", credentials: "include",
      headers: {
        "csrf-token": csrf, "x-restli-protocol-version": "2.0.0",
        "accept": "application/graphql",
        "x-li-lang": "en_US", "x-li-page-instance": pi,
      }
    });
    const listData = await listR.json();
    const elements = listData?.data?.messengerConversationsBySyncToken?.elements || [];

    // Step 3: For each conversation, fetch messages
    const threads = [];
    for (const c of elements) {
      const other = c.conversationParticipants?.find(p => p.participantType?.member?.distance !== 'SELF')?.participantType?.member;
      const me_ = c.conversationParticipants?.find(p => p.participantType?.member?.distance === 'SELF')?.participantType?.member;
      const convUrn = c.entityUrn;
      const msgR = await fetch(`https://www.linkedin.com/voyager/api/voyagerMessagingGraphQL/graphql?queryId=messengerMessages.5846eeb71c981f11e0134cb6626cc314&variables=(conversationUrn:${encodeURIComponent(convUrn)})`, {
        method: "GET", credentials: "include",
        headers: {
          "csrf-token": csrf, "x-restli-protocol-version": "2.0.0",
          "accept": "application/graphql",
          "x-li-lang": "en_US", "x-li-page-instance": pi,
        }
      });
      const msgData = await msgR.json();
      const msgElements = msgData?.data?.messengerMessagesBySyncToken?.elements || [];
      const messages = msgElements.map(m => {
        // m might be a URN ref or a full message; check
        if (typeof m === "string") {
          // URN ref, look in included
          const fullMsg = msgData.data?.included?.find(x => x.entityUrn === m);
          if (!fullMsg) return { text: `[urn ref] ${m.substring(0, 50)}`, sender: "?", isFromMe: false, deliveredAt: 0 };
          return {
            text: fullMsg.body?.text?.substring(0, 100) || "",
            sender: fullMsg.sender?.participantType?.member?.firstName?.text || "?",
            isFromMe: fullMsg.sender?.participantType?.member?.distance === "SELF",
            deliveredAt: fullMsg.deliveredAt,
          };
        }
        return {
          text: m.body?.text?.substring(0, 100) || "",
          sender: m.sender?.participantType?.member?.firstName?.text || "?",
          isFromMe: m.sender?.participantType?.member?.distance === "SELF",
          deliveredAt: m.deliveredAt,
        };
      });
      threads.push({
        conversationUrn: convUrn,
        with: `${other?.firstName?.text} ${other?.lastName?.text}`,
        headline: other?.headline?.text,
        unread: c.unreadCount,
        lastActivity: c.lastActivityAt,
        messageCount: messages.length,
        messages: messages.slice(0, 3),
      });
    }
    return { mailboxUrn, threads };
  }, { csrf: csrfRef.value, pi: piRef.value });

  console.log(`\n=== RESULT ===`);
  if (result.error) {
    console.log(`Error: ${result.error}`);
  } else {
    console.log(`Mailbox: ${result.mailboxUrn}`);
    console.log(`Threads: ${result.threads.length}`);
    for (const t of result.threads) {
      console.log(`\n  Thread with: ${t.with} (${t.headline})`);
      console.log(`    unread=${t.unread}, messageCount=${t.messageCount}, lastActivity=${new Date(t.lastActivity).toISOString()}`);
      for (const m of t.messages) {
        console.log(`    [${m.isFromMe ? "ME" : m.sender}] ${m.text}`);
      }
    }
  }

  await ctx.close();
  await browser.close();
})().catch((e) => { console.error("FATAL:", e.message, e.stack); process.exit(1); });
