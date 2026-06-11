// Scrape 3 3rd-degree profiles — using FullProfile-76
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
  { name: "Aashish Sharma", title: "EVP Group Sales at Capgemini", vanity: "aashishsharma1", fsd: "ACoAAAAGn7gBi4O70gKnTBxNK7D_e_YrF8N6d68" },
  { name: "Mohammad Niyamat", title: "Area Sales Executive at Varun Beverages", vanity: "mohammadniyamat", fsd: "ACoAADLA2kQB1y6lW9m-uKSq4R6-PLT-kQKQcB8" },
  { name: "Aditya Singh", title: "Senior Sales Executive at Lagavi", vanity: "adityasingh2806", fsd: "ACoAAEwkvEgBFllpOXm0zjNEK77tarisY1TCkcs" },
];

async function call(page, url) {
  return await page.evaluate(async (url) => {
    const csrf = document.cookie.match(/JSESSIONID=([^;]+)/)[1].replace(/"/g, "");
    const r = await fetch(url, {
      headers: { "csrf-token": csrf, "x-restli-protocol-version": "2.0.0", "accept": "application/json" },
    });
    return { status: r.status, body: await r.text() };
  }, url);
}

async function getFullProfile(page, fsd) {
  const url = `https://www.linkedin.com/voyager/api/identity/dash/profiles/urn:li:fsd_profile:${fsd}?decorationId=com.linkedin.voyager.dash.deco.identity.profile.FullProfile-76`;
  const r = await call(page, url);
  if (r.status !== 200) return { status: r.status, body: r.body };
  return { status: 200, data: JSON.parse(r.body) };
}

function extractSummary(data) {
  // FullProfile-76 returns an "included" array with various entities
  const included = data.included || [];
  const byType = {};
  for (const e of included) {
    const t = e.$type || e._type;
    if (!byType[t]) byType[t] = [];
    byType[t].push(e);
  }
  // Find the miniProfile, profile, positions, educations, etc.
  const miniProfile = byType["com.linkedin.voyager.dash.identity.profile.MiniProfile"]?.[0] || byType["com.linkedin.voyager.dash.identity.profile.Profile"]?.[0];
  const positions = byType["com.linkedin.voyager.dash.identity.profile.Position"] || byType["com.linkedin.voyager.dash.identity.profile.PositionGroup"] || [];
  const educations = byType["com.linkedin.voyager.dash.identity.profile.Education"] || [];
  const skills = byType["com.linkedin.voyager.dash.identity.profile.Skill"] || [];
  const summary = { entityTypes: Object.keys(byType), totalIncluded: included.length };
  if (miniProfile) {
    summary.name = `${miniProfile.firstName || ""} ${miniProfile.lastName || ""}`.trim();
    summary.headline = miniProfile.occupation;
    summary.location = miniProfile.locationName;
    summary.publicIdentifier = miniProfile.publicIdentifier;
    summary.entityUrn = miniProfile.entityUrn;
    summary.objectUrn = miniProfile.objectUrn;
  }
  if (positions.length) {
    summary.experience = positions.slice(0, 5).map(p => ({
      title: p.title || p.positionName,
      company: p.companyName || (p.company && p.company.name),
      start: p.dateRange?.start?.year || p.startDate?.year,
      end: p.dateRange?.end?.year || p.endDate?.year,
      location: p.locationName,
    }));
  }
  if (educations.length) {
    summary.education = educations.slice(0, 3).map(e => ({
      school: e.schoolName,
      degree: e.degreeName,
      field: e.fieldOfStudy,
      start: e.dateRange?.start?.year,
      end: e.dateRange?.end?.year,
    }));
  }
  if (skills.length) {
    summary.skills = skills.slice(0, 15).map(s => s.name);
  }
  return summary;
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
    console.log(`\n========== ${target.name} (${target.title}) ==========`);
    console.log(`Vanity: ${target.vanity}`);
    console.log(`fsd:    ${target.fsd}`);
    const r = await getFullProfile(page, target.fsd);
    if (r.status !== 200) {
      console.log(`❌ HTTP ${r.status}: ${r.body.substring(0, 200)}`);
      results.push({ ...target, status: r.status, body: r.body.substring(0, 200) });
      continue;
    }
    const summary = extractSummary(r.data);
    console.log(`Response size: ${JSON.stringify(r.data).length} chars`);
    console.log(`Entity types in response: ${summary.entityTypes.length}`);
    console.log(`\n--- Extracted ---`);
    console.log(`Name: ${summary.name || "n/a"}`);
    console.log(`Headline: ${summary.headline || "n/a"}`);
    console.log(`Location: ${summary.location || "n/a"}`);
    console.log(`Public ID: ${summary.publicIdentifier || "n/a"}`);
    console.log(`EntityUrn: ${summary.entityUrn || "n/a"}`);
    if (summary.experience?.length) {
      console.log(`\nExperience (${summary.experience.length}):`);
      summary.experience.forEach(p => console.log(`  - ${p.title} @ ${p.company} (${p.start}–${p.end})`));
    }
    if (summary.education?.length) {
      console.log(`\nEducation (${summary.education.length}):`);
      summary.education.forEach(e => console.log(`  - ${e.school}${e.degree ? " — " + e.degree : ""}${e.field ? " in " + e.field : ""}`));
    }
    if (summary.skills?.length) {
      console.log(`\nSkills: ${summary.skills.join(", ")}`);
    }
    results.push({ ...target, status: 200, summary, totalIncluded: summary.totalIncluded, entityTypes: summary.entityTypes });
  }

  fs.writeFileSync(
    path.join(__dirname, "sessions", "live", "third_degree_v2.json"),
    JSON.stringify(results, null, 2)
  );
  console.log("\n\n✅ Saved to third_degree_v2.json");
  await ctx.close();
  await browser.close();
})().catch((e) => { console.error("FATAL:", e.message, e.stack); process.exit(1); });
