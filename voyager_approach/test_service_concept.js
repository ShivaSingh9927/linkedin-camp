// Test the voyager-api.service.ts end-to-end against a real session
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
  // Build a minimal shim of the service's page.context().request path
  // by manually re-issuing the same calls it would.
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

  // Capture csrf + page-instance from a real voyager call
  const realCsrfRef = { value: null };
  const realPiRef = { value: null };
  page.on("request", (r) => {
    if (r.url().includes("/voyager/") && !realCsrfRef.value) {
      realCsrfRef.value = r.headers()["csrf-token"];
      realPiRef.value = r.headers()["x-li-page-instance"];
    }
  });

  // Step 1: Navigate to /messaging/ which fires voyager calls on load
  // The /feed/ page might not fire voyager — use /messaging/ for reliable capture
  await page.goto("https://www.linkedin.com/messaging/", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(5000);
  console.log(`Captured csrf: ${realCsrfRef.value}`);
  console.log(`Captured page-instance: ${realPiRef.value}`);

  if (!realCsrfRef.value) {
    // Fallback: /feed/ may not fire voyager. Try /notifications/ which always does.
    await page.goto("https://www.linkedin.com/feed/", { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(5000);
    console.log(`After /feed/: csrf=${realCsrfRef.value}, pi=${realPiRef.value}`);
  }

  // Step 2: Use page.context().request.get() with proper headers
  const testCall = async (url) => {
    return await page.evaluate(async ({ url, csrf, pi }) => {
      const r = await fetch(url, {
        method: "GET",
        credentials: "include",
        headers: {
          "csrf-token": csrf,
          "x-restli-protocol-version": "2.0.0",
          "accept": "application/vnd.linkedin.normalized+json+2.1",
          "x-li-lang": "en_US",
          "x-li-page-instance": pi,
        }
      });
      return { status: r.status, body: await r.text() };
    }, { url, csrf: realCsrfRef.value, pi: realPiRef.value });
  };

  // Try /me
  console.log("\n=== /me ===");
  const r1 = await testCall("https://www.linkedin.com/voyager/api/me");
  console.log(`Status: ${r1.status}`);
  if (r1.status === 200) {
    const j = JSON.parse(r1.body);
    console.log(`plainId: ${j.plainId}`);
    console.log(`name: ${j.miniProfile?.firstName} ${j.miniProfile?.lastName}`);
    console.log(`vanity: ${j.miniProfile?.publicIdentifier}`);
    console.log(`dashUrn: ${j.miniProfile?.dashEntityUrn}`);
  } else {
    console.log(`Body: ${r1.body.substring(0, 200)}`);
  }

  // Try profile enrichment
  console.log("\n=== Profile enrichment (shiva) ===");
  const fsd = "ACoAACdYnukB_Rgm7qVvte0xhLy9SZGEbuvKMd0";
  const r2 = await testCall(`https://www.linkedin.com/voyager/api/identity/dash/profiles/urn:li:fsd_profile:${fsd}?decorationId=com.linkedin.voyager.dash.deco.identity.profile.FullProfile-76`);
  console.log(`Status: ${r2.status}`);
  if (r2.status === 200) {
    const j = JSON.parse(r2.body);
    console.log(`Body keys: ${Object.keys(j).join(", ")}`);
    // Look for the profile entity — REST response shape varies
    const profile = j.elements?.[0] || j.data || j;
    console.log(`firstName: ${profile.firstName}, lastName: ${profile.lastName}`);
    console.log(`headline: ${profile.headline?.substring(0, 60)}`);
    console.log(`summary length: ${profile.summary?.length}`);
    console.log(`location: ${profile.locationName}`);
    console.log(`memberId: ${profile.memberId}`);
    console.log(`vanity: ${profile.publicIdentifier}`);
    console.log(`industry: ${profile.industryName}`);
    fs.writeFileSync(path.join(__dirname, "sessions", "live", "voyager_profile_shiva.json"), r2.body);
  } else {
    console.log(`Body: ${r2.body.substring(0, 500)}`);
  }

  // Connections
  console.log("\n=== Connections summary ===");
  const r3 = await testCall("https://www.linkedin.com/voyager/api/relationships/connectionsSummary");
  console.log(`Status: ${r3.status}, body: ${r3.body.substring(0, 200)}`);

  // Connections list
  console.log("\n=== Connections list ===");
  const r4 = await testCall("https://www.linkedin.com/voyager/api/relationships/connections?count=10&start=0");
  console.log(`Status: ${r4.status}, length: ${r4.body.length}`);
  if (r4.status === 200) {
    const j = JSON.parse(r4.body);
    console.log(`Total: ${j.paging?.total}, elements: ${j.elements?.length}`);
  }

  // Mailbox counts
  console.log("\n=== Mailbox counts (need self urn) ===");
  const meUrl = "https://www.linkedin.com/voyager/api/me";
  const meR = await testCall(meUrl);
  if (meR.status === 200) {
    const me = JSON.parse(meR.body);
    const mailboxUrn = me.miniProfile?.dashEntityUrn;
    if (mailboxUrn) {
      const countsUrl = `https://www.linkedin.com/voyager/api/voyagerMessagingGraphQL/graphql?queryId=messengerMailboxCounts.fc528a5a81a76dff212a4a3d2d48e84b&variables=(mailboxUrn:${encodeURIComponent(mailboxUrn)})`;
      const r5 = await testCall(countsUrl);
      console.log(`Counts status: ${r5.status}, body: ${r5.body.substring(0, 500)}`);
    }
  }

  await ctx.close();
  await browser.close();
})().catch((e) => { console.error("FATAL:", e.message, e.stack); process.exit(1); });
