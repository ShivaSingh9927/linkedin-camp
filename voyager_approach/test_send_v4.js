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
  const jsid = cookies.find((c) => c.name === "JSESSIONID");
  const csrf = jsid.value.replace(/"/g, "");

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

  // Use the EXACT structure from the real UI capture:
  //   mailboxUrn = bare fsd_profile URN (no vanity suffix)
  //   conversationUrn = existing thread
  //   trackingId = generated random
  //   dedupeByClientGeneratedToken = false
  const fsdUrn = "urn:li:fsd_profile:ACoAACdYnukB_Rgm7qVvte0xhLy9SZGEbuvKMd0";
  const conversationUrn = "urn:li:msg_conversation:(urn:li:fsd_profile:ACoAAGj45loB-nQmKeQasQoZJdn3YHCj5cYXRle0,2-OGRhYWFmM2ItNTYxYi00MDI3LTk2YWItMTg5NTE0NGFiYThmXzEwMA==)";

  const originToken = require("crypto").randomUUID();
  // trackingId from real UI looks like 8 binary bytes — pass them as latin-1 string
  const trackingId = Buffer.from(require("crypto").randomBytes(8)).toString("latin1");

  const msgPayload = {
    message: {
      body: { attributes: [], text: "API replay from real UI capture — " + new Date().toISOString() },
      renderContentUnions: [],
      conversationUrn: conversationUrn,
      originToken: originToken,
    },
    mailboxUrn: "urn:li:fsd_profile:ACoAAGj45loB-nQmKeQasQoZJdn3YHCj5cYXRle0",  // SELF mailboxUrn
    trackingId: trackingId,
    dedupeByClientGeneratedToken: false,
  };

  console.log("Payload:", JSON.stringify(msgPayload, null, 2));
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
          body: JSON.stringify(body),
        }
      );
      return { status: r.status, body: (await r.text()).substring(0, 2000) };
    },
    { body: msgPayload, csrf }
  );
  console.log("Status:", result.status);
  console.log("Body:", result.body);
  if (result.status === 200) console.log("\n✅✅✅ MESSAGE SENT!");

  await page.waitForTimeout(5000);
  await ctx.close();
  await browser.close();
})().catch((e) => { console.error("FATAL:", e.message, e.stack); process.exit(1); });
