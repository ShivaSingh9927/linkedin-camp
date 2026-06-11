// Nav through different pages, capture all unique voyager URLs the real UI uses
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

  const voyagerCalls = new Set();
  page.on("response", (res) => {
    if (res.url().includes("/voyager/api/")) {
      voyagerCalls.add(res.url().replace("https://www.linkedin.com", "").replace(/variables=.*?(?=&|$)/g, "variables=X").replace(/queryId=.*?(?=&|$)/g, "queryId=X"));
    }
  });

  const pages = [
    "https://www.linkedin.com/feed/",
    "https://www.linkedin.com/jobs/",
    "https://www.linkedin.com/mynetwork/",
    "https://www.linkedin.com/notifications/",
    "https://www.linkedin.com/messaging/",
    "https://www.linkedin.com/in/shiva-singh-genai-llm/",
  ];
  for (const url of pages) {
    console.log(`Nav: ${url}`);
    try {
      await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30000 });
      await page.waitForTimeout(5000);
    } catch (e) {
      console.log(`  nav failed: ${e.message.split("\n")[0]}`);
    }
  }

  console.log(`\nTotal unique voyager URLs: ${voyagerCalls.size}\n`);
  [...voyagerCalls].sort().forEach(u => console.log(u));

  fs.writeFileSync(
    path.join(__dirname, "sessions", "live", "real_voyager_urls.txt"),
    [...voyagerCalls].sort().join("\n")
  );
  console.log("\nSaved to real_voyager_urls.txt");
  await ctx.close(); await browser.close();
})().catch((e) => { console.error("FATAL:", e.message); process.exit(1); });
