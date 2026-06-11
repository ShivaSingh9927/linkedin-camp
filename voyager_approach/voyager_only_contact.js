// Voyager-only contact info probe — exhaustive URL attempts
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
const FSD = "ACoAACdYnukB_Rgm7qVvte0xhLy9SZGEbuvKMd0";
const vanity = "shiva-singh-genai-llm";
const MEMBER_ID = "660119273";  // from earlier: objectUrn: urn:li:member:660119273

(async () => {
  const cookies = JSON.parse(fs.readFileSync(path.join(SESSION, "cookies.json"), "utf8"));
  const csrf = cookies.find(c => c.name === "JSESSIONID").value.replace(/"/g, "");
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

  async function call(url) {
    return await page.evaluate(async ({ url, csrf }) => {
      const r = await fetch(url, { headers: { "csrf-token": csrf, "x-restli-protocol-version": "2.0.0", "accept": "application/json" } });
      return { status: r.status, body: await r.text() };
    }, { url, csrf });
  }

  const urls = [
    // REST endpoints
    `https://www.linkedin.com/voyager/api/identity/profiles/${vanity}/profile-contact-info`,
    `https://www.linkedin.com/voyager/api/identity/dash/profiles/urn:li:fsd_profile:${FSD}/profile-contact-info`,
    `https://www.linkedin.com/voyager/api/identity/profileContactInfo/${FSD}`,
    `https://www.linkedin.com/voyager/api/identity/dash/profileContactInfo/${FSD}`,
    `https://www.linkedin.com/voyager/api/voyagerIdentityDashContactInfo/${FSD}`,
    `https://www.linkedin.com/voyager/api/voyagerIdentityDashProfileContactInfo/${FSD}`,
    // GraphQL with explicit ContactInfo decoration
    `https://www.linkedin.com/voyager/api/graphql?includeWebMetadata=true&variables=(memberIdentity:${vanity},decorationId:com.linkedin.voyager.dash.deco.identity.profile.ContactInfo-22)&queryId=voyagerIdentityDashProfiles.b5c27c04968c409fc0ed3546575b9b7a`,
    `https://www.linkedin.com/voyager/api/graphql?includeWebMetadata=true&variables=(memberIdentity:${FSD},decorationId:com.linkedin.voyager.dash.deco.identity.profile.ContactInfo-22)&queryId=voyagerIdentityDashProfiles.b5c27c04968c409fc0ed3546575b9b7a`,
    // Email-specific
    `https://www.linkedin.com/voyager/api/identity/profiles/${vanity}/email`,
    `https://www.linkedin.com/voyager/api/identity/dash/profiles/urn:li:fsd_profile:${FSD}/emails`,
    // Phone-specific
    `https://www.linkedin.com/voyager/api/identity/profiles/${vanity}/phone`,
    `https://www.linkedin.com/voyager/api/identity/dash/profiles/urn:li:fsd_profile:${FSD}/phones`,
    // MemberId-based
    `https://www.linkedin.com/voyager/api/identity/dash/profiles/byMemberId/${MEMBER_ID}/profileContactInfo`,
    // LinkedIn ProfileView overlay URL
    `https://www.linkedin.com/voyager/api/identity/profiles/${vanity}/overlay/contact-info`,
    // Old endpoints
    `https://www.linkedin.com/voyager/api/identity/profiles/${vanity}/contact-info`,
    `https://www.linkedin.com/voyager/api/identity/profiles/${vanity}/contactInfo`,
    // Profile entity types
    `https://www.linkedin.com/voyager/api/identity/dash/ProfileContactInfo/${FSD}`,
    // Connection-of-connections (since 1st-degree)
    `https://www.linkedin.com/voyager/api/identity/dash/profiles/urn:li:fsd_profile:${FSD}?decorationId=com.linkedin.voyager.dash.deco.identity.profile.ConnectedMemberContactInfo-7`,
  ];

  console.log("Testing", urls.length, "URLs for contact info via Voyager:\n");
  for (const u of urls) {
    const r = await call(u);
    const short = u.replace("https://www.linkedin.com", "");
    const text = r.body || "";
    const hasEmail = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/.test(text);
    const hasPhone = /(?:^|\D)\d{10,}(?:\D|$)/.test(text);
    const emoji = r.status === 200 ? "✅" : r.status === 400 ? "🚫" : r.status === 403 ? "🔒" : r.status === 404 ? "❌" : r.status === 410 ? "💀" : "⚠️";
    console.log(`${emoji} [${r.status}] ${short}`);
    if (hasEmail || hasPhone) {
      console.log(`  🎯 HAS CONTACT!`);
      // Show context
      const em = text.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g);
      const ph = text.match(/(?:^|\D)(\d{10,})(?:\D|$)/g);
      if (em) console.log("  emails:", em);
      if (ph) console.log("  phones:", ph);
    }
  }

  await ctx.close();
  await browser.close();
})().catch((e) => { console.error("FATAL:", e.message, e.stack); process.exit(1); });
