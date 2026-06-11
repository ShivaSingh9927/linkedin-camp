const { chromium } = require("patchright");
const fs = require("fs");
const path = require("path");

const PROXY = {
  server: "http://82.41.252.111:46222",
  username: "xBVyYdUpx84nWx7",
  password: "dwwTxtvv5a10RXn",
};

(async () => {
  const browser = await chromium.launch({
    headless: false,
    channel: "chrome",
    args: ["--no-first-run", "--start-maximized"],
  });

  const context = await browser.newContext({
    viewport: null,
    userAgent:
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36",
    locale: "en-IN",
    timezoneId: "Asia/Kolkata",
    proxy: PROXY,
  });
  const page = await context.newPage();

  await page.goto("https://www.linkedin.com/login", {
    waitUntil: "domcontentloaded",
  });
  console.log("Login page loaded. LOG IN NOW...");

  let handled = false;
  page.on("framenavigated", async (frame) => {
    if (handled) return;
    if (!frame.url().includes("/feed") && !frame.url().includes("/m/")) return;
    handled = true;
    console.log("Login detected:", frame.url());
    await page.waitForTimeout(5000);

    const cookies = await context.cookies();
    const sessDir = path.join(__dirname, "voyager_approach", "sessions", "live");
    fs.mkdirSync(sessDir, { recursive: true });
    fs.writeFileSync(
      path.join(sessDir, "cookies.json"),
      JSON.stringify(cookies, null, 2)
    );
    const jsid = cookies.find((c) => c.name === "JSESSIONID");
    const csrf = jsid ? jsid.value.replace(/"/g, "") : "";
    console.log("Saved", cookies.length, "cookies. CSRF:", csrf.substring(0, 25) + "...");

    // Find a conversation thread
    console.log("\n--- Fetching message threads ---");
    const threadsResult = await page.evaluate(async (csrf) => {
      const res = await fetch(
        "https://www.linkedin.com/voyager/api/voyagerMessagingDashMessengerThreads?count=10",
        {
          headers: {
            "csrf-token": csrf,
            "x-restli-protocol-version": "2.0.0",
            accept: "application/json",
          },
        }
      );
      const t = await res.text();
      try {
        const j = JSON.parse(t);
        const included = j.included || [];
        for (const el of included) {
          if (el.entityUrn && el.entityUrn.includes("fsd_profile")) {
            return {
              status: res.status,
              fsdUrn: el.entityUrn,
              objectUrn: el.objectUrn,
              firstName: el.firstName,
              lastName: el.lastName,
              occupation: el.occupation,
            };
          }
        }
        return { status: res.status, includedCount: included.length, sample: t.substring(0, 300) };
      } catch (e) {
        return { status: res.status, error: e.message, text: t.substring(0, 200) };
      }
    }, csrf);
    console.log("Threads result:", threadsResult);

    if (!threadsResult.fsdUrn) {
      console.log("No profile in threads. Trying profile dashboard messenger route...");
      // Try the messaging dash endpoint
      const dashResult = await page.evaluate(async (csrf) => {
        const res = await fetch(
          "https://www.linkedin.com/voyager/api/voyagerMessagingDashMessengerConversations?keyVersion=LEGACY_INBOX",
          { headers: { "csrf-token": csrf, "x-restli-protocol-version": "2.0.0", accept: "application/json" } }
        );
        return { status: res.status, text: (await res.text()).substring(0, 500) };
      }, csrf);
      console.log("Dash result:", dashResult);
    }

    let targetUrn = threadsResult.fsdUrn;
    if (!targetUrn) {
      console.log("Exiting: no target URN");
      await page.waitForTimeout(8000);
      await context.close();
      await browser.close();
      process.exit(0);
    }

    // Get conversation URN (thread) for this profile
    console.log("\n--- Finding thread URN for", targetUrn, "---");
    const convResult = await page.evaluate(async (csrf, urn) => {
      const res = await fetch(
        "https://www.linkedin.com/voyager/api/voyagerMessagingDashMessengerConversations?keyVersion=LEGACY_INBOX",
        { headers: { "csrf-token": csrf, "x-restli-protocol-version": "2.0.0", accept: "application/json" } }
      );
      const t = await res.text();
      try {
        const j = JSON.parse(t);
        const elements = j.elements || [];
        for (const el of elements) {
          const participants = el.participants || [];
          for (const p of participants) {
            if ((p["*miniProfile"] || "").includes(urn.replace("fsd_profile", "fs_miniProfile"))) {
              return { threadUrn: el.entityUrn, conv: el };
            }
          }
        }
        return { count: elements.length, first: elements[0] };
      } catch (e) { return { error: e.message, text: t.substring(0, 300) }; }
    }, csrf, targetUrn);
    console.log("Conv result:", convResult);

    // SEND MESSAGE
    console.log("\n--- SEND MESSAGE ---");
    const msgPayload = {
      message: {
        body: { text: "API from browser — " + new Date().toISOString(), attributes: [] },
        renderContentUnions: [],
        originToken: "live-test-" + Date.now(),
      },
      hostRecipientUrns: [targetUrn],
    };
    const sendResult = await page.evaluate(
      async (body, csrf) => {
        const res = await fetch(
          "https://www.linkedin.com/voyager/api/voyagerMessagingDashMessengerMessages?action=createMessage",
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "csrf-token": csrf,
              "x-restli-protocol-version": "2.0.0",
              accept: "application/json",
            },
            body: JSON.stringify(body),
          }
        );
        const t = await res.text();
        return { status: res.status, headers: Object.fromEntries(res.headers), text: t.substring(0, 1500) };
      },
      msgPayload,
      csrf
    );
    console.log("SEND status:", sendResult.status);
    console.log("SEND body:", sendResult.text);
    if (sendResult.status === 200 || sendResult.status === 201) {
      console.log("\n✅✅✅ MESSAGE SENT!");
    } else {
      console.log("\n❌ Send failed");
    }

    await page.waitForTimeout(20000);
    await context.close();
    await browser.close();
    process.exit(0);
  });

  await page.waitForTimeout(180000);
  console.log("Timeout.");
  await context.close();
  await browser.close();
  process.exit(0);
})().catch((e) => {
  console.error("FATAL:", e.message);
  process.exit(1);
});
