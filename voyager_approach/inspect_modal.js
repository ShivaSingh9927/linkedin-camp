// Click contact-info and inspect the modal DOM for the data
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
const vanity = "shiva-singh-genai-llm";

(async () => {
  const cookies = JSON.parse(fs.readFileSync(path.join(SESSION, "cookies.json"), "utf8"));
  const browser = await chromium.launch({
    headless: false, proxy: PROXY,
    args: ["--disable-blink-features=AutomationControlled", "--start-maximized"],
  });
  const ctx = await browser.newContext({
    viewport: null,
    userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36",
    locale: "en-IN", timezoneId: "Asia/Kolkata", proxy: PROXY,
  });
  await ctx.addCookies(cookies);
  const page = await ctx.newPage();

  const allCalls = [];
  page.on("request", (r) => {
    allCalls.push({ url: r.url(), method: r.method(), body: r.postData()?.substring(0, 500), phase: "req" });
  });
  page.on("response", async (r) => {
    try {
      const text = await r.text();
      allCalls.push({ url: r.url(), status: r.status(), body: text.substring(0, 5000), phase: "res" });
    } catch {}
  });

  await page.goto(`https://www.linkedin.com/in/${vanity}`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(5000);
  const beforeCount = allCalls.length;

  const ciLink = await page.$('a:has-text("Contact info")');
  if (ciLink) {
    await ciLink.click();
    await page.waitForTimeout(5000);
  }

  // Check the modal's HTML
  const modalData = await page.evaluate(() => {
    const modal = document.querySelector('[role="dialog"]');
    if (!modal) return { found: false };
    // Extract all data-* attributes
    const dataAttrs = {};
    const collect = (el) => {
      if (!el) return;
      for (const attr of el.attributes) {
        if (attr.name.startsWith("data-")) {
          if (!dataAttrs[attr.name]) dataAttrs[attr.name] = [];
          dataAttrs[attr.name].push(attr.value.substring(0, 200));
        }
      }
    };
    modal.querySelectorAll("*").forEach(collect);
    return {
      found: true,
      html: modal.innerHTML.substring(0, 5000),
      dataAttrs: Object.fromEntries(Object.entries(dataAttrs).slice(0, 30)),
      text: modal.innerText,
    };
  });
  console.log("Modal found:", modalData.found);
  if (modalData.found) {
    console.log("\nModal text:");
    console.log(modalData.text);
    console.log("\nData attributes found:");
    for (const [k, v] of Object.entries(modalData.dataAttrs)) {
      if (v.some(x => /phone|email|@|9368/i.test(x))) {
        console.log(`  ${k}:`, v.find(x => /phone|email|@|9368/i.test(x)));
      }
    }
  }

  // Now grep ALL calls for email/phone
  console.log("\n=== ALL CALLS WITH EMAIL/PHONE ===");
  allCalls.forEach((c, i) => {
    const text = c.body || "";
    if (/@gmail|@yahoo|9368084140/i.test(text)) {
      console.log(`\n[${i}] ${c.phase} ${c.method || c.status} ${c.url.substring(0, 200)}`);
      console.log("  body:", text.substring(0, 1500));
    }
  });

  fs.writeFileSync(
    path.join(__dirname, "sessions", "live", "all_calls.json"),
    JSON.stringify(allCalls, null, 2)
  );

  await ctx.close();
  await browser.close();
})().catch((e) => { console.error("FATAL:", e.message, e.stack); process.exit(1); });
