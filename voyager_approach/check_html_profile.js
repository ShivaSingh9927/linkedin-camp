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
  await page.goto(`https://www.linkedin.com/in/shiva-singh-genai-llm`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(4000);

  const shivaData = await page.evaluate(() => {
    const scripts = Array.from(document.scripts);
    const out = [];
    const indicators = ["shiva-singh-genai-llm", "ACoAACdYnukB", "Merai", "Meril", "GenAI"];
    for (const s of scripts) {
      if (!s.textContent) continue;
      if (indicators.some(x => s.textContent.includes(x))) {
        out.push({ len: s.textContent.length, head: s.textContent.substring(0, 400) });
      }
    }
    return out;
  });
  console.log(`Found ${shivaData.length} script(s) with shiva's data`);
  shivaData.forEach((s, i) => {
    console.log(`\n--- script[${i}] length=${s.len} ---`);
    console.log(s.head);
  });
  await ctx.close(); await browser.close();
})().catch((e) => { console.error("FATAL:", e.message); process.exit(1); });
