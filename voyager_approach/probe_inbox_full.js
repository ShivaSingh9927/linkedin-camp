// Test the FIRST inbox call (no cursor) - this is the one with full data
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

  // EXACT URL from real UI (no syncToken, no cursor)
  const exactUrl = `https://www.linkedin.com/voyager/api/voyagerMessagingGraphQL/graphql?queryId=messengerConversations.0d5e6781bbee71c3e51c8843c6519f48&variables=(mailboxUrn:${encodeURIComponent(mailboxUrn)})`;
  console.log("=== TRY: EXACT URL (no cursor) ===");
  const r = await call(exactUrl);
  console.log(`Status: ${r.status}`);
  const parsed = JSON.parse(r.body);
  if (parsed.data?.data?.messengerConversationsBySyncToken) {
    const ct = parsed.data.data.messengerConversationsBySyncToken;
    const elements = ct.elements || [];
    console.log(`✅ Got ${elements.length} conversations in messengerConversationsBySyncToken`);
    if (elements.length > 0) {
      elements.forEach((c, i) => {
        const participants = c.conversationParticipants || [];
        const other = participants.find(p => p.distance !== 'SELF')?.participantType?.member;
        const me = participants.find(p => p.distance === 'SELF')?.participantType?.member;
        console.log(`  ${i+1}. [${me?.firstName?.text} ${me?.lastName?.text}] <-> [${other?.firstName?.text} ${other?.lastName?.text}] — ${other?.headline?.text?.substring(0, 40)}`);
        console.log(`     unread=${c.unreadCount} activity=${new Date(c.lastActivityAt).toISOString()}`);
        console.log(`     conversationUrn: ${c.entityUrn}`);
      });
    }
    console.log(`\nnewSyncToken: ${ct.metadata?.newSyncToken}`);
    console.log(`Total included: ${parsed.data.included?.length || 0}`);
  } else {
    console.log(`Errors: ${JSON.stringify(parsed.data?.errors || parsed.errors)}`);
  }
  console.log();

  // Try with sync token (incremental)
  if (parsed.data?.data?.messengerConversationsBySyncToken?.metadata?.newSyncToken) {
    const token = parsed.data.data.messengerConversationsBySyncToken.metadata.newSyncToken;
    console.log(`=== TRY: With syncToken (incremental) ===`);
    const syncUrl = `https://www.linkedin.com/voyager/api/voyagerMessagingGraphQL/graphql?queryId=messengerConversations.0d5e6781bbee71c3e51c8843c6519f48&variables=(mailboxUrn:${encodeURIComponent(mailboxUrn)},syncToken:${token})`;
    const r2 = await call(syncUrl);
    console.log(`Status: ${r2.status}`);
    const p2 = JSON.parse(r2.body);
    const ct2 = p2.data?.data?.messengerConversationsBySyncToken;
    if (ct2?.elements) {
      console.log(`Got ${ct2.elements.length} new conversations since syncToken`);
    } else {
      console.log(`Errors: ${JSON.stringify(p2.data?.errors)}`);
    }
  }

  fs.writeFileSync(
    path.join(__dirname, "sessions", "live", "inbox_full_pure.json"),
    JSON.stringify(parsed, null, 2)
  );
  console.log(`\nSaved full response to inbox_full_pure.json`);

  await ctx.close();
  await browser.close();
})().catch((e) => { console.error("FATAL:", e.message, e.stack); process.exit(1); });
