const { chromium } = require("patchright");
const fs = require("fs");
const path = require("path");

const PROXY = {
  server: "http://82.41.252.111:46222",
  username: "xBVyYdUpx84nWx7",
  password: "dwwTxtvv5a10RXn",
};

const EMAIL = "snehlatasingh9012@gmail.com";
const PASSWORD = "Hehe#35op";

(async () => {
  const browser = await chromium.launch({
    headless: false, channel: "chrome", args: ["--no-first-run", "--start-maximized"],
    proxy: PROXY,
  });
  const ctx = await browser.newContext({
    viewport: null,
    userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36",
    locale: "en-IN", timezoneId: "Asia/Kolkata",
  });
  const page = await ctx.newPage();

  await page.goto("https://www.linkedin.com/login", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(3000);
  console.log("URL after /login:", page.url());

  // If we're already on /feed/, we're logged in from a prior session
  let needsLogin = !page.url().includes("/feed/");
  if (!needsLogin) {
    console.log("✅ Already logged in from prior session. Capturing cookies...");
  } else {
    // Try to fill the form; if we get redirected during the wait, the check at the end will succeed
    console.log("Entering credentials...");
    try {
      await page.waitForSelector('input#username', { state: 'visible', timeout: 8000 });
      await page.fill('input#username', EMAIL);
      await page.fill('input#password', PASSWORD);
      await page.click('button[type="submit"]');
    } catch (e) {
      console.log("Form fill failed (likely auto-redirected):", e.message.split("\n")[0]);
    }
  }

  // Wait for nav
  await page.waitForTimeout(8000);
  console.log("After submit:", page.url());

  // Handle possible 2FA / challenge
  if (page.url().includes("checkpoint") || page.url().includes("challenge")) {
    console.log("\n⚠️ 2FA/CHECKPOINT DETECTED — handle it in the browser. Waiting up to 3 min...");
    await page.waitForTimeout(180000);
  }

  // Wait for /feed/
  for (let i = 0; i < 60; i++) {
    if (page.url().includes("/feed")) break;
    await page.waitForTimeout(1000);
  }
  console.log("Final URL:", page.url());

  if (!page.url().includes("/feed")) {
    console.log("Login failed. Screenshot saved.");
    await page.screenshot({ path: "/tmp/opencode/login_failed.png" });
    process.exit(1);
  }

  await page.waitForTimeout(5000);

  // Capture cookies
  const cookies = await ctx.cookies();
  const sessDir = path.join(__dirname, "voyager_approach", "sessions", "live");
  fs.mkdirSync(sessDir, { recursive: true });
  fs.writeFileSync(path.join(sessDir, "cookies.json"), JSON.stringify(cookies, null, 2));
  console.log("Saved", cookies.length, "cookies");

  // Also save to testscripts/sessions/snehlata/
  const snehlataDir = path.join(__dirname, "testscripts", "sessions", "snehlata");
  fs.mkdirSync(snehlataDir, { recursive: true });
  fs.writeFileSync(path.join(snehlataDir, "cookies.json"), JSON.stringify(cookies, null, 2));
  console.log("Also saved to", snehlataDir);

  // Capture localStorage
  const localStorage = await page.evaluate(() => {
    const out = {};
    for (let i = 0; i < window.localStorage.length; i++) {
      const k = window.localStorage.key(i);
      out[k] = window.localStorage.getItem(k);
    }
    return out;
  });
  fs.writeFileSync(path.join(snehlataDir, "localStorage.json"), JSON.stringify(localStorage));
  console.log("Saved", Object.keys(localStorage).length, "localStorage entries");

  // Capture fingerprint
  const fingerprint = {
    userAgent: await page.evaluate(() => navigator.userAgent),
    screen: await page.evaluate(() => ({ w: screen.width, h: screen.height })),
    locale: "en-IN",
    timezone: "Asia/Kolkata",
    capturedAt: new Date().toISOString(),
  };
  fs.writeFileSync(path.join(snehlataDir, "fingerprint.json"), JSON.stringify(fingerprint, null, 2));
  console.log("Saved fingerprint");

  // Verify by hitting /me
  const jsid = cookies.find(c => c.name === "JSESSIONID");
  const csrf = jsid.value.replace(/"/g, "");
  const me = await page.evaluate(async (csrf) => {
    const r = await fetch("https://www.linkedin.com/voyager/api/me", { headers: { "csrf-token": csrf, "x-restli-protocol-version": "2.0.0" } });
    return await r.text();
  }, csrf);
  console.log("Me:", me.substring(0, 200));

  await page.waitForTimeout(10000);
  await ctx.close();
  await browser.close();
  process.exit(0);
})().catch((e) => { console.error("FATAL:", e.message, e.stack); process.exit(1); });
