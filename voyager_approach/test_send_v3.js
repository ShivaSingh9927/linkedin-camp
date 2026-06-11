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
  console.log("Loaded", cookies.length, "cookies. CSRF:", csrf.substring(0, 30) + "...");

  const browser = await chromium.launch({
    headless: false,
    channel: "chrome",
    args: ["--no-first-run"],
    proxy: PROXY,
  });
  const context = await browser.newContext({
    userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36",
    locale: "en-IN",
    timezoneId: "Asia/Kolkata",
  });
  await context.addCookies(cookies);
  const page = await context.newPage();

  // Navigate to a LinkedIn page first to set origin
  await page.goto("https://www.linkedin.com/feed/", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(4000);
  console.log("Landed:", page.url());

  // Find a 1st-degree connection to message
  console.log("\n--- Test: find a 1st-degree connection ---");
  const connResult = await page.evaluate(async (csrf) => {
    const r = await fetch("https://www.linkedin.com/voyager/api/relationships/connections?count=10", {
      headers: { "csrf-token": csrf, "x-restli-protocol-version": "2.0.0", accept: "application/json" },
    });
    const t = await r.text();
    try {
      const j = JSON.parse(t);
      const elements = j.elements || [];
      for (const el of elements) {
        const mp = el.miniProfile;
        if (mp && mp.dashEntityUrn) {
          return {
            status: r.status,
            fsdUrn: mp.dashEntityUrn,
            objectUrn: mp.objectUrn,
            entityUrn: mp.entityUrn,
            firstName: mp.firstName,
            lastName: mp.lastName,
            publicIdentifier: mp.publicIdentifier,
            vanity: mp.vanityName,
            occupation: mp.occupation,
          };
        }
      }
      return { status: r.status, elementCount: elements.length, sample: t.substring(0, 400) };
    } catch (e) {
      return { status: r.status, error: e.message, text: t.substring(0, 300) };
    }
  }, csrf);
  console.log("Connection:", JSON.stringify(connResult, null, 2));

  if (connResult.error || !connResult.fsdUrn) {
    console.log("No connection. Trying connections graphQL...");
    const altResult = await page.evaluate(async (csrf) => {
      const r = await fetch("https://www.linkedin.com/voyager/api/voyagerConnectionsGraphQL/graphql?queryId=connections.0d5e6781bbee71c3e51c8843c6519f48&variables=(count:10)", {
        headers: { "csrf-token": csrf, "x-restli-protocol-version": "2.0.0", accept: "application/json" },
      });
      return { status: r.status, body: (await r.text()).substring(0, 500) };
    }, csrf);
    console.log("Alt result:", altResult);
    await context.close();
    await browser.close();
    process.exit(0);
  }

  // Build the proper send payload using the **screenshot-captured** structure
  // From the devtools screenshot:
  //   mailboxUrn: "urn:li:fsd_profile:ACoAAGj45loB-nQmKeQasQoZJdn3YHCj5cYXRe0-nQmKeQasQoZJdn3YHCj5cYXR10"
  // The "-<suffix>" looks like the publicIdentifier (vanity)
  // Pattern: urn:li:fsd_profile:<profileId>-<vanity>
  // The conversationUrn has the thread hash appended

  // For a NEW conversation (no existing thread), the conversationUrn gets auto-created
  // by LinkedIn when the message is sent. We just need the mailboxUrn.

  const fsdUrn = connResult.fsdUrn;       // e.g. urn:li:fsd_profile:ACoAAGj45loB-...
  const vanity = connResult.publicIdentifier || connResult.vanity;
  const mailboxUrn = vanity ? `${fsdUrn}-${vanity}` : fsdUrn;
  console.log("\nTarget mailboxUrn:", mailboxUrn);

  // The exact payload structure from the devtools screenshot:
  // {
  //   "dedupeByClientGeneratedToken": false,
  //   "mailboxUrn": "urn:li:fsd_profile:...",
  //   "message": {
  //     "body": { "attributes": [], "text": "hi" },
  //     "renderContentUnions": [],
  //     "conversationUrn": "urn:li:msg_conversation:(urn:li:fsd_profile:...,2-...)",
  //     "originToken": "<uuid>"
  //   },
  //   "renderContentUnions": [],
  //   "trackingId": "2f1io.0...l_TF"
  // }
  //
  // WAIT — the screenshot also had a `conversationUrn` inside the message. That suggests
  // the payload includes BOTH a brand-new conversationUrn AND a mailboxUrn.
  // The conversationUrn format: urn:li:msg_conversation:(urn:li:fsd_profile:<vanitySuffixedUrn>,2-<random>)

  // Generate a fresh conversationUrn (UUID-based 2-... pattern)
  // Format decoded from devtools: "2-<base64(uuid)>=_" then "100" — looks like "<base64(uuid)>_<counter>"
  // Actually re-reading: "2-OGRhYWFmM2ItNTYxYi00MDI3LTk2YWItMTg5NTE0NGFiYThmXzEwMA=="
  // base64 decode: 8daaaf3b-561b-4027-96ab-1895144aba8f_100
  // So it's: 2-<base64(uuid>_<number>)>=
  // The full b64 is: "<uuid>_<count>" padded with "="
  // We just need: 2-<base64("uuid_number")>=
  const { randomUUID } = require("crypto");
  const convUuid = randomUUID();
  const convCount = 100;
  const convB64 = Buffer.from(`${convUuid}_${convCount}`).toString("base64");
  const conversationUrn = `urn:li:msg_conversation:(${mailboxUrn},2-${convB64})`;
  const originToken = require("crypto").randomUUID();

  console.log("\n--- STEP 1: Create conversation ---");
  const createConvPayload = {
    dedupeByClientGeneratedToken: false,
    mailboxUrn: mailboxUrn,
    hostRecipientUrns: [fsdUrn],
    originToken: require("crypto").randomUUID(),
    trackingId: "2f1io.0" + Math.random().toString(36).substring(2, 8) + "-l_TF",
  };
  console.log("Create-conv payload:", JSON.stringify(createConvPayload, null, 2));
  const createConvResult = await page.evaluate(
    async ({ body, csrf }) => {
      const r = await fetch(
        "https://www.linkedin.com/voyager/api/voyagerMessagingDashMessengerConversations?action=create",
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
      return { status: r.status, body: (await r.text()).substring(0, 3000) };
    },
    { body: createConvPayload, csrf }
  );
  console.log("\nCreate-conv status:", createConvResult.status);
  console.log("Create-conv body:", createConvResult.body);

  let convUrn = null;
  try {
    const j = JSON.parse(createConvResult.body);
    convUrn = j.value?.entityUrn || j.entityUrn;
  } catch {}
  if (!convUrn) {
    console.log("Could not extract convUrn. Trying to use mailboxUrn-only approach...");
    convUrn = conversationUrn;
  }
  console.log("Using convUrn:", convUrn);

  // Generate proper conversationUrn with the response's URN, or fallback
  const msgPayload = {
    dedupeByClientGeneratedToken: false,
    mailboxUrn: mailboxUrn,
    message: {
      body: { attributes: [], text: "Live API test from devtools capture — " + new Date().toISOString() },
      renderContentUnions: [],
      conversationUrn: convUrn,
      originToken: originToken,
    },
    renderContentUnions: [],
    trackingId: "2f1io.0" + Math.random().toString(36).substring(2, 8) + "-l_TF",
  };

  console.log("\n--- STEP 2: SEND MESSAGE ---");
  console.log("Payload:", JSON.stringify(msgPayload, null, 2));
  const sendResult = await page.evaluate(
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
  console.log("\nSEND status:", sendResult.status);
  console.log("SEND body:", sendResult.body);
  if (sendResult.status === 200 || sendResult.status === 201) {
    console.log("\n✅✅✅ MESSAGE SENT!");
  } else {
    console.log("\n❌ Send failed");
  }

  await page.waitForTimeout(10000);
  await context.close();
  await browser.close();
  process.exit(0);
})().catch((e) => { console.error("FATAL:", e.message, e.stack); process.exit(1); });
