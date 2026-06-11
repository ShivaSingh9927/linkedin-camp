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
  const liAt = cookies.find((c) => c.name === "li_at");
  const jsid = cookies.find((c) => c.name === "JSESSIONID");

  if (!liAt || !jsid) {
    console.error("No li_at/JSESSIONID in saved session. Run with login flow first.");
    process.exit(1);
  }
  const csrf = jsid.value.replace(/"/g, "");
  console.log("Loaded", cookies.length, "cookies. CSRF:", csrf.substring(0, 25) + "...");
  console.log("li_at expires:", new Date(liAt.expires * 1000).toISOString());

  const browser = await chromium.launch({
    headless: false,
    channel: "chrome",
    args: ["--no-first-run", "--start-maximized"],
  });

  const context = await browser.newContext({
    viewport: null,
    userAgent:
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36",
    locale: "en-IN",
    timezoneId: "Asia/Kolkata",
    proxy: PROXY,
  });

  // Inject cookies before any navigation
  await context.addCookies(cookies.map(c => ({
    name: c.name, value: c.value, domain: c.domain, path: c.path,
    expires: c.expires, httpOnly: c.httpOnly, secure: c.secure, sameSite: c.sameSite,
  })));

  const page = await context.newPage();

  // Test 1: check session is valid
  console.log("\n--- Test 1: GET /voyager/api/me ---");
  let result = await page.goto("https://www.linkedin.com/feed/", { waitUntil: "domcontentloaded" });
  console.log("Feed status:", result ? result.status() : "no response");
  console.log("Final URL:", page.url());

  if (!page.url().includes("/feed")) {
    console.log("Session invalid. Need to re-login.");
    await page.screenshot({ path: "/tmp/opencode/session_check.png" });
    await context.close();
    await browser.close();
    process.exit(1);
  }
  await page.waitForTimeout(5000);

  // Test 2: /me via voyager
  console.log("\n--- Test 2: GET /me ---");
  const meResult = await page.evaluate(async (csrf) => {
    const r = await fetch("https://www.linkedin.com/voyager/api/me", {
      headers: { "csrf-token": csrf, "x-restli-protocol-version": "2.0.0" },
    });
    return { status: r.status, body: (await r.text()).substring(0, 300) };
  }, csrf);
  console.log("  /me:", meResult);

  // Test 3: get message threads to find a recipient
  console.log("\n--- Test 3: GET threads ---");
  const threadsResult = await page.evaluate(async (csrf) => {
    const r = await fetch(
      "https://www.linkedin.com/voyager/api/voyagerMessagingDashMessengerThreads?count=10",
      { headers: { "csrf-token": csrf, "x-restli-protocol-version": "2.0.0", accept: "application/json" } }
    );
    const t = await r.text();
    try {
      const j = JSON.parse(t);
      const included = j.included || [];
      const profile = included.find(el => el.entityUrn && el.entityUrn.includes("fsd_profile"));
      const thread = (j.elements || []).find(el => el.entityUrn && el.entityUrn.includes("msg_conversation"));
      return { status: r.status, profile: profile ? { urn: profile.entityUrn, name: `${profile.firstName} ${profile.lastName}` } : null, threadUrn: thread ? thread.entityUrn : null, includedCount: included.length, elementsCount: (j.elements || []).length };
    } catch (e) { return { status: r.status, error: e.message, text: t.substring(0, 300) }; }
  }, csrf);
  console.log("  Threads:", threadsResult);

  let targetProfileUrn = threadsResult.profile && threadsResult.profile.urn;
  let threadUrn = threadsResult.threadUrn;

  // If no thread, try getting an existing conversation to find someone
  if (!targetProfileUrn) {
    console.log("\n--- Test 3b: GET conversations ---");
    const convResult = await page.evaluate(async (csrf) => {
      const r = await fetch(
        "https://www.linkedin.com/voyager/api/voyagerMessagingDashMessengerConversations?keyVersion=LEGACY_INBOX",
        { headers: { "csrf-token": csrf, "x-restli-protocol-version": "2.0.0", accept: "application/json" } }
      );
      return { status: r.status, body: (await r.text()).substring(0, 1000) };
    }, csrf);
    console.log("  Conv:", convResult);
  }

  if (!targetProfileUrn) {
    console.log("\nNo target profile. Stopping.");
    await context.close();
    await browser.close();
    process.exit(0);
  }

  // Test 4: SEND
  console.log(`\n--- Test 4: SEND to ${targetProfileUrn} ---`);
  const msgPayload = {
    message: {
      body: { text: "Live test from browser — " + new Date().toISOString(), attributes: [] },
      renderContentUnions: [],
      originToken: "live-test-" + Date.now(),
    },
    hostRecipientUrns: [targetProfileUrn],
  };
  const sendResult = await page.evaluate(async (body, csrf) => {
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
  }, msgPayload, csrf);
  console.log("  Status:", sendResult.status);
  console.log("  Body:", sendResult.body);
  if (sendResult.status === 200 || sendResult.status === 201) {
    console.log("\n✅✅✅ MESSAGE SENT SUCCESSFULLY!");
  } else {
    console.log("\n❌ Send failed");
  }

  await page.waitForTimeout(15000);
  await context.close();
  await browser.close();
  process.exit(0);
})().catch((e) => { console.error("FATAL:", e.message, e.stack); process.exit(1); });
