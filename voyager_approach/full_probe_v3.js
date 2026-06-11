// Full probe using EXACT URLs captured from real UI navigation
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
const SELF_FSD = "ACoAAGj45loB-nQmKeQasQoZJdn3YHCj5cYXRe0";

const results = [];
function record(category, name, status, body, note) {
  const r = { category, name, status, body: body ? body.substring(0, 200) : "(empty)", note };
  results.push(r);
  const emoji = status >= 200 && status < 300 ? "✅" : status === 401 || status === 403 ? "🔒" : status === 404 ? "❌" : status === 410 ? "💀" : status === 400 ? "🚫" : "⚠️";
  console.log(`${emoji} [${status}] ${category}/${name}${note ? " — " + note : ""}`);
  if (status === 200 && body && body.length < 150) console.log(`    ${body.substring(0, 150)}`);
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

  // ====== TARGET PROFILE (using real URL pattern) ======
  console.log(`\n========== TARGET: ${TARGET_VANITY} ==========\n`);

  // 1. FullProfile decoration (the real one the UI uses)
  const profFull = await call("GET", `https://www.linkedin.com/voyager/api/identity/dash/profiles/urn:li:fsd_profile:${TARGET_FSD}?decorationId=com.linkedin.voyager.dash.deco.identity.profile.FullProfile-76`);
  record("PROFILE", "FullProfile-76 (vanity+id)", profFull.status, profFull.body, "real UI URL");

  const profFull2 = await call("GET", `https://www.linkedin.com/voyager/api/identity/dash/profiles/urn:li:fsd_profile:${TARGET_FSD}?decorationId=com.linkedin.voyager.dash.deco.identity.profile.TopCard-38`);
  record("PROFILE", "TopCard-38", profFull2.status, profFull2.body);

  const profFull3 = await call("GET", `https://www.linkedin.com/voyager/api/identity/dash/profiles/urn:li:fsd_profile:${TARGET_FSD}?decorationId=com.linkedin.voyager.dash.deco.identity.profile.ProfileWithContactInfo-20`);
  record("PROFILE", "ProfileWithContactInfo-20", profFull3.status, profFull3.body);

  // ====== GRAPHQL PROFILE BY VANITY (works) ======
  const gProf = await call("GET", `https://www.linkedin.com/voyager/api/graphql?includeWebMetadata=true&variables=(memberIdentity:${TARGET_VANITY})&queryId=voyagerIdentityDashProfiles.b5c27c04968c409fc0ed3546575b9b7a`);
  record("PROFILE", "DashProfiles (vanity)", gProf.status, gProf.body, "GraphQL");

  const gProf2 = await call("GET", `https://www.linkedin.com/voyager/api/graphql?includeWebMetadata=true&variables=(memberIdentity:${TARGET_VANITY},decorationId:com.linkedin.voyager.dash.deco.identity.profile.core.TopCard-38)&queryId=voyagerIdentityDashProfiles.b5c27c04968c409fc0ed3546575b9b7a`);
  record("PROFILE", "DashProfiles+TopCard (vanity)", gProf2.status, gProf2.body);

  // ====== THEIR UPDATES / POSTS ======
  const gUpdates = await call("GET", `https://www.linkedin.com/voyager/api/graphql?includeWebMetadata=true&variables=(memberIdentity:${TARGET_VANITY},count:5)&queryId=voyagerIdentityDashProfileUpdates.5b87bc20a73b8e8b715aa19f683538`);
  record("PROFILE", "DashProfileUpdates", gUpdates.status, gUpdates.body);

  // ====== THEIR CONNECTIONS ======
  const gConn = await call("GET", `https://www.linkedin.com/voyager/api/graphql?includeWebMetadata=true&variables=(count:5,memberIdentity:${TARGET_VANITY})&queryId=voyagerIdentityDashProfileConnections.0b5f4dca2c5e3e2c4b97ee31fed7d934`);
  record("PROFILE", "DashProfileConnections", gConn.status, gConn.body);

  // ====== MY DATA ======
  console.log("\n========== MY DATA ==========\n");
  const me = await call("GET", "https://www.linkedin.com/voyager/api/me");
  record("SELF", "/me", me.status, me.body);

  const myConn = await call("GET", "https://www.linkedin.com/voyager/api/relationships/connections?count=10");
  record("CONNECTIONS", "relationships/connections", myConn.status, myConn.body);

  const connSummary = await call("GET", "https://www.linkedin.com/voyager/api/relationships/connectionsSummary");
  record("CONNECTIONS", "connectionsSummary", connSummary.status, connSummary.body);

  const invSum = await call("GET", "https://www.linkedin.com/voyager/api/relationships/invitationsSummary");
  record("CONNECTIONS", "invitationsSummary", invSum.status, invSum.body);

  const myNetworkNotif = await call("GET", "https://www.linkedin.com/voyager/api/relationships/myNetworkNotifications");
  record("CONNECTIONS", "myNetworkNotifications", myNetworkNotif.status, myNetworkNotif.body);

  const invViews = await call("GET", "https://www.linkedin.com/voyager/api/relationships/invitationViews?includeInsights=true&q=receivedInvitation&start=0&count=3");
  record("CONNECTIONS", "invitationViews", invViews.status, invViews.body);

  // ====== FEED ======
  console.log("\n========== FEED ==========\n");
  const gFeed = await call("GET", `https://www.linkedin.com/voyager/api/graphql?includeWebMetadata=true&variables=(count:5,start:0,feedType:MF)`);
  record("FEED", "Feed GraphQL", gFeed.status, gFeed.body);

  // ====== MESSAGES ======
  console.log("\n========== MESSAGES ==========\n");
  const msgBadge = await call("GET", "https://www.linkedin.com/voyager/api/voyagerMessagingDashMessagingBadge");
  record("MESSAGES", "MessagingBadge", msgBadge.status, msgBadge.body);

  const msgConv = await call("GET", `https://www.linkedin.com/voyager/api/voyagerMessagingDashMessengerConversations?ids=List(urn%3Ali%3Amsg_conversation%3A%28urn%3Ali%3Afsd_profile%3A${SELF_FSD}%2C2-OGRhYWFmM2ItNTYxYi00MDI3LTk2YWItMTg5NTE0NGFiYThmXzEwMA%3D%3D%29)`);
  record("MESSAGES", "MessengerConversations (read)", msgConv.status, msgConv.body);

  const msgMsgDelivery = await call("POST", `https://www.linkedin.com/voyager/api/voyagerMessagingDashMessengerMessageDeliveryAcknowledgements?action=sendDeliveryAcknowledgement`, { messageUrns: [], clientId: "voyager-web", deliveryMechanism: "SYNC", clientConsumedAt: Date.now() });
  record("MESSAGES", "DeliveryAcknowledgement (POST)", msgMsgDelivery.status, msgMsgDelivery.body);

  // ====== NOTIFICATIONS ======
  console.log("\n========== NOTIFICATIONS ==========\n");
  const notifCards = await call("GET", `https://www.linkedin.com/voyager/api/voyagerIdentityDashNotificationCards?decorationId=com.linkedin.voyager.dash.deco.identity.notifications.CardsCollectionWithInjectionsNoPills-24&count=10&q=filterVanityName`);
  record("NOTIFICATIONS", "NotificationCards", notifCards.status, notifCards.body);

  const notifBadge = await call("GET", "https://www.linkedin.com/voyager/api/voyagerNotificationsDashBadgingItemCounts");
  record("NOTIFICATIONS", "BadgingItemCounts", notifBadge.status, notifBadge.body);

  const notifMarkAll = await call("POST", "https://www.linkedin.com/voyager/api/voyagerNotificationsDashBadge?action=markAllItemsAsSeen", { until: Date.now() });
  record("NOTIFICATIONS", "markAllItemsAsSeen (POST)", notifMarkAll.status, notifMarkAll.body);

  // ====== SEARCH ======
  console.log("\n========== SEARCH ==========\n");
  const search1 = await call("GET", `https://www.linkedin.com/voyager/api/graphql?includeWebMetadata=true&variables=(count:5,start:0,query:(keywords:shiva%20singh,flagshipSearchIntent:SINGLE_SEARCH),filters:List(resultType->PEOPLE))&queryId=voyagerSearchDashClusters.843215f2a3455f1bed85762a45d71be8`);
  record("SEARCH", "DashClusters people search (GraphQL)", search1.status, search1.body);

  const search2 = await call("GET", `https://www.linkedin.com/voyager/api/graphql?includeWebMetadata=true&variables=(count:5,query:(keywords:meril,flagshipSearchIntent:SINGLE_SEARCH),filters:List(resultType->COMPANIES))&queryId=voyagerSearchDashClusters.843215f2a3455f1bed85762a45d71be8`);
  record("SEARCH", "DashClusters company search", search2.status, search2.body);

  // ====== JOBS ======
  console.log("\n========== JOBS ==========\n");
  const jobs = await call("GET", `https://www.linkedin.com/voyager/api/graphql?includeWebMetadata=true&variables=(count:5,start:0,q:jobSearch)`);
  record("JOBS", "GraphQL", jobs.status, jobs.body);

  // ====== COMPANIES ======
  console.log("\n========== COMPANIES ==========\n");
  const comp = await call("GET", `https://www.linkedin.com/voyager/api/voyagerOrganizationDashPageMailbox/?count=3&q=admin`);
  record("COMPANIES", "PageMailbox", comp.status, comp.body);

  // ====== ANALYTICS ======
  console.log("\n========== ANALYTICS ==========\n");
  const profViews = await call("GET", `https://www.linkedin.com/voyager/api/graphql?includeWebMetadata=true&variables=(count:5,start:0)&queryId=voyagerIdentityDashProfileViews.b2c4aef0c5e3e2c4b97ee31fed7d934`);
  record("ANALYTICS", "ProfileViews (GraphQL)", profViews.status, profViews.body);

  // ====== PREMIUM ======
  console.log("\n========== PREMIUM ==========\n");
  const featureAccess = await call("GET", "https://www.linkedin.com/voyager/api/premium/featureAccess?name=reactivationFeaturesEligible");
  record("PREMIUM", "featureAccess", featureAccess.status, featureAccess.body);

  const featureAccess2 = await call("GET", `https://www.linkedin.com/voyager/api/graphql?includeWebMetadata=true&variables=(featureAccessTypes:List(CAN_ACCESS_RECRUITER_MAILBOX,CAN_ACCESS_HIRING_MANAGER_MAILBOX))&queryId=voyagerPremiumDashFeatureAccess.c87b20dac35795f9920f2a8072fd7af5`);
  record("PREMIUM", "FeatureAccess (GraphQL)", featureAccess2.status, featureAccess2.body);

  // ====== WRITES (gated) ======
  console.log("\n========== WRITES (gated) ==========\n");
  const invite = await call("POST", `https://www.linkedin.com/voyager/api/relationships/invitations?action=create`, { inviteeUrn: `urn:li:fsd_profile:${TARGET_FSD}`, message: "Test" });
  record("WRITE", "invitations?action=create", invite.status, invite.body);

  const likeRes = await call("POST", `https://www.linkedin.com/voyager/api/voyagerSocialDashReactions`, { reactionType: "LIKE", objectUrn: "urn:li:ugcPost:0_test" });
  record("WRITE", "socialDashReactions", likeRes.status, likeRes.body);

  const msgCreate = await call("POST", `https://www.linkedin.com/voyager/api/voyagerMessagingDashMessengerMessages?action=createMessage`, { message: { body: { attributes: [], text: "test" }, renderContentUnions: [], conversationUrn: `urn:li:msg_conversation:(urn:li:fsd_profile:${SELF_FSD},2-test)`, originToken: "test-token" }, mailboxUrn: `urn:li:fsd_profile:${SELF_FSD}`, trackingId: "CWoNkEmA6aM=", dedupeByClientGeneratedToken: false });
  record("WRITE", "createMessage", msgCreate.status, msgCreate.body);

  const invCreate = await call("POST", `https://www.linkedin.com/voyager/api/voyagerMessagingDashMessengerConversations?action=create`, { mailboxUrn: `urn:li:fsd_profile:${SELF_FSD}`, hostRecipientUrns: [`urn:li:fsd_profile:${TARGET_FSD}`], originToken: "test", trackingId: "x" });
  record("WRITE", "createConversation", invCreate.status, invCreate.body);

  // ====== SUMMARY ======
  console.log("\n========== SUMMARY ==========\n");
  const summary = {};
  for (const r of results) {
    summary[r.status] = (summary[r.status] || 0) + 1;
  }
  console.log("Status distribution:", summary);
  console.log("Total: " + results.length);

  console.log("\n--- 200 OK WORKING ---");
  results.filter(r => r.status === 200).forEach(r => console.log(`  ✅ ${r.category}/${r.name}`));

  console.log("\n--- FAILED ---");
  results.filter(r => r.status !== 200).forEach(r => console.log(`  [${r.status}] ${r.category}/${r.name}`));

  fs.writeFileSync(
    path.join(__dirname, "sessions", "live", "voyager_probe_v3.json"),
    JSON.stringify(results, null, 2)
  );
  await ctx.close(); await browser.close();
})().catch((e) => { console.error("FATAL:", e.message, e.stack); process.exit(1); });
