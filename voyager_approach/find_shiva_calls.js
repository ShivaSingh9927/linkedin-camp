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

  const calls = [];
  page.on("response", async (res) => {
    if (!res.url().includes("/voyager/api/")) return;
    try {
      const text = await res.text();
      const shivaIndicators = ["ACoAACdYnukB", "shiva-singh", "shivasingh", "Merai", "Meril", "genai-llm"];
      if (shivaIndicators.some(s => text.includes(s))) {
        calls.push({ url: res.url().replace("https://www.linkedin.com", ""), status: res.status(), snippet: text.substring(0, 500) });
      }
    } catch {}
  });

  await page.goto(`https://www.linkedin.com/in/shiva-singh-genai-llm`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(5000);
  for (let i = 0; i < 5; i++) {
    await page.evaluate(y => window.scrollTo(0, y), i * 1000);
    await page.waitForTimeout(1500);
  }
  console.log(`Calls mentioning shiva: ${calls.length}`);
  calls.forEach(c => console.log(`\n[${c.status}] ${c.url}\n    ${c.snippet}\n`));
  await ctx.close(); await browser.close();
})().catch((e) => { console.error("FATAL:", e.message); process.exit(1); });
