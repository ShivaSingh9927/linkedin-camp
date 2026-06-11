// Test the API enrichment path end-to-end
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

  // Capture csrf + page-instance from first voyager call
  const csrfRef = { value: null };
  const piRef = { value: null };
  page.on("request", (r) => {
    if (r.url().includes("/voyager/") && !csrfRef.value) {
      csrfRef.value = r.headers()["csrf-token"];
      piRef.value = r.headers()["x-li-page-instance"];
    }
  });

  // Step 1: Navigate to /feed/ to warm session
  console.log("=== Step 1: Warm session ===");
  await page.goto("https://www.linkedin.com/feed/", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(5000);
  console.log(`csrf: ${csrfRef.value?.substring(0, 30)}...`);
  console.log(`page-instance: ${piRef.value}`);

  const call = async (url) => {
    return await page.evaluate(async ({ url, csrf, pi }) => {
      const r = await fetch(url, {
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
    }, { url, csrf: csrfRef.value, pi: piRef.value });
  };

  // Step 2: /me
  console.log("\n=== Step 2: /me ===");
  const meR = await call("https://www.linkedin.com/voyager/api/me");
  console.log(`Status: ${meR.status}`);
  const me = JSON.parse(meR.body);
  const included = me.included || [];
  const mpUrn = me.data["*miniProfile"];
  const mp = included.find(e => e.entityUrn === mpUrn);
  console.log(`plainId: ${me.data.plainId}`);
  console.log(`premium: ${me.data.premiumSubscriber}`);
  console.log(`name: ${mp?.firstName} ${mp?.lastName}`);
  console.log(`occupation: ${mp?.occupation}`);
  console.log(`publicIdentifier (vanity): ${mp?.publicIdentifier}`);
  console.log(`dashEntityUrn (fsdUrn): ${mp?.dashEntityUrn}`);

  if (!mp?.dashEntityUrn) {
    console.log("No dashEntityUrn — aborting");
    await ctx.close(); await browser.close();
    return;
  }

  // Step 3: FullProfile-76
  console.log("\n=== Step 3: FullProfile-76 ===");
  const fsd = mp.dashEntityUrn;
  const fsdId = fsd.split(":").pop();
  const profileUrl = `https://www.linkedin.com/voyager/api/identity/dash/profiles/urn:li:fsd_profile:${fsdId}?decorationId=com.linkedin.voyager.dash.deco.identity.profile.FullProfile-76`;
  const profileR = await call(profileUrl);
  console.log(`Status: ${profileR.status}`);
  const profileData = JSON.parse(profileR.body);
  const pd = profileData.data || {};
  const pIncluded = profileData.included || [];
  const industry = pIncluded.find(e => e["$type"]?.includes("Industry"));
  const geo = pIncluded.find(e => e["$type"]?.includes("Geo") && !e["$type"]?.includes("Country"));
  const pronoun = pd.pronounUnion?.standardizedPronoun || pd.pronounUnion?.customPronoun || null;

  const enriched = {
    firstName: pd.firstName,
    lastName: pd.lastName,
    headline: pd.headline,
    summary: pd.summary?.substring(0, 200) + "...",
    publicIdentifier: pd.publicIdentifier,
    memberId: pd.objectUrn?.split(":").pop(),
    industry: industry?.name || null,
    geoLocation: geo?.defaultLocalizedName || null,
    premium: pd.premium,
    pronouns: pronoun,
    photoUrl: pd.profilePicture?.displayImageReference?.vectorImage?.artifacts?.[0]
      ? `${pd.profilePicture.displayImageReference.vectorImage.rootUrl}${pd.profilePicture.displayImageReference.vectorImage.artifacts[0].fileIdentifyingUrlPathSegment}`
      : null,
  };

  console.log("\n=== ENRICHED PROFILE (what AI receives) ===");
  for (const [k, v] of Object.entries(enriched)) {
    console.log(`  ${k}: ${v}`);
  }

  // Step 4: Simulate what the AI service would receive
  console.log("\n=== AI SERVICE INPUT (SelfProfileRequest) ===");
  const aiInput = {
    name: `${enriched.firstName} ${enriched.lastName}`,
    headline: enriched.headline,
    about: pd.summary,
    company: null, // parsed from headline by AI
    job_title: null, // parsed from headline by AI
    location: enriched.geoLocation,
    posts: [], // API mode: no posts
    industry: enriched.industry,
    geo_location: enriched.geoLocation,
    premium: enriched.premium,
    pronouns: enriched.pronouns,
    vanity: enriched.publicIdentifier,
    member_id: enriched.memberId,
    profile_picture_url: enriched.photoUrl,
  };
  console.log(JSON.stringify(aiInput, null, 2));

  // Save
  fs.writeFileSync(
    path.join(__dirname, "sessions", "live", "enrichment_api_test.json"),
    JSON.stringify({ enriched, aiInput }, null, 2)
  );
  console.log("\nSaved to enrichment_api_test.json");

  await ctx.close();
  await browser.close();
})().catch((e) => { console.error("FATAL:", e.message, e.stack); process.exit(1); });
