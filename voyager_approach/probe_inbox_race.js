// Race condition test: fire the same call RIGHT after the real UI fires it
// to see if we can ride the same "recent activity" window
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

  // Listen for the real UI's first messenger call
  const realCsrfRef = { value: null };
  const realPageInstance = { value: null };
  page.on("request", (r) => {
    if (r.url().includes("messengerConversations.0d5e")) {
      realCsrfRef.value = r.headers()["csrf-token"];
      realPageInstance.value = r.headers()["x-li-page-instance"];
    }
  });

  // Click "inbox nav" to trigger real call
  console.log("Loading /messaging/...");
  const navPromise = page.goto("https://www.linkedin.com/messaging/", { waitUntil: "domcontentloaded" });

  // Wait for the real UI to fire the call
  await page.waitForResponse((r) => r.url().includes("messengerConversations.0d5e"), { timeout: 30000 });
  console.log(`Real UI fired! csrf: ${realCsrfRef.value}`);

  // IMMEDIATELY (within ms) fire our own call with the captured csrf
  const listUrl = `https://www.linkedin.com/voyager/api/voyagerMessagingGraphQL/graphql?queryId=messengerConversations.0d5e6781bbee71c3e51c8843c6519f48&variables=(mailboxUrn:${encodeURIComponent(mailboxUrn)})`;
  const r1 = await page.evaluate(async ({ url, csrf }) => {
    const resp = await fetch(url, {
      credentials: "include",
      headers: {
        "csrf-token": csrf,
        "x-restli-protocol-version": "2.0.0",
        "accept": "application/graphql",
        "x-li-lang": "en_US",
        "x-li-page-instance": "urn:li:page:d_messaging_index;600e8a90-d563-454e-85bd-fa79046447bb",
        "referer": "https://www.linkedin.com/messaging/",
      }
    });
    return { status: resp.status, body: (await resp.text()).substring(0, 50000) };
  }, { url: listUrl, csrf: realCsrfRef.value });
  console.log(`\nRACE-CONDITION FETCH Status: ${r1.status}`);
  if (r1.status === 200) {
    const parsed = JSON.parse(r1.body);
    const ct = parsed.data?.data?.messengerConversationsBySyncToken;
    const elements = ct?.["*elements"] || [];
    const included = parsed.data?.included || [];
    console.log(`Got ${elements.length} thread URNs + ${included.length} inline objects`);
    if (elements.length > 0) {
      console.log("🎉 INBOX SYNC WORKS!");
      elements.forEach((urn, i) => {
        const convo = included.find(x => x.entityUrn === urn);
        const other = convo?.conversationParticipants?.find(p => p.distance !== 'SELF')?.participantType?.member;
        console.log(`  ${i+1}. ${other?.firstName?.text} ${other?.lastName?.text} unread=${convo?.unreadCount}`);
      });
    } else if (parsed.data?.errors) {
      console.log(`Error: ${parsed.data.errors[0].message}`);
    }
  } else {
    console.log(`Body: ${r1.body.substring(0, 500)}`);
  }

  await navPromise;
  await ctx.close();
  await browser.close();
})().catch((e) => { console.error("FATAL:", e.message, e.stack); process.exit(1); });
