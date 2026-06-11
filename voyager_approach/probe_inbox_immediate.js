// Fire the inbox call IMMEDIATELY after the real UI fires it
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

  // Capture the first request's headers using a Promise (proper async pattern)
  const firstReqPromise = new Promise((resolve) => {
    page.on("request", (r) => {
      if (r.url().includes("messengerConversations.0d5e")) {
        const h = r.headers();
        const serialized = {};
        for (const [k, v] of Object.entries(h)) {
          if (typeof v === "string") serialized[k] = v;
        }
        resolve(serialized);
      }
    });
  });

  await page.goto("https://www.linkedin.com/messaging/", { waitUntil: "domcontentloaded" });
  const firstReq = await Promise.race([
    firstReqPromise,
    new Promise((res) => setTimeout(() => res(null), 15000)),
  ]);
  console.log(`First request captured: ${firstReq ? Object.keys(firstReq).length + " headers" : "NULL"}`);
  const cleanHeaders = firstReq || {};

  // Fire IMMEDIATELY with the same headers
  const listUrl = `https://www.linkedin.com/voyager/api/voyagerMessagingGraphQL/graphql?queryId=messengerConversations.0d5e6781bbee71c3e51c8843c6519f48&variables=(mailboxUrn:${encodeURIComponent(mailboxUrn)})`;
  const r1 = await page.evaluate(async ({ url, headers }) => {
    const r = await fetch(url, { method: "GET", headers, credentials: "include" });
    return { status: r.status, body: await r.text() };
  }, { url: listUrl, headers: cleanHeaders });
  console.log(`Immediate re-fire status: ${r1.status}`);
  const parsed1 = JSON.parse(r1.body);
  const ct = parsed1.data?.data?.messengerConversationsBySyncToken;
  const elements = ct?.elements || [];
  console.log(`Threads: ${elements.length}`);
  elements.forEach((c, i) => {
    const other = c.conversationParticipants?.find(p => p.distance !== 'SELF')?.participantType?.member;
    console.log(`  ${i+1}. ${other?.firstName?.text} ${other?.lastName?.text} (${other?.headline?.text}) unread=${c.unreadCount}`);
  });

  // Now try a second re-fire 5s later (after page has settled)
  await page.waitForTimeout(5000);
  const r2 = await page.evaluate(async ({ url, headers }) => {
    const r = await fetch(url, { method: "GET", headers, credentials: "include" });
    return { status: r.status, body: await r.text() };
  }, { url: listUrl, headers: cleanHeaders });
  console.log(`\n5s-later re-fire status: ${r2.status}`);
  const parsed2 = JSON.parse(r2.body);
  const ct2 = parsed2.data?.data?.messengerConversationsBySyncToken;
  const elements2 = ct2?.elements || [];
  console.log(`Threads: ${elements2.length}`);

  await ctx.close();
  await browser.close();
})().catch((e) => { console.error("FATAL:", e.message, e.stack); process.exit(1); });
