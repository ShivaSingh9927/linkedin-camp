// Check if contact info (email/phone) is in FullProfile-76 or needs another call
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
  { name: "Aashish Sharma", fsd: "ACoAAAAGn7gBi4O70gKnTBxNK7D_e_YrF8N6d68" },
  { name: "Mohammad Niyamat", fsd: "ACoAADLA2kQB1y6lW9m-uKSq4R6-PLT-kQKQcB8" },
  { name: "Aditya Singh", fsd: "ACoAAEwkvEgBFllpOXm0zjNEK77tarisY1TCkcs" },
];

async function call(page, url) {
  return await page.evaluate(async (url) => {
    const csrf = document.cookie.match(/JSESSIONID=([^;]+)/)[1].replace(/"/g, "");
    const r = await fetch(url, { headers: { "csrf-token": csrf, "x-restli-protocol-version": "2.0.0", "accept": "application/json" } });
    return { status: r.status, body: await r.text() };
  }, url);
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

  for (const t of TARGETS) {
    console.log(`\n========== ${t.name} ==========`);
    const url = `https://www.linkedin.com/voyager/api/identity/dash/profiles/urn:li:fsd_profile:${t.fsd}?decorationId=com.linkedin.voyager.dash.deco.identity.profile.FullProfile-76`;
    const r = await call(page, url);
    if (r.status !== 200) { console.log(`Failed: ${r.status}`); continue; }
    const data = JSON.parse(r.body);
    // Look for email/phone patterns in the entire response
    const text = JSON.stringify(data);
    console.log("Email pattern matches:", (text.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g) || []).slice(0, 5));
    console.log("Phone pattern matches:", (text.match(/\+?\d[\d\s\-\(\)]{7,}/g) || []).slice(0, 5));
    // Check for contact-info related fields
    const ci = data.contactInfo || data["*contactInfo"];
    console.log("Has contactInfo field:", !!ci);
    if (ci) console.log("contactInfo:", JSON.stringify(ci).substring(0, 500));
    // Look at all top-level keys
    console.log("Top-level keys:", Object.keys(data).slice(0, 40).join(", "));
  }

  // Now try the contact-info endpoint
  console.log("\n\n========== TRYING ContactInfo ENDPOINT ==========\n");
  for (const t of TARGETS) {
    console.log(`\n--- ${t.name} ---`);
    // Try ProfileWithContactInfo decoration
    const u1 = `https://www.linkedin.com/voyager/api/identity/dash/profiles/urn:li:fsd_profile:${t.fsd}?decorationId=com.linkedin.voyager.dash.deco.identity.profile.ProfileWithContactInfo-20`;
    const r1 = await call(page, u1);
    console.log(`ProfileWithContactInfo-20: ${r1.status}`);
    if (r1.status === 200) {
      const d = JSON.parse(r1.body);
      const text = JSON.stringify(d);
      console.log("  Emails:", (text.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g) || []).slice(0, 3));
      console.log("  Phones:", (text.match(/\+?\d[\d\s\-\(\)]{7,}/g) || []).slice(0, 3));
    }
    // Try REST profile-contact-info
    const vanity = t.name === "Aashish Sharma" ? "aashishsharma1" : t.name === "Mohammad Niyamat" ? "mohammadniyamat" : "adityasingh2806";
    const u2 = `https://www.linkedin.com/voyager/api/identity/profiles/${vanity}/profile-contact-info`;
    const r2 = await call(page, u2);
    console.log(`identity/profiles/{vanity}/profile-contact-info: ${r2.status}`);
    if (r2.status === 200) {
      console.log("  Body:", r2.body.substring(0, 500));
    }
    // Try contact-info as separate query
    const u3 = `https://www.linkedin.com/voyager/api/graphql?includeWebMetadata=true&variables=(memberIdentity:${vanity},decorationId:com.linkedin.voyager.dash.deco.identity.profile.ContactInfo-22)&queryId=voyagerIdentityDashProfiles.b5c27c04968c409fc0ed3546575b9b7a`;
    const r3 = await call(page, u3);
    console.log(`DashProfiles+ContactInfo-22: ${r3.status}`);
    if (r3.status === 200) {
      const d = JSON.parse(r3.body);
      const text = JSON.stringify(d);
      console.log("  Emails:", (text.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g) || []).slice(0, 3));
    }
  }

  await ctx.close();
  await browser.close();
})().catch((e) => { console.error("FATAL:", e.message); process.exit(1); });
