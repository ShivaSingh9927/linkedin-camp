// Confirm: warm session via real UI, then call same endpoint via fetch from within same page
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

  // Step 1: Visit real messaging page to warm session
  console.log("Step 1: Visiting /messaging/ to warm session...");
  await page.goto("https://www.linkedin.com/messaging/", { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.waitForTimeout(8000);

  // Step 2: Immediately fetch from same page (cookies + fingerprint are warm)
  console.log("\nStep 2: Fetching thread list from same page (cookies still warm)...");
  const result = await page.evaluate(async ({ url, csrf }) => {
    const r = await fetch(url, {
      headers: {
        "csrf-token": csrf,
        "x-restli-protocol-version": "2.0.0",
        "accept": "application/vnd.linkedin.normalized+json+2.1",
      }
    });
    return { status: r.status, body: await r.text() };
  }, {
    url: `https://www.linkedin.com/voyager/api/voyagerMessagingGraphQL/graphql?queryId=messengerConversations.0d5e6781bbee71c3e51c8843c6519f48&variables=(mailboxUrn:${encodeURIComponent(mailboxUrn)})`,
    csrf,
  });

  console.log(`Status: ${result.status}`);
  const parsed = JSON.parse(result.body);
  if (parsed.data?.data?.messengerConversationsBySyncToken?.elements) {
    const arr = parsed.data.data.messengerConversationsBySyncToken.elements;
    console.log(`✅ Got ${arr.length} conversations in warm-session fetch`);
    arr.slice(0, 3).forEach((c, i) => {
      const other = c.conversationParticipants.find(p => p.distance !== 'SELF')?.participantType?.member;
      console.log(`  ${i+1}. ${other?.firstName?.text} ${other?.lastName?.text} (${other?.headline?.text?.substring(0, 30)})`);
    });
  } else if (parsed.data?.errors) {
    console.log(`❌ Gated: ${JSON.stringify(parsed.data.errors[0])}`);
  }

  // Now try going to /feed first, then re-fetch (simulate different warm levels)
  console.log("\nStep 3: Goto /feed, then re-test fetch...");
  await page.goto("https://www.linkedin.com/feed/", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(5000);

  const result2 = await page.evaluate(async ({ url, csrf }) => {
    const r = await fetch(url, {
      headers: {
        "csrf-token": csrf,
        "x-restli-protocol-version": "2.0.0",
        "accept": "application/vnd.linkedin.normalized+json+2.1",
      }
    });
    return { status: r.status, body: await r.text() };
  }, {
    url: `https://www.linkedin.com/voyager/api/voyagerMessagingGraphQL/graphql?queryId=messengerConversations.0d5e6781bbee71c3e51c8843c6519f48&variables=(mailboxUrn:${encodeURIComponent(mailboxUrn)})`,
    csrf,
  });

  console.log(`Status: ${result2.status}`);
  const parsed2 = JSON.parse(result2.body);
  if (parsed2.data?.data?.messengerConversationsBySyncToken?.elements) {
    const arr = parsed2.data.data.messengerConversationsBySyncToken.elements;
    console.log(`✅ Got ${arr.length} conversations after /feed/ warm`);
  } else if (parsed2.data?.errors) {
    console.log(`❌ Gated: ${JSON.stringify(parsed2.data.errors[0])}`);
  }

  await ctx.close();
  await browser.close();
})().catch((e) => { console.error("FATAL:", e.message, e.stack); process.exit(1); });
