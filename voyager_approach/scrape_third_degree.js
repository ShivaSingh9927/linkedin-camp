// Scrape 3rd-degree profiles via Voyager — bypasses the 1st-degree restriction
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

// Three 3rd-degree profiles from the CSV
const TARGETS = [
  { name: "Aashish Sharma (Capgemini)", vanity: "aashishsharma1" },
  { name: "Mohammad Niyamat (Pepsi)", vanity: "mohammadniyamat" },
  { name: "Aditya Singh (Lagavi)", vanity: "adityasingh2806" },
];

async function gqlFetch(page, url) {
  return await page.evaluate(async (url) => {
    const csrf = document.cookie.match(/JSESSIONID=([^;]+)/)[1].replace(/"/g, "");
    const r = await fetch(url, {
      headers: {
        "csrf-token": csrf,
        "x-restli-protocol-version": "2.0.0",
        "accept": "application/json",
      },
    });
    return { status: r.status, body: await r.text() };
  }, url);
}

async function getFullProfile(page, vanity) {
  // First fetch basic profile to get the fsdUrn
  const basicUrl = `https://www.linkedin.com/voyager/api/graphql?includeWebMetadata=true&variables=(memberIdentity:${vanity})&queryId=voyagerIdentityDashProfiles.b5c27c04968c409fc0ed3546575b9b7a`;
  const basic = await gqlFetch(page, basicUrl);
  if (basic.status !== 200) return { stage: "basic", status: basic.status, body: basic.body };

  let basicJson;
  try { basicJson = JSON.parse(basic.body); } catch (e) { return { stage: "basic-parse", error: e.message }; }

  // Extract fsdUrn
  const fsdUrn = basicJson?.data?.data?.identityDashProfilesByMemberIdentity?.["*elements"]?.[0]?.replace("fsd_profile:", "");
  if (!fsdUrn) return { stage: "extract-fsd", basicJson };

  // Now fetch FullProfile-76
  const fullUrl = `https://www.linkedin.com/voyager/api/identity/dash/profiles/urn:li:fsd_profile:${fsdUrn}?decorationId=com.linkedin.voyager.dash.deco.identity.profile.FullProfile-76`;
  const full = await gqlFetch(page, fullUrl);
  if (full.status !== 200) return { stage: "full", status: full.status, body: full.body, fsdUrn };

  return { stage: "done", fsdUrn, profile: JSON.parse(full.body) };
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

  const results = {};
  for (const target of TARGETS) {
    console.log(`\n========== ${target.name} ==========`);
    console.log(`Vanity: ${target.vanity}`);
    const r = await getFullProfile(page, target.vanity);
    results[target.vanity] = r;

    if (r.stage === "done") {
      console.log(`fsdUrn: ${r.fsdUrn}`);
      const p = r.profile;
      // Extract key fields
      const mini = p.miniProfile || {};
      const topCard = (p.profileTopCard || p.topCard || p["*profileTopCard"] || {});
      const fullName = `${mini.firstName || ""} ${mini.lastName || ""}`.trim();
      console.log(`Name: ${fullName}`);
      console.log(`Headline: ${mini.occupation || "n/a"}`);
      console.log(`Location: ${mini.locationName || mini.geoLocation?.geo || "n/a"}`);
      console.log(`Vanity: ${mini.publicIdentifier || "n/a"}`);
      console.log(`fsdUrn: ${mini.entityUrn || "n/a"}`);
      console.log(`Connections: ${mini.networkDistance?.value || "n/a"}`);
      // Look for more detailed fields
      console.log(`Top-level keys in response: ${Object.keys(p).slice(0, 30).join(", ")}`);
      // Experience
      const positions = p.positionsView?.elements || p.positions?.elements || p.positionGroupView?.elements || [];
      if (positions.length) {
        console.log(`\nExperience (${positions.length} entries):`);
        positions.slice(0, 5).forEach(pos => {
          const comp = pos.companyName || pos.company?.name || pos["*company"] || "n/a";
          const title = pos.title || pos.positionName || "n/a";
          const start = pos.dateRange?.start?.year || pos.startDate?.year || "?";
          const end = pos.dateRange?.end?.year || pos.endDate?.year || "present";
          console.log(`  - ${title} @ ${comp} (${start}–${end})`);
        });
      }
      // Education
      const edu = p.educationsView?.elements || p.educations?.elements || p.educationView?.elements || [];
      if (edu.length) {
        console.log(`\nEducation (${edu.length} entries):`);
        edu.slice(0, 3).forEach(e => {
          const school = e.schoolName || e.school?.name || "n/a";
          const degree = e.degreeName || e.degree || "";
          console.log(`  - ${school}${degree ? " — " + degree : ""}`);
        });
      }
      // Skills
      const skills = p.skillsView?.elements || p.skills?.elements || [];
      if (skills.length) {
        console.log(`\nTop skills: ${skills.slice(0, 8).map(s => s.name || s).join(", ")}`);
      }
      // About
      if (p.about?.text || p.summary?.text) {
        console.log(`\nAbout: ${(p.about?.text || p.summary?.text).substring(0, 200)}...`);
      }
      console.log(`\nFULL response size: ${JSON.stringify(p).length} chars`);
    } else {
      console.log(`FAILED at stage: ${r.stage}`);
      console.log(JSON.stringify(r).substring(0, 500));
    }
  }

  fs.writeFileSync(
    path.join(__dirname, "sessions", "live", "third_degree_scrape.json"),
    JSON.stringify(results, null, 2)
  );
  console.log("\n\nSaved to third_degree_scrape.json");

  await ctx.close();
  await browser.close();
})().catch((e) => { console.error("FATAL:", e.message, e.stack); process.exit(1); });
