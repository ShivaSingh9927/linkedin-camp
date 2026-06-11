// Get raw contact info response to see what's there
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

  // Test on SELF first (we know what our own email is)
  const vanity = "sneh-singh-736977411";
  const urls = [
    `https://www.linkedin.com/voyager/api/graphql?includeWebMetadata=true&variables=(memberIdentity:${vanity},decorationId:com.linkedin.voyager.dash.deco.identity.profile.ContactInfo-22)&queryId=voyagerIdentityDashProfiles.b5c27c04968c409fc0ed3546575b9b7a`,
    `https://www.linkedin.com/voyager/api/graphql?includeWebMetadata=true&variables=(memberIdentity:${vanity},decorationId:com.linkedin.voyager.dash.deco.identity.profile.ProfileWithContactInfo-20)&queryId=voyagerIdentityDashProfiles.b5c27c04968c409fc0ed3546575b9b7a`,
  ];

  for (const u of urls) {
    console.log(`\n=== ${u} ===`);
    const r = await page.evaluate(async (url) => {
      const csrf = document.cookie.match(/JSESSIONID=([^;]+)/)[1].replace(/"/g, "");
      const res = await fetch(url, { headers: { "csrf-token": csrf, "x-restli-protocol-version": "2.0.0" } });
      return { status: res.status, body: await res.text() };
    }, u);
    console.log(`Status: ${r.status}`);
    if (r.status === 200) {
      const d = JSON.parse(r.body);
      // Get top-level keys
      console.log("Top keys:", Object.keys(d).slice(0, 20).join(", "));
      // Find contactInfo-like fields
      for (const k of Object.keys(d)) {
        if (typeof d[k] === "string" && (d[k].includes("@") || /phone|email|twitter|web/i.test(d[k]))) {
          console.log(`  ${k}: ${d[k]}`);
        }
      }
      // Print short summary
      const text = JSON.stringify(d);
      console.log("Response size:", text.length);
      // Print first 2000 chars
      console.log("Body:", text.substring(0, 2500));
    } else {
      console.log("Body:", r.body.substring(0, 500));
    }
  }

  await ctx.close();
  await browser.close();
})().catch((e) => { console.error("FATAL:", e.message); process.exit(1); });
