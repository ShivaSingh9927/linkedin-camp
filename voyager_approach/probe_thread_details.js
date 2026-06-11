// Test the by-URN fetch for full thread details
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
const M = "ACoAAGj45loB-nQmKeQasQoZJdn3YHCj5cYXRle0";  // self — note lowercase l at end (correct)
const mailboxUrn = `urn:li:fsd_profile:${M}`;
const conversationUrn1 = `urn:li:msg_conversation:(urn:li:fsd_profile:${M},2-OGRhYWFmM2ItNTYxYi00MDI3LTk2YWItMTg5NTE0NGFiYThmXzEwMA==)`;
const conversationUrn2 = `urn:li:msg_conversation:(urn:li:fsd_profile:${M},2-MjM1MWFjZDgtNjA5Mi00ZDlmLWJkYzAtNGNhNjRkZWQ2ODkyXzEwMA==)`;

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

  // Try the simpler, non-GraphQL endpoint that the real UI used with ids=List(...)
  console.log("=== TRY A: By-Id REST endpoint ===");
  const idList = encodeURIComponent(`List(${conversationUrn1})`);
  const byIdUrl = `https://www.linkedin.com/voyager/api/voyagerMessagingDashMessengerConversations?ids=${idList}`;
  const rA = await call(byIdUrl);
  console.log(`Status: ${rA.status}`);
  console.log(`Body: ${rA.body.substring(0, 500)}`);

  console.log();
  // Try with decorate-conversations (different decorationId)
  console.log("=== TRY B: GraphQL with full message view ===");
  const convoBUrl = `https://www.linkedin.com/voyager/api/voyagerMessagingGraphQL/graphql?queryId=messengerConversations.0d5e6781bbee71c3e51c8843c6519f48&variables=(mailboxUrn:${encodeURIComponent(mailboxUrn)},previewsRequestSize:10,receivedAt:0,conversationSearchCriteria:(queryString:))`;
  const rB = await call(convoBUrl);
  console.log(`Status: ${rB.status}`);
  console.log(`Body: ${rB.body.substring(0, 800)}`);

  console.log();
  // Try the messages-in-conversation endpoint (probed before, 400)
  console.log("=== TRY C: Messages in conversation (alternate URL) ===");
  const messagesUrl = `https://www.linkedin.com/voyager/api/voyagerMessagingGraphQL/graphql?queryId=messengerMessages.5846eeb71c981f11e0134cb6626cc314&variables=(conversationUrn:${encodeURIComponent(conversationUrn1)},count:20)`;
  const rC = await call(messagesUrl);
  console.log(`Status: ${rC.status}`);
  console.log(`Body: ${rC.body.substring(0, 500)}`);

  console.log();
  // Try sync-token endpoint
  console.log("=== TRY D: Sync-token endpoint (used for incremental sync) ===");
  const syncUrl = `https://www.linkedin.com/voyager/api/voyagerMessagingGraphQL/graphql?queryId=messengerConversations.0d5e6781bbee71c3e51c8843c6519f48&variables=(mailboxUrn:${encodeURIComponent(mailboxUrn)},syncToken:9qXli9ZnpreLldZnLnVybjpsaTpmYWJyaWM6cHJvZC1sdHgxAA==,previewsRequestSize:20)`;
  const rD = await call(syncUrl);
  console.log(`Status: ${rD.status}`);
  console.log(`Body: ${rD.body.substring(0, 800)}`);

  // Save all results
  fs.writeFileSync(
    path.join(__dirname, "sessions", "live", "thread_detail_probes.json"),
    JSON.stringify({ byId: rA, b: rB, c: rC, d: rD }, null, 2)
  );

  await ctx.close();
  await browser.close();
})().catch((e) => { console.error("FATAL:", e.message, e.stack); process.exit(1); });
