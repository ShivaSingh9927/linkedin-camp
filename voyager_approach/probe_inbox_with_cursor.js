// Try the EXACT thread list URL with lastUpdatedBefore cursor
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
const M = "ACoAAGj45loB-nQmKeQasQoZJdn3YHCj5cYXRl0";
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

  // Try the EXACT URL with lastUpdatedBefore
  const exactUrl = `https://www.linkedin.com/voyager/api/voyagerMessagingGraphQL/graphql?queryId=messengerConversations.9501074288a12f3ae9e3c7ea243bccbf&variables=(query:(predicateUnions:List((conversationCategoryPredicate:(category:INBOX)))),count:20,mailboxUrn:${encodeURIComponent(mailboxUrn)},lastUpdatedBefore:1780243597145)`;

  console.log("=== TRY 1: Exact URL with lastUpdatedBefore ===");
  const r1 = await call(exactUrl);
  console.log(`Status: ${r1.status}`);
  const parsed1 = JSON.parse(r1.body);
  const wrapper = parsed1?.data?.data?.messengerConversationsByCategoryQuery;
  const urnRefs = wrapper?.["*elements"] || wrapper?.elements;
  console.log(`Thread URN refs: ${JSON.stringify(urnRefs)}`);
  console.log(`Cursor: ${wrapper?.metadata?.nextCursor}`);
  console.log(`Included has ${parsed1?.data?.included?.length || 0} entries`);
  // Show included URNs
  const includedUrns = (parsed1?.data?.included || []).map(e => e.entityUrn || e["*entityUrn"]);
  console.log(`Included URNs: ${JSON.stringify(includedUrns.slice(0, 20))}`);

  // Show first included entry sample
  if (parsed1?.data?.included?.[0]) {
    const first = parsed1.data.included[0];
    console.log(`\nFirst included entry keys: ${Object.keys(first).slice(0, 20).join(", ")}`);
    if (first.conversationParticipants) {
      const p = first.conversationParticipants[0]?.participantType?.member;
      console.log(`First participant: ${p?.firstName?.text} ${p?.lastName?.text} (${p?.headline?.text})`);
    }
    console.log(`unreadCount: ${first.unreadCount}, lastActivityAt: ${first.lastActivityAt}`);
  }

  console.log();
  // Now try with a fresh future timestamp to get latest 20
  const futureTs = Date.now();
  const exactUrl2 = `https://www.linkedin.com/voyager/api/voyagerMessagingGraphQL/graphql?queryId=messengerConversations.9501074288a12f3ae9e3c7ea243bccbf&variables=(query:(predicateUnions:List((conversationCategoryPredicate:(category:INBOX)))),count:20,mailboxUrn:${encodeURIComponent(mailboxUrn)},lastUpdatedBefore:${futureTs})`;
  console.log(`=== TRY 2: With lastUpdatedBefore=${futureTs} ===`);
  const r2 = await call(exactUrl2);
  console.log(`Status: ${r2.status}`);
  const parsed2 = JSON.parse(r2.body);
  const wrapper2 = parsed2?.data?.data?.messengerConversationsByCategoryQuery;
  const urnRefs2 = wrapper2?.["*elements"] || wrapper2?.elements;
  const included2 = parsed2?.data?.included || [];
  console.log(`Thread URN refs: ${urnRefs2?.length || 0}`);
  console.log(`Included entries: ${included2.length}`);
  // Try to extract participants
  const threads = included2.filter(e => e.entityUrn?.includes('msg_conversation:'));
  console.log(`Conversation objects in included: ${threads.length}`);
  threads.forEach((t, i) => {
    const participants = t.conversationParticipants || [];
    const other = participants.find(p => p.distance !== 'SELF')?.participantType?.member;
    const me = participants.find(p => p.distance === 'SELF')?.participantType?.member;
    console.log(`  ${i+1}. [${me?.firstName?.text}] <-> [${other?.firstName?.text} ${other?.lastName?.text}] (${other?.headline?.text?.substring(0, 40)}) — unread=${t.unreadCount} activity=${new Date(t.lastActivityAt).toISOString()}`);
  });

  await ctx.close();
  await browser.close();
})().catch((e) => { console.error("FATAL:", e.message, e.stack); process.exit(1); });
