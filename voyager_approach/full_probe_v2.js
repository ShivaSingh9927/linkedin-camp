// Full Voyager probe — uses correct GraphQL queryId pattern
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
const TARGET_VANITY = "shiva-singh-genai-llm";
const TARGET_FSD = "ACoAACdYnukB_Rgm7qVvte0xhLy9SZGEbuvKMd0";

const results = [];
function record(category, name, status, body, note) {
  const r = { category, name, status, body: body ? body.substring(0, 250) : "(empty)", note };
  results.push(r);
  const emoji = status >= 200 && status < 300 ? "✅" : status === 401 || status === 403 ? "🔒" : status === 404 ? "❌" : status === 410 ? "💀" : status === 400 ? "🚫" : "⚠️";
  console.log(`${emoji} [${status}] ${category}/${name}${note ? " — " + note : ""}`);
}

async function gql(call, base, queryId, variables) {
  // variables should be an object/array, will be stringified as LinkedIn format
  const variablesStr = encodeURIComponent(JSON.stringify(variables).replace(/"/g, ""));
  // LinkedIn uses comma-separated key:value pairs not actual JSON
  let vs = "";
  for (const [k, v] of Object.entries(variables)) {
    if (Array.isArray(v)) {
      vs += `,${k}:List(${v.map(x => `urn:li:fsd_profile:${x}`).join(",")})`;
    } else {
      vs += `,${k}:${v}`;
    }
  }
  vs = vs.replace(/^,/, ""); // strip leading comma
  const url = `${base}?includeWebMetadata=true&variables=(${vs})&queryId=${queryId}`;
  return call("GET", url);
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
          headers: { "csrf-token": csrf, "x-restli-protocol-version": "2.0.0", "accept": "application/json" },
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
  const myFsdUrn = meJson.miniProfile?.dashEntityUrn;
  const myVanity = meJson.miniProfile?.publicIdentifier;
  record("SELF", "/me", meRes.status, meRes.body, `fsd=${myFsdUrn} vanity=${myVanity}`);

  const meSettings = await call("GET", "https://www.linkedin.com/voyager/api/voyagerDashMySettings.7ea6de345b41dfb57b660a9a4bebe1b8");
  record("SELF", "MySettings", meSettings.status, meSettings.body);

  // ===== TARGET PROFILE (GraphQL - working pattern) =====
  console.log(`\n========== TARGET: ${TARGET_VANITY} ==========\n`);

  // 1. Profile by vanity (GraphQL)
  const profV = await call("GET", `https://www.linkedin.com/voyager/api/graphql?includeWebMetadata=true&variables=(memberIdentity:${TARGET_VANITY})&queryId=voyagerIdentityDashProfiles.b5c27c04968c409fc0ed3546575b9b7a`);
  record("PROFILE", "DashProfiles/memberIdentity(vanity)", profV.status, profV.body);

  // 2. Profile by member ID
  const profI = await call("GET", `https://www.linkedin.com/voyager/api/graphql?includeWebMetadata=true&variables=(memberIdentity:${TARGET_FSD})&queryId=voyagerIdentityDashProfiles.b5c27c04968c409fc0ed3546575b9b7a`);
  record("PROFILE", "DashProfiles/memberIdentity(id)", profI.status, profI.body);

  // 3. Profile with decoration (rich content)
  const profD = await call("GET", `https://www.linkedin.com/voyager/api/graphql?includeWebMetadata=true&variables=(memberIdentity:${TARGET_VANITY},decorationId:com.linkedin.voyager.dash.deco.identity.profile.core.TopCard-38)&queryId=voyagerIdentityDashProfiles.b5c27c04968c409fc0ed3546575b9b7a`);
  record("PROFILE", "DashProfiles+TopCard-decoration", profD.status, profD.body);

  // 4. Profile contact info
  const profC = await call("GET", `https://www.linkedin.com/voyager/api/graphql?includeWebMetadata=true&variables=(memberIdentity:${TARGET_VANITY},decorationId:com.linkedin.voyager.dash.deco.identity.profile.ProfileWithContactInfo-20)&queryId=voyagerIdentityDashProfiles.b5c27c04968c409fc0ed3546575b9b7a`);
  record("PROFILE", "DashProfiles+ContactInfo-decoration", profC.status, profC.body);

  // 5. Profile experience
  const profE = await call("GET", `https://www.linkedin.com/voyager/api/graphql?includeWebMetadata=true&variables=(memberIdentity:${TARGET_VANITY},decorationId:com.linkedin.voyager.dash.deco.identity.profile.Experience-21)&queryId=voyagerIdentityDashProfiles.b5c27c04968c409fc0ed3546575b9b7a`);
  record("PROFILE", "DashProfiles+Experience-decoration", profE.status, profE.body);

  // 6. Profile education
  const profEd = await call("GET", `https://www.linkedin.com/voyager/api/graphql?includeWebMetadata=true&variables=(memberIdentity:${TARGET_VANITY},decorationId:com.linkedin.voyager.dash.deco.identity.profile.Education-9)&queryId=voyagerIdentityDashProfiles.b5c27c04968c409fc0ed3546575b9b7a`);
  record("PROFILE", "DashProfiles+Education-decoration", profEd.status, profEd.body);

  // 7. MemberConnections (their connections)
  const profConn = await call("GET", `https://www.linkedin.com/voyager/api/graphql?includeWebMetadata=true&variables=(count:5,start:0,memberIdentity:${TARGET_VANITY})&queryId=voyagerIdentityDashProfileConnections.0b5f4dca2c5e3e2c4b97ee31fed7d934`);
  record("PROFILE", "DashProfileConnections", profConn.status, profConn.body);

  // 8. Profile network info (connection degree)
  const profN = await call("GET", `https://www.linkedin.com/voyager/api/identity/profiles/${TARGET_VANITY}/networkinfo`);
  record("PROFILE", "identity/profiles/networkinfo", profN.status, profN.body);

  // 9. Profile updates (their posts)
  const profU = await call("GET", `https://www.linkedin.com/voyager/api/identity/profiles/${TARGET_VANITY}/updates?count=5`);
  record("PROFILE", "identity/profiles/updates", profU.status, profU.body);

  // 10. Profile rich summary (REST)
  const profR = await call("GET", `https://www.linkedin.com/voyager/api/identity/profiles/${TARGET_VANITY}/richSummary`);
  record("PROFILE", "identity/profiles/richSummary", profR.status, profR.body);

  // ===== MY DATA =====
  console.log("\n========== MY DATA ==========\n");
  const myConn = await call("GET", `https://www.linkedin.com/voyager/api/relationships/connections?count=10`);
  record("CONNECTIONS", "relationships/connections", myConn.status, myConn.body);

  const sentInv = await call("GET", `https://www.linkedin.com/voyager/api/relationships/sentInvitations?count=10`);
  record("CONNECTIONS", "sentInvitations", sentInv.status, sentInv.body);

  const invSummary = await call("GET", `https://www.linkedin.com/voyager/api/relationships/invitationsSummary`);
  record("CONNECTIONS", "invitationsSummary", invSummary.status, invSummary.body);

  // ===== FEED =====
  console.log("\n========== FEED ==========\n");
  const feed = await call("GET", `https://www.linkedin.com/voyager/api/feed/updates?count=5`);
  record("FEED", "feed/updates", feed.status, feed.body);

  // ===== MESSAGES =====
  console.log("\n========== MESSAGES ==========\n");
  const msgBadge = await call("GET", `https://www.linkedin.com/voyager/api/voyagerMessagingDashMessagingBadge`);
  record("MESSAGES", "MessagingBadge", msgBadge.status, msgBadge.body);

  const convGraphQL = await call("GET", `https://www.linkedin.com/voyager/api/voyagerMessagingGraphQL/graphql?queryId=messengerConversations.0d5e6781bbee71c3e51c8843c6519f48&variables=(mailboxUrn:urn%3Ali%3Afsd_profile%3A${myFsdUrn})`);
  record("MESSAGES", "messengerConversations", convGraphQL.status, convGraphQL.body);

  // ===== SEARCH =====
  console.log("\n========== SEARCH ==========\n");
  const searchClusters = await call("GET", `https://www.linkedin.com/voyager/api/voyagerSearchDashClusters.843215f2a3455f1bed85762a45d71be8?includeWebMetadata=true&variables=(count:5,start:0,query:(keywords:shiva%20singh,flagshipSearchIntent:SINGLE_SEARCH),filters:List(resultType->PEOPLE))`);
  record("SEARCH", "DashClusters people search", searchClusters.status, searchClusters.body);

  const searchBlended = await call("GET", `https://www.linkedin.com/voyager/api/voyagerSearchDashSearchHome`);
  record("SEARCH", "SearchHome", searchBlended.status, searchBlended.body);

  // ===== JOBS =====
  console.log("\n========== JOBS ==========\n");
  const jobs = await call("GET", `https://www.linkedin.com/voyager/api/voyagerJobsDashJobDash?count=5`);
  record("JOBS", "JobDash", jobs.status, jobs.body);

  // ===== COMPANIES =====
  console.log("\n========== COMPANIES ==========\n");
  const comp1 = await call("GET", `https://www.linkedin.com/voyager/api/voyagerOrganizationDashCompanies.2fce873504d824e22294f312f718b4c7?includeWebMetadata=true&variables=(count:5,start:0)`);
  record("COMPANIES", "OrgCompanies", comp1.status, comp1.body);

  // ===== ANALYTICS =====
  console.log("\n========== ANALYTICS ==========\n");
  const profileViews = await call("GET", `https://www.linkedin.com/voyager/api/voyagerIdentityDashProfileViews`);
  record("ANALYTICS", "ProfileViews", profileViews.status, profileViews.body);

  // ===== NOTIFICATIONS =====
  console.log("\n========== NOTIFICATIONS ==========\n");
  const notifBadging = await call("GET", `https://www.linkedin.com/voyager/api/voyagerNotificationsDashBadgingItemCounts`);
  record("NOTIFICATIONS", "BadgingItemCounts", notifBadging.status, notifBadging.body);

  const notifCards = await call("GET", `https://www.linkedin.com/voyager/api/voyagerIdentityDashNotificationCards?decorationId=com.linkedin.voyager.dash.deco.identity.notifications.CardsCollectionWithInjectionsNoPills-24&count=10`);
  record("NOTIFICATIONS", "NotificationCards", notifCards.status, notifCards.body);

  // ===== LEARNING =====
  const learning = await call("GET", `https://www.linkedin.com/voyager/api/voyagerLearningDashLearningHome`);
  record("LEARNING", "LearningHome", learning.status, learning.body);

  // ===== PREMIUM =====
  const premium = await call("GET", `https://www.linkedin.com/voyager/api/voyagerPremiumDashProducts`);
  record("PREMIUM", "Products", premium.status, premium.body);

  const featureAccess = await call("GET", `https://www.linkedin.com/voyager/api/premium/featureAccess?name=reactivationFeaturesEligible`);
  record("PREMIUM", "featureAccess", featureAccess.status, featureAccess.body);

  // ===== WRITES (gated) =====
  console.log("\n========== WRITES (gated) ==========\n");
  const invite = await call("POST", `https://www.linkedin.com/voyager/api/relationships/invitations?action=create`, { inviteeUrn: `urn:li:fsd_profile:${TARGET_FSD}`, message: "Test" });
  record("WRITE", "invitations?action=create", invite.status, invite.body);

  const likeRes = await call("POST", `https://www.linkedin.com/voyager/api/voyagerSocialDashReactions`, { reactionType: "LIKE", objectUrn: "urn:li:ugcPost:0_test" });
  record("WRITE", "socialDashReactions", likeRes.status, likeRes.body);

  const msgCreate = await call("POST", `https://www.linkedin.com/voyager/api/voyagerMessagingDashMessengerMessages?action=createMessage`, { message: { body: { attributes: [], text: "test" }, renderContentUnions: [], conversationUrn: `urn:li:msg_conversation:(urn:li:fsd_profile:${myFsdUrn},2-test)`, originToken: "test-token" }, mailboxUrn: myFsdUrn, trackingId: "CWoNkEmA6aM=", dedupeByClientGeneratedToken: false });
  record("WRITE", "createMessage", msgCreate.status, msgCreate.body);

  const invCreate = await call("POST", `https://www.linkedin.com/voyager/api/voyagerMessagingDashMessengerConversations?action=create`, { mailboxUrn: myFsdUrn, hostRecipientUrns: [`urn:li:fsd_profile:${TARGET_FSD}`], originToken: "test", trackingId: "x" });
  record("WRITE", "createConversation", invCreate.status, invCreate.body);

  // ===== SUMMARY =====
  console.log("\n========== SUMMARY ==========\n");
  const summary = {};
  for (const r of results) {
    const s = r.status;
    summary[s] = (summary[s] || 0) + 1;
  }
  console.log("Status code distribution:", summary);
  console.log("Total: " + results.length);

  console.log("\n--- 200 OK (working) ---");
  results.filter(r => r.status === 200).forEach(r => console.log(`  ✅ ${r.category}/${r.name}`));

  console.log("\n--- Failed/gated ---");
  results.filter(r => r.status !== 200).forEach(r => console.log(`  [${r.status}] ${r.category}/${r.name} ${r.note || ""}`));

  fs.writeFileSync(
    path.join(__dirname, "sessions", "live", "voyager_probe_v2.json"),
    JSON.stringify(results, null, 2)
  );

  await ctx.close();
  await browser.close();
})().catch((e) => { console.error("FATAL:", e.message, e.stack); process.exit(1); });
