const { chromium } = require("patchright");
const fs = require("fs");
const path = require("path");

const PROXY = {
  server: "http://82.41.252.111:46222",
  username: "xBVyYdUpx84nWx7",
  password: "dwwTxtvv5a10RXn",
};

const SESSION = path.join(__dirname, "sessions", "live", "cookies.json");

(async () => {
  const cookies = JSON.parse(fs.readFileSync(SESSION, "utf8"));
  const csrf = cookies.find((c) => c.name === "JSESSIONID").value.replace(/"/g, "");

  const browser = await chromium.launch({
    headless: false, channel: "chrome", args: ["--no-first-run"], proxy: PROXY,
  });
  const ctx = await browser.newContext({
    userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36",
    locale: "en-IN", timezoneId: "Asia/Kolkata",
  });
  await ctx.addCookies(cookies);
  const page = await ctx.newPage();
  await page.goto("https://www.linkedin.com/feed/", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(4000);

  // EXACT body of the real UI request, only changing text + originToken + trackingId
  const realBodyRaw = `{"message":{"body":{"attributes":[],"text":"__API_REPLAY_${Date.now()}__"},"renderContentUnions":[],"conversationUrn":"urn:li:msg_conversation:(urn:li:fsd_profile:ACoAAGj45loB-nQmKeQasQoZJdn3YHCj5cYXRle0,2-OGRhYWFmM2ItNTYxYi00MDI3LTk2YWItMTg5NTE0NGFiYThmXzEwMA==)","originToken":"${require("crypto").randomUUID()}"},"mailboxUrn":"urn:li:fsd_profile:ACoAAGj45loB-nQmKeQasQoZJdn3YHCj5cYXRle0","trackingId":"CWoNkEmA6aM=","dedupeByClientGeneratedToken":false}`;
  console.log("Body:", realBodyRaw);
  console.log("\n--- SEND ---");
  const result = await page.evaluate(
    async ({ body, csrf }) => {
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
          body: body,
        }
      );
      return { status: r.status, body: (await r.text()).substring(0, 2000) };
    },
    { body: realBodyRaw, csrf }
  );
  console.log("Status:", result.status);
  console.log("Body:", result.body);

  // Also try a fresh fetch from the messaging page (where the working one came from)
  console.log("\n--- Try with extra headers (matching what real browser sends) ---");
  const result2 = await page.evaluate(
    async ({ body, csrf }) => {
      const r = await fetch(
        "https://www.linkedin.com/voyager/api/voyagerMessagingDashMessengerMessages?action=createMessage",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "csrf-token": csrf,
            "x-restli-protocol-version": "2.0.0",
            "accept": "application/json, text/plain, */*",
            "x-li-lang": "en_US",
            "x-li-page-instance": "urn:li:page:d_flagship3_messaging;",
            "x-li-track": JSON.stringify({ clientVersion: "1.13.4149", mpVersion: "1.13.4149", osName: "web", timezoneOffset: -330, timezone: "Asia/Calcutta", deviceFormFactor: "DESKTOP", mpName: "voyager-web", displayDensity: 1, displayWidth: 1440, displayHeight: 900 }),
            "x-li-source": "voyager-web",
            "x-li-uuid": "xW9jLy1eQX2bA+KLgG5hCQ==",
          },
          body: body,
          credentials: "include",
        }
      );
      return { status: r.status, body: (await r.text()).substring(0, 2000) };
    },
    { body: realBodyRaw, csrf }
  );
  console.log("Status2:", result2.status);
  console.log("Body2:", result2.body);

  await page.waitForTimeout(5000);
  await ctx.close();
  await browser.close();
})().catch((e) => { console.error("FATAL:", e.message, e.stack); process.exit(1); });
