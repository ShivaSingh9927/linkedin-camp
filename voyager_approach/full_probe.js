// Comprehensive Voyager API probe — target: shiva-singh-genai-llm
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
const TARGET = "shiva-singh-genai-llm";

const results = [];
function record(category, name, status, body, note) {
  const r = { category, name, status, body: body ? body.substring(0, 200) : "(empty)", note };
  results.push(r);
  const emoji = status >= 200 && status < 300 ? "✅" : status === 401 || status === 403 ? "🔒" : status === 404 ? "❌" : status === 410 ? "💀" : "⚠️";
  console.log(`${emoji} [${status}] ${category}/${name} ${note ? "— " + note : ""}`);
  if (status >= 400 && body && body.length < 100) console.log(`    body: ${body.substring(0, 100)}`);
}

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

  async function call(method, url, body) {
    try {
      return await page.evaluate(async ({ method, url, body, csrf }) => {
        const opts = {
          method,
          headers: {
            "csrf-token": csrf,
            "x-restli-protocol-version": "2.0.0",
            "accept": "application/json",
          },
        };
        if (body) {
          opts.headers["Content-Type"] = "application/json";
          opts.body = typeof body === "string" ? body : JSON.stringify(body);
        }
        const r = await fetch(url, opts);
        const text = await r.text();
        return { status: r.status, body: text };
      }, { method, url, body, csrf });
    } catch (e) {
      return { status: 0, body: e.message };
    }
  }

  // ===== SELF =====
  const meRes = await call("GET", "https://www.linkedin.com/voyager/api/me");
  const meJson = JSON.parse(meRes.body);
  const myVanity = meJson.miniProfile?.publicIdentifier;
  const myFsdUrn = meJson.miniProfile?.dashEntityUrn;
  record("SELF", "/me", meRes.status, meRes.body, `myVanity=${myVanity} myFsdUrn=${myFsdUrn}`);

  // ===== TARGET PROFILE (shiva-singh-genai-llm) =====
  console.log(`\n========== TARGET: ${TARGET} ==========\n`);

  const prof = await call("GET", `https://www.linkedin.com/voyager/api/identity/profiles/${TARGET}`);
  record("PROFILE", "identity/profiles/{vanity}", prof.status, prof.body);

  if (prof.status === 200) {
    const pj = JSON.parse(prof.body);
    const targetFsdUrn = pj.miniProfile?.dashEntityUrn || pj.entityUrn;
    const targetId = pj.objectUrn?.match(/urn:li:member:(\d+)/)?.[1];

    // ===== PROFILE DEEP =====
    const richSummary = await call("GET", `https://www.linkedin.com/voyager/api/identity/profiles/${TARGET}/richSummary`);
    record("PROFILE", "richSummary", richSummary.status, richSummary.body);

    const richProfile = await call("GET", `https://www.linkedin.com/voyager/api/identity/profiles/${TARGET}/richProfile`);
    record("PROFILE", "richProfile", richProfile.status, richProfile.body);

    const contactInfo = await call("GET", `https://www.linkedin.com/voyager/api/identity/profiles/${TARGET}/profile-contact-info`);
    record("PROFILE", "profile-contact-info", contactInfo.status, contactInfo.body);

    const memberConn = await call("GET", `https://www.linkedin.com/voyager/api/identity/profiles/${TARGET}/memberConnections?count=10`);
    record("PROFILE", "memberConnections", memberConn.status, memberConn.body);

    const netInfo = await call("GET", `https://www.linkedin.com/voyager/api/identity/profiles/${TARGET}/networkinfo`);
    record("PROFILE", "networkinfo", netInfo.status, netInfo.body);

    const topVoices = await call("GET", `https://www.linkedin.com/voyager/api/identity/profiles/${TARGET}/topVoices`);
    record("PROFILE", "topVoices", topVoices.status, topVoices.body);

    const similar = await call("GET", `https://www.linkedin.com/voyager/api/identity/profiles/${TARGET}/similarProfiles`);
    record("PROFILE", "similarProfiles", similar.status, similar.body);

    const updates = await call("GET", `https://www.linkedin.com/voyager/api/identity/profiles/${TARGET}/updates?count=5`);
    record("PROFILE", "updates", updates.status, updates.body);

    const posts = await call("GET", `https://www.linkedin.com/voyager/api/identity/profiles/${TARGET}/posts?count=5`);
    record("PROFILE", "posts", posts.status, posts.body);

    // ===== CONNECTIONS / RELATIONSHIPS =====
    console.log("\n========== CONNECTIONS ==========\n");
    const conns = await call("GET", `https://www.linkedin.com/voyager/api/relationships/connections?count=10`);
    record("CONNECTIONS", "relationships/connections", conns.status, conns.body);

    const invSummary = await call("GET", `https://www.linkedin.com/voyager/api/relationships/invitationsSummary`);
    record("CONNECTIONS", "invitationsSummary", invSummary.status, invSummary.body);

    const sentInv = await call("GET", `https://www.linkedin.com/voyager/api/relationships/sentInvitations?count=10`);
    record("CONNECTIONS", "sentInvitations", sentInv.status, sentInv.body);

    // ===== FEED =====
    console.log("\n========== FEED ==========\n");
    const feed = await call("GET", `https://www.linkedin.com/voyager/api/feed/updates?count=5`);
    record("FEED", "feed/updates", feed.status, feed.body);

    // ===== MESSAGES =====
    console.log("\n========== MESSAGES ==========\n");
    const msgBadge = await call("GET", `https://www.linkedin.com/voyager/api/voyagerMessagingDashMessagingBadge`);
    record("MESSAGES", "MessagingBadge", msgBadge.status, msgBadge.body);

    const convGraphQL = await call("GET", `https://www.linkedin.com/voyager/api/voyagerMessagingGraphQL/graphql?queryId=messengerConversations.0d5e6781bbee71c3e51c8843c6519f48&variables=(mailboxUrn:urn%3Ali%3Afsd_profile%3A${encodeURIComponent(myFsdUrn)})`);
    record("MESSAGES", "messengerConversations (GraphQL)", convGraphQL.status, convGraphQL.body);

    // ===== SEARCH =====
    console.log("\n========== SEARCH ==========\n");
    const search1 = await call("GET", `https://www.linkedin.com/voyager/api/search/dash/clusters?keywords=shiva%20singh%20genai&origin=GLOBAL_SEARCH_HEADER&q=people&count=10`);
    record("SEARCH", "search/dash/clusters", search1.status, search1.body);

    const search2 = await call("GET", `https://www.linkedin.com/voyager/api/search/blended?keywords=shiva+singh+genai&origin=GLOBAL_SEARCH_HEADER&count=10`);
    record("SEARCH", "search/blended", search2.status, search2.body);

    const searchGraphQL = await call("GET", `https://www.linkedin.com/voyager/api/voyagerSearchDashSearchHome?action=update`, { keywords: "shiva singh", searchId: "test-123" });
    record("SEARCH", "SearchHome?action=update (GraphQL)", searchGraphQL.status, searchGraphQL.body);

    // ===== JOBS =====
    console.log("\n========== JOBS ==========\n");
    const jobs1 = await call("GET", `https://www.linkedin.com/voyager/api/voyagerJobsDashJobDash?count=5`);
    record("JOBS", "JobDash", jobs1.status, jobs1.body);

    const jobSearch = await call("GET", `https://www.linkedin.com/voyager/api/jobs/jobPostings/123456789`);
    record("JOBS", "jobPostings/{id}", jobSearch.status, jobSearch.body);

    // ===== COMPANIES =====
    console.log("\n========== COMPANIES ==========\n");
    const comp1 = await call("GET", `https://www.linkedin.com/voyager/api/voyagerOrganizationDashOrganizations?q=meril&count=5`);
    record("COMPANIES", "Organizations", comp1.status, comp1.body);

    const compSearch = await call("GET", `https://www.linkedin.com/voyager/api/search/dash/clusters?keywords=meril&origin=GLOBAL_SEARCH_HEADER&q=companies&count=5`);
    record("COMPANIES", "search companies", compSearch.status, compSearch.body);

    // ===== ANALYTICS =====
    console.log("\n========== ANALYTICS ==========\n");
    const profViews = await call("GET", `https://www.linkedin.com/voyager/api/voyagerIdentityDashProfileViews`);
    record("ANALYTICS", "ProfileViews", profViews.status, profViews.body);

    const postAnalytics = await call("GET", `https://www.linkedin.com/voyager/api/voyagerFeedDashAnalytics`);
    record("ANALYTICS", "PostAnalytics", postAnalytics.status, postAnalytics.body);

    // ===== NOTIFICATIONS =====
    console.log("\n========== NOTIFICATIONS ==========\n");
    const notif = await call("GET", `https://www.linkedin.com/voyager/api/voyagerNotificationDashApi/notifications`);
    record("NOTIFICATIONS", "notifications", notif.status, notif.body);

    // ===== LEARNING =====
    const learning = await call("GET", `https://www.linkedin.com/voyager/api/voyagerLearningDashLearningHome`);
    record("LEARNING", "LearningHome", learning.status, learning.body);

    // ===== PREMIUM =====
    const premium = await call("GET", `https://www.linkedin.com/voyager/api/voyagerPremiumDashProducts`);
    record("PREMIUM", "Products", premium.status, premium.body);

    // ===== WRITES (known to fail) =====
    console.log("\n========== WRITES (known to fail) ==========\n");
    const invite = await call("POST", `https://www.linkedin.com/voyager/api/relationships/invitations?action=create`, { inviteeUrn: targetFsdUrn, message: "Test" });
    record("WRITE", "invitations?action=create", invite.status, invite.body);

    const likeRes = await call("POST", `https://www.linkedin.com/voyager/api/voyagerSocialDashReactions`, { reactionType: "LIKE", objectUrn: "urn:li:ugcPost:0_test" });
    record("WRITE", "socialDashReactions", likeRes.status, likeRes.body);

    const msgCreate = await call("POST", `https://www.linkedin.com/voyager/api/voyagerMessagingDashMessengerMessages?action=createMessage`, { message: { body: { attributes: [], text: "test" }, renderContentUnions: [], conversationUrn: "urn:li:msg_conversation:(urn:li:fsd_profile:" + myFsdUrn + ",2-test)", originToken: "test-token" }, mailboxUrn: myFsdUrn, trackingId: "CWoNkEmA6aM=", dedupeByClientGeneratedToken: false });
    record("WRITE", "createMessage (isolated)", msgCreate.status, msgCreate.body);
  }

  console.log("\n========== SUMMARY ==========\n");
  const summary = {};
  for (const r of results) {
    const s = r.status;
    summary[s] = (summary[s] || 0) + 1;
  }
  console.log("Status code distribution:", summary);
  console.log("Total endpoints tested:", results.length);
  console.log("\n--- 200 OK endpoints ---");
  results.filter(r => r.status === 200).forEach(r => console.log(`  ✅ ${r.category}/${r.name}`));
  console.log("\n--- Failed/interesting endpoints ---");
  results.filter(r => r.status !== 200).forEach(r => console.log(`  [${r.status}] ${r.category}/${r.name} ${r.note || ""}`));

  fs.writeFileSync(
    path.join(__dirname, "sessions", "live", "voyager_probe_results.json"),
    JSON.stringify(results, null, 2)
  );
  console.log("\nSaved to voyager_probe_results.json");

  await ctx.close();
  await browser.close();
})().catch((e) => { console.error("FATAL:", e.message, e.stack); process.exit(1); });
