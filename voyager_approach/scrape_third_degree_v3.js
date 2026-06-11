// Scrape 3 3rd-degree profiles — proper extraction
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

const TARGETS = [
  { name: "Aashish Sharma", csvTitle: "EVP Group Sales at Capgemini", vanity: "aashishsharma1", fsd: "ACoAAAAGn7gBi4O70gKnTBxNK7D_e_YrF8N6d68" },
  { name: "Mohammad Niyamat", csvTitle: "Area Sales Executive at Varun Beverages (Pepsi)", vanity: "mohammadniyamat", fsd: "ACoAADLA2kQB1y6lW9m-uKSq4R6-PLT-kQKQcB8" },
  { name: "Aditya Singh", csvTitle: "Senior Sales Executive at Lagavi", vanity: "adityasingh2806", fsd: "ACoAAEwkvEgBFllpOXm0zjNEK77tarisY1TCkcs" },
];

async function call(page, url) {
  return await page.evaluate(async (url) => {
    const csrf = document.cookie.match(/JSESSIONID=([^;]+)/)[1].replace(/"/g, "");
    const r = await fetch(url, { headers: { "csrf-token": csrf, "x-restli-protocol-version": "2.0.0", "accept": "application/json" } });
    return { status: r.status, body: await r.text() };
  }, url);
}

async function getFullProfile(page, fsd) {
  const url = `https://www.linkedin.com/voyager/api/identity/dash/profiles/urn:li:fsd_profile:${fsd}?decorationId=com.linkedin.voyager.dash.deco.identity.profile.FullProfile-76`;
  const r = await call(page, url);
  if (r.status !== 200) return { status: r.status, body: r.body };
  return { status: 200, data: JSON.parse(r.body) };
}

function extractProfile(data) {
  // The FullProfile-76 response is the profile object itself, not in `included`
  const out = {};
  // Top-level fields
  out.firstName = data.firstName;
  out.lastName = data.lastName;
  out.fullName = [data.firstName, data.lastName].filter(Boolean).join(" ");
  out.headline = data.headline || data.occupation;
  out.summary = data.multiLocaleSummary?.en_US || data.summary || "";
  out.publicIdentifier = data.publicIdentifier;
  out.location = data.locationName || (data.geoLocation && data.geoLocation.geo);
  out.objectUrn = data.objectUrn; // urn:li:member:<id>
  out.memberId = data.objectUrn?.match(/urn:li:member:(\d+)/)?.[1];
  out.entityUrn = data.entityUrn;
  out.trackingId = data.trackingId;
  out.industry = data.industryName;
  out.industryUrn = data.industryUrn;
  out.versionTag = data.versionTag;
  out.networkDistance = data.networkDistance; // "DISTANCE_3"
  // Profile photo
  if (data.profilePicture?.displayImageReference?.vectorImage?.rootUrl) {
    out.photoUrl = data.profilePicture.displayImageReference.vectorImage.rootUrl + "200_200/" +
      data.profilePicture.displayImageReference.vectorImage.artifacts?.[1]?.fileIdentifyingUrlPathSegment;
  }
  // Experience: look in the response
  // The FullProfile-76 includes nested *elements pointers — to get full experience we'd need
  // to resolve them. But we get the title/company of current role from headline.
  out.connectionCount = data.connectionCount;
  out.followerCount = data.followerCount;
  out.address = data.address;
  // Try to extract experiences from nested *positionGroup or similar
  for (const k of Object.keys(data)) {
    if (k.startsWith("*") && Array.isArray(data[k + "Elements"])) {
      out[`resolved_${k}`] = data[k + "Elements"];
    }
  }
  return out;
}

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
  await page.goto("https://www.linkedin.com/feed/", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(4000);

  const results = [];
  for (const target of TARGETS) {
    console.log(`\n========== ${target.name} ==========`);
    console.log(`CSV Title:        ${target.csvTitle}`);
    console.log(`Vanity:           ${target.vanity}`);
    console.log(`FSD:              ${target.fsd}`);
    const r = await getFullProfile(page, target.fsd);
    if (r.status !== 200) {
      console.log(`❌ HTTP ${r.status}: ${r.body.substring(0, 200)}`);
      results.push({ ...target, status: r.status, body: r.body.substring(0, 200) });
      continue;
    }
    const p = extractProfile(r.data);
    console.log(`Response size:    ${JSON.stringify(r.data).length} chars`);
    console.log(`\n--- Extracted ---`);
    console.log(`Name:             ${p.fullName || "n/a"}`);
    console.log(`Headline:         ${p.headline || "n/a"}`);
    console.log(`Location:         ${p.location || "n/a"}`);
    console.log(`Public ID:        ${p.publicIdentifier || "n/a"}`);
    console.log(`Member ID:        ${p.memberId || "n/a"}`);
    console.log(`Network:          ${p.networkDistance || "n/a"}`);
    console.log(`Industry:         ${p.industry || "n/a"}`);
    console.log(`Connections:      ${p.connectionCount || "n/a"}`);
    console.log(`Followers:        ${p.followerCount || "n/a"}`);
    console.log(`\nSummary:          ${p.summary ? p.summary.substring(0, 250) + "..." : "n/a"}`);
    console.log(`Photo URL:        ${p.photoUrl || "n/a"}`);
    results.push({ ...target, status: 200, profile: p });
  }

  fs.writeFileSync(
    path.join(__dirname, "sessions", "live", "third_degree_v3.json"),
    JSON.stringify(results, null, 2)
  );
  console.log("\n\n✅ Saved to third_degree_v3.json");
  await ctx.close();
  await browser.close();
})().catch((e) => { console.error("FATAL:", e.message, e.stack); process.exit(1); });
