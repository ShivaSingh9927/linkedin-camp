// Get 1st-degree contact info — shiva-singh-genai-llm is Snehlata's only 1st-degree
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
  await page.goto("https://www.linkedin.com/feed/", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(4000);

  const FSD = "ACoAACdYnukB_Rgm7qVvte0xhLy9SZGEbuvKMd0";
  const vanity = "shiva-singh-genai-llm";

  // 1. Get the basic + FullProfile-76 (this is the 1st-degree response)
  console.log("========== 1) FullProfile-76 (the only thing that's been working) ==========");
  const r1 = await page.evaluate(async (url) => {
    const csrf = document.cookie.match(/JSESSIONID=([^;]+)/)[1].replace(/"/g, "");
    const res = await fetch(url, { headers: { "csrf-token": csrf, "x-restli-protocol-version": "2.0.0" } });
    return await res.text();
  }, `https://www.linkedin.com/voyager/api/identity/dash/profiles/urn:li:fsd_profile:${FSD}?decorationId=com.linkedin.voyager.dash.deco.identity.profile.FullProfile-76`);
  const d1 = JSON.parse(r1);
  console.log("Status: 200");
  console.log("Top keys:", Object.keys(d1).join(", "));
  console.log("Has contactInfo?", !!d1.contactInfo);
  console.log("Has emailAddresses?", !!d1.emailAddresses);
  console.log("Has phoneNumbers?", !!d1.phoneNumbers);
  if (d1.contactInfo) console.log("contactInfo:", JSON.stringify(d1.contactInfo));
  if (d1.emailAddresses) console.log("emails:", JSON.stringify(d1.emailAddresses));
  if (d1.phoneNumbers) console.log("phones:", JSON.stringify(d1.phoneNumbers));

  // Look for the contact info in *included
  if (d1.included) {
    console.log("\nIncluded entities types:", [...new Set(d1.included.map(e => e.$type || e._type))].join("\n  "));
    const ciEntities = d1.included.filter(e => /contact|email|phone/i.test(e.$type || e._type || ""));
    console.log("\nContact-related entities in included:");
    ciEntities.forEach(e => {
      console.log("  Type:", e.$type || e._type);
      console.log("  Data:", JSON.stringify(e).substring(0, 300));
    });
  }

  // 2. Try the explicit contact info endpoint
  console.log("\n========== 2) identity/dash/profileContactInfo ==========");
  const r2 = await page.evaluate(async (url) => {
    const csrf = document.cookie.match(/JSESSIONID=([^;]+)/)[1].replace(/"/g, "");
    const res = await fetch(url, { headers: { "csrf-token": csrf, "x-restli-protocol-version": "2.0.0" } });
    return { status: res.status, body: await res.text() };
  }, `https://www.linkedin.com/voyager/api/identity/dash/profileContactInfo/${FSD}`);
  console.log("Status:", r2.status);
  console.log("Body:", r2.body.substring(0, 1500));

  // 3. Try the contact-info endpoint
  console.log("\n========== 3) identity/profileContactInfo ==========");
  const r3 = await page.evaluate(async (url) => {
    const csrf = document.cookie.match(/JSESSIONID=([^;]+)/)[1].replace(/"/g, "");
    const res = await fetch(url, { headers: { "csrf-token": csrf, "x-restli-protocol-version": "2.0.0" } });
    return { status: res.status, body: await res.text() };
  }, `https://www.linkedin.com/voyager/api/identity/profileContactInfo/${FSD}`);
  console.log("Status:", r3.status);
  console.log("Body:", r3.body.substring(0, 1500));

  // 4. Try ContactInfo specific decoration
  console.log("\n========== 4) FullProfile-76 + ContactInfo-22 decoration ==========");
  const r4 = await page.evaluate(async (url) => {
    const csrf = document.cookie.match(/JSESSIONID=([^;]+)/)[1].replace(/"/g, "");
    const res = await fetch(url, { headers: { "csrf-token": csrf, "x-restli-protocol-version": "2.0.0" } });
    return { status: res.status, body: await res.text() };
  }, `https://www.linkedin.com/voyager/api/identity/dash/profiles/urn:li:fsd_profile:${FSD}?decorationId=com.linkedin.voyager.dash.deco.identity.profile.ContactInfo-22`);
  console.log("Status:", r4.status);
  if (r4.status === 200) {
    const d4 = JSON.parse(r4.body);
    console.log("Top keys:", Object.keys(d4).join(", "));
    if (d4.emailAddresses || d4.phoneNumbers) {
      console.log("🎯 FOUND!", JSON.stringify(d4).substring(0, 1500));
    }
  } else {
    console.log("Body:", r4.body.substring(0, 500));
  }

  // 5. Try the "inclusions" approach - find the contactInfo URN
  console.log("\n========== 5) Find *contactInfo pointer in FullProfile ==========");
  const keys = Object.keys(d1);
  for (const k of keys) {
    if (k.startsWith("*")) console.log("  Pointer:", k, "→", d1[k]);
  }

  // 6. Try the contact-info endpoint with the *contactInfo URN resolved
  const cInfoUrn = d1["*contactInfo"] || d1.contactInfo;
  if (cInfoUrn) {
    console.log("\nResolving contactInfo URN:", cInfoUrn);
    const r5 = await page.evaluate(async (url) => {
      const csrf = document.cookie.match(/JSESSIONID=([^;]+)/)[1].replace(/"/g, "");
      const res = await fetch(url, { headers: { "csrf-token": csrf, "x-restli-protocol-version": "2.0.0" } });
      return { status: res.status, body: await res.text() };
    }, `https://www.linkedin.com/voyager/api/identity/profiles/${vanity}/profile-contact-info`);
    console.log("Status:", r5.status);
    if (r5.status === 200) {
      const d = JSON.parse(r5.body);
      console.log("✅ GOT IT:", JSON.stringify(d).substring(0, 2000));
    } else {
      console.log("Body:", r5.body.substring(0, 500));
    }
  }

  // 7. Try one more - the contact-info card endpoint
  console.log("\n========== 6) voyagerIdentityProfileFullContactInfo ==========");
  const r6 = await page.evaluate(async (url) => {
    const csrf = document.cookie.match(/JSESSIONID=([^;]+)/)[1].replace(/"/g, "");
    const res = await fetch(url, { headers: { "csrf-token": csrf, "x-restli-protocol-version": "2.0.0" } });
    return { status: res.status, body: await res.text() };
  }, `https://www.linkedin.com/voyager/api/identity/profiles/${vanity}/contactInfo`);
  console.log("Status:", r6.status);
  console.log("Body:", r6.body.substring(0, 1000));

  // 8. Try with memberId (not fsd)
  console.log("\n========== 7) Try memberId-based contact info ==========");
  const r7 = await page.evaluate(async (url) => {
    const csrf = document.cookie.match(/JSESSIONID=([^;]+)/)[1].replace(/"/g, "");
    const res = await fetch(url, { headers: { "csrf-token": csrf, "x-restli-protocol-version": "2.0.0" } });
    return { status: res.status, body: await res.text() };
  }, `https://www.linkedin.com/voyager/api/voyagerIdentityDashContactInfo/${FSD}`);
  console.log("Status:", r7.status);
  console.log("Body:", r7.body.substring(0, 500));

  // 9. Open the contact-info modal in DOM
  console.log("\n========== 8) Open Contact Info modal in DOM ==========");
  await page.goto(`https://www.linkedin.com/in/${vanity}`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(5000);
  // Look for contact info link
  const ciLink = await page.$('a[href*="contactInfo"], a:has-text("Contact info"), button:has-text("Contact info")');
  if (ciLink) {
    console.log("Found contact info link, clicking...");
    await ciLink.click();
    await page.waitForTimeout(3000);
    // Get the modal HTML
    const modalText = await page.evaluate(() => document.body.innerText);
    console.log("Modal content:");
    console.log(modalText.substring(0, 2000));
  } else {
    console.log("No contact info link visible on profile");
    // Take screenshot for debug
    await page.screenshot({ path: "/tmp/opencode/1stdeg_profile.png", fullPage: true });
    console.log("Screenshot: /tmp/opencode/1stdeg_profile.png");
  }

  await ctx.close();
  await browser.close();
})().catch((e) => { console.error("FATAL:", e.message, e.stack); process.exit(1); });
