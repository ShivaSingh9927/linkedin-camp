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
    args: ["--no-first-run", "--start-maximized"],
    proxy: PROXY,
  });
  const context = await browser.newContext({
    viewport: null,
    userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36",
    locale: "en-IN",
    timezoneId: "Asia/Kolkata",
  });
  await context.addCookies(cookies);

  // Block trackers so our conversation list loads fast
  const page = await context.newPage();
  await page.route("**/*", (route) => {
    const u = route.request().url();
    if (u.includes("doubleclick") || u.includes("googletagmanager") || u.includes("px.ads") || u.includes("facebook")) {
      return route.abort();
    }
    return route.continue();
  });

  // Capture all voyager calls so we can also document them
  const voyagerCalls = [];
  page.on("response", async (r) => {
    const u = r.url();
    if (u.includes("/voyager/api/") && (u.includes("messag") || u.includes("Convers"))) {
      try {
        const body = await r.text();
        voyagerCalls.push({ method: r.request().method(), url: u.replace("https://www.linkedin.com", ""), status: r.status(), body: body.substring(0, 1500) });
      } catch {}
    }
  });

  await page.goto("https://www.linkedin.com/messaging/", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(8000);
  console.log("URL:", page.url());

  // Save captured calls
  const sessDir = path.join(__dirname, "sessions", "live");
  fs.writeFileSync(path.join(sessDir, "voyager_calls.json"), JSON.stringify(voyagerCalls, null, 2));
  console.log("Captured", voyagerCalls.length, "voyager calls. Saved to voyager_calls.json");
  console.log("\nURLs hit:");
  [...new Set(voyagerCalls.map(c => c.url))].forEach(u => console.log(" ", u));

  // Find a thread to message
  console.log("\n--- Find a recipient profile URN ---");
  const targetResult = await page.evaluate(async (csrf) => {
    // Try multiple known endpoints to find a conversation
    const endpoints = [
      "https://www.linkedin.com/voyager/api/voyagerMessagingDashMessengerConversations?keyVersion=LEGACY_INBOX",
      "https://www.linkedin.com/voyager/api/voyagerMessagingDashMessengerConversations",
      "https://www.linkedin.com/voyager/api/messaging/dash/conversations?keyVersion=LEGACY_INBOX",
    ];
    for (const url of endpoints) {
      try {
        const r = await fetch(url, { headers: { "csrf-token": csrf, "x-restli-protocol-version": "2.0.0", accept: "application/json" } });
        const t = await r.text();
        if (r.status === 200) {
          const j = JSON.parse(t);
          const el = (j.elements || [])[0];
          if (el) {
            const partU = el.participants?.[0]?.["*miniProfile"];
            if (partU) {
              const mailboxUrn = partU.replace("fs_miniProfile", "fsd_profile") + "-" + (el.participants[0].entityUrn || "").split(":").pop();
              return { url, status: 200, mailboxUrn, miniProfileUrn: partU };
            }
          }
          return { url, status: 200, raw: t.substring(0, 300) };
        }
      } catch (e) { return { url, error: e.message }; }
    }
    return { error: "no endpoint worked" };
  }, csrf);
  console.log("Target:", JSON.stringify(targetResult, null, 2));

  if (targetResult.error) {
    console.log("\nNo target. Dumping last 5 captured calls for diagnosis:");
    voyagerCalls.slice(-5).forEach(c => { console.log("---", c.method, c.url, c.status); console.log(c.body.substring(0, 500)); });
    await context.close();
    await browser.close();
    process.exit(0);
  }

  const miniProfileUrn = targetResult.miniProfileUrn;
  // The mailboxUrn format from screenshot: "urn:li:fsd_profile:<vanity>-<hash>"
  // We need: profile fsd URN + the long thread hash

  // Build the proper send payload using the actual structure from devtools
  // From the screenshot:
  //   mailboxUrn: "urn:li:fsd_profile:ACoAAGj45loB-nQmKeQasQoZJdn3YHCj5cYXRl0-nQmKeQasQoZJdn3YHCj5cYXR10"
  //   conversationUrn: "urn:li:msg_conversation:(urn:li:fsd_profile:ACoAAGj45loB-nQmKeQasQoZJdn3YHCj5cYXRe0-nQmKeQasQoZJdn3YHCj5cYXR10,2-OGRhYWFmM2ItNTYxYi00MDI3LTk2YWItMTg5NTE0NGFiYThmXzEwMA==)"
  // The "-nQmKeQasQoZJdn3YHCj5cYXR10" suffix is a LinkedIn-internal "vanity" path id.
  // The full mailboxUrn includes a profileId-vanityId format.

  // We need a profileId from a "vanity" — let me get the profile ID from the current session
  const meResult = await page.evaluate(async (csrf) => {
    const r = await fetch("https://www.linkedin.com/voyager/api/me", { headers: { "csrf-token": csrf, "x-restli-protocol-version": "2.0.0" } });
    const j = await r.json();
    return { plainId: j.plainId, publicIdentifier: j.miniProfile?.publicIdentifier, objectUrn: j.miniProfile?.objectUrn };
  }, csrf);
  console.log("Self:", meResult);

  // Get the recipient's profile (target) details
  const recipientResult = await page.evaluate(async (csrf, miniProfileUrn) => {
    // Try fetching the mini profile entity
    const r = await fetch(`https://www.linkedin.com/voyager/api/identity/profiles/${miniProfileUrn.split(":").pop()}`, { headers: { "csrf-token": csrf, "x-restli-protocol-version": "2.0.0" } });
    return { status: r.status, body: (await r.text()).substring(0, 500) };
  }, csrf, miniProfileUrn);
  console.log("Recipient profile:", recipientResult);

  await page.waitForTimeout(5000);
  await context.close();
  await browser.close();
  process.exit(0);
})().catch((e) => { console.error("FATAL:", e.message, e.stack); process.exit(1); });
