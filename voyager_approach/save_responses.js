// Save full responses for inspection
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

  const csrfRef = { value: null };
  const piRef = { value: null };
  page.on("request", (r) => {
    if (r.url().includes("/voyager/") && !csrfRef.value) {
      csrfRef.value = r.headers()["csrf-token"];
      piRef.value = r.headers()["x-li-page-instance"];
    }
  });

  await page.goto("https://www.linkedin.com/messaging/", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(5000);

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

  // Save each one for inspection
  const calls = [
    { name: "me", url: "https://www.linkedin.com/voyager/api/me" },
    { name: "profile_shiva", url: "https://www.linkedin.com/voyager/api/identity/dash/profiles/urn:li:fsd_profile:ACoAACdYnukB_Rgm7qVvte0xhLy9SZGEbuvKMd0?decorationId=com.linkedin.voyager.dash.deco.identity.profile.FullProfile-76" },
    { name: "connections_list", url: "https://www.linkedin.com/voyager/api/relationships/connections?count=10&start=0" },
  ];
  for (const c of calls) {
    const r = await call(c.url);
    fs.writeFileSync(path.join(__dirname, "sessions", "live", `voyager_${c.name}.json`), r.body);
    console.log(`Saved ${c.name}: status=${r.status}, length=${r.body.length}`);
  }

  // /me first 2000 chars
  console.log("\n=== /me ===");
  console.log(fs.readFileSync(path.join(__dirname, "sessions", "live", "voyager_me.json"), "utf8").substring(0, 2000));
  
  console.log("\n=== profile_shiva first 3000 chars ===");
  console.log(fs.readFileSync(path.join(__dirname, "sessions", "live", "voyager_profile_shiva.json"), "utf8").substring(0, 3000));

  console.log("\n=== connections_list first 2000 chars ===");
  console.log(fs.readFileSync(path.join(__dirname, "sessions", "live", "voyager_connections_list.json"), "utf8").substring(0, 2000));

  await ctx.close();
  await browser.close();
})().catch((e) => { console.error("FATAL:", e.message, e.stack); process.exit(1); });
