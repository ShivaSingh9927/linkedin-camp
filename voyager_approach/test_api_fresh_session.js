// Open a real browser with the fresh session, then call the API FROM that browser
// (mimicking the real UI exactly)

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
  const localStorageRaw = fs.existsSync(path.join(SESSION, "localStorage.json"))
    ? fs.readFileSync(path.join(SESSION, "localStorage.json"), "utf8") : null;

  const browser = await chromium.launch({
    headless: false, proxy: PROXY,
    args: ["--disable-blink-features=AutomationControlled", "--start-maximized"],
  });
  const ctx = await browser.newContext({
    viewport: null,
    userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36",
    locale: "en-IN", timezoneId: "Asia/Kolkata",
    proxy: PROXY,
  });
  await ctx.addCookies(cookies);
  if (localStorageRaw) {
    const parsed = JSON.parse(localStorageRaw);
    await ctx.addInitScript((data) => {
      try {
        for (const [k, v] of Object.entries(data)) window.localStorage.setItem(k, v);
      } catch {}
    }, parsed);
  }
  const page = await ctx.newPage();
  await page.goto("https://www.linkedin.com/feed/", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(5000);
  console.log("On feed:", page.url());

  const csrf = cookies.find(c => c.name === "JSESSIONID").value.replace(/"/g, "");

  // Try the API from inside the browser context
  console.log("\n--- TEST: API send from real browser context ---");
  const { randomUUID } = require("crypto");
  const originToken = randomUUID();
  const trackingId = Buffer.from(require("crypto").randomBytes(11)).toString("latin1");
  const result = await page.evaluate(
    async ({ csrf, trackingId, originToken }) => {
      const body = {
        message: {
          body: { attributes: [], text: "__api_v7__ " + new Date().toISOString() },
          renderContentUnions: [],
          conversationUrn: "urn:li:msg_conversation:(urn:li:fsd_profile:ACoAAGj45loB-nQmKeQasQoZJdn3YHCj5cYXRle0,2-OGRhYWFmM2ItNTYxYi00MDI3LTk2YWItMTg5NTE0NGFiYThmXzEwMA==)",
          originToken: originToken,
        },
        mailboxUrn: "urn:li:fsd_profile:ACoAAGj45loB-nQmKeQasQoZJdn3YHCj5cYXRle0",
        trackingId: trackingId,
        dedupeByClientGeneratedToken: false,
      };
      const r = await fetch(
        "https://www.linkedin.com/voyager/api/voyagerMessagingDashMessengerMessages?action=createMessage",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "csrf-token": csrf,
            "x-restli-protocol-version": "2.0.0",
            accept: "application/json",
          },
          body: JSON.stringify(body),
        }
      );
      return { status: r.status, body: (await r.text()).substring(0, 1500) };
    },
    { csrf, trackingId, originToken }
  );
  console.log("Status:", result.status);
  console.log("Body:", result.body);

  await page.waitForTimeout(8000);
  await ctx.close();
  await browser.close();
})().catch((e) => { console.error("FATAL:", e.message, e.stack); process.exit(1); });
