# LinkedIn Voyager Messaging API: Reverse Engineering Findings

**Date:** June 10, 2026  
**Account:** snehlata (snehlatasingh9012@gmail.com)  
**Status:** DOM automation is the only proven working method. Pure API from outside the UI is gated.

---

## Working Approach: DOM Automation

`testscripts/phase2_cookie_message.js` — sends messages via real browser UI clicks.

```
{"label":"snehlata","success":true,"profile":"https://www.linkedin.com/in/shiva-singh-genai-llm/",
 "message":"__phase2_dom_test__ 2026-06-10T13:09:26+05:30","status":"success"}
```

End-to-end: 6 steps, ~60s, opens profile → finds compose URL → opens messaging → types textbox → clicks send → 200 OK.

---

## Why Pure API Fails

**Endpoint (correct):** `POST https://www.linkedin.com/voyager/api/voyagerMessagingDashMessengerMessages?action=createMessage`

**Working payload structure (captured from real UI):**
```json
{
  "message": {
    "body": {"attributes": [], "text": "..."},
    "renderContentUnions": [],
    "conversationUrn": "urn:li:msg_conversation:(urn:li:fsd_profile:<selfMailboxUrn>,2-<base64(uuid_count)>=)",
    "originToken": "<UUID v4>"
  },
  "mailboxUrn": "urn:li:fsd_profile:<selfMailboxUrn>",
  "trackingId": "<11-byte latin1 random>",
  "dedupeByClientGeneratedToken": false
}
```

**Failure modes observed (all from a Playwright-driven Chrome with valid session):**
- `400 {"status":400}` — Rest.li schema validation failure, empty error body
- `403 {"code":"mailboxPreWriteValidate","status":403}` — anti-spam gate

**Likely cause:** LinkedIn's frontend does a series of preflight XHR calls (markAsRead, presenceStatuses, fetch conversation state) before the createMessage. The server's `mailboxPreWriteValidate` step checks the *recent activity* on the session — it expects to see a fresh read receipt, typing indicator, or presence heartbeat within the last few seconds. Calling createMessage in isolation from outside the UI flow bypasses these.

**Tried variations, all 400:**
- ✅ correct conversationUrn format
- ✅ correct mailboxUrn format (no vanity suffix, just bare fsd_profile)
- ✅ no hostRecipientUrns (it's not in the real payload)
- ✅ proper UUID originToken
- ✅ 11-byte latin1 trackingId (matching real format)
- ✅ called from inside the real browser context (page.evaluate)
- ✅ called from a freshly-captured session (not stale)

## Captured Real Network Calls (from manual UI use)
- `voyager/api/voyagerMessagingGraphQL/graphql?queryId=messengerConversations.0d5e6781...` — list threads
- `voyager/api/voyagerMessagingGraphQL/graphql?queryId=messengerConversations.9501074288...` — list with cursor
- `voyager/api/voyagerMessagingDashMessengerConversations?action=typing` — typing indicator
- `voyager/api/voyagerMessagingDashMessengerConversations?ids=...` — mark read
- `voyager/api/voyagerMessagingDashMessengerMessageDeliveryAcknowledgements?action=sendDeliveryAcknowledgement`
- `voyager/api/voyagerMessagingDashMessengerConversations?action=create` — new conversation (returns 400 in our tests)
- `voyager/api/voyagerMessagingDashMessengerMessages?action=createMessage` — actual send

## How Waalaxy Sends Messages
- They use a **server-side headful Chrome** (Otto service) that runs the real UI flow
- Their CRX extension just calls `chrome.cookies.get` to lift session cookies into the cloud Chrome
- The cloud Chrome does the actual DOM automation
- The same `mailboxPreWriteValidate` gate fires for them too — that's why they need a real browser

## Architecture Decision
**Production: use the DOM automation pattern from `phase2_cookie_message.js`**
- Cookie injection + Playwright + browser context
- 1st-degree connections only (no InMail/cold outreach)
- Sticky proxy at LAUNCH level (sticky-proxy invariant)
- Wait 12-18s between profile load and compose URL extraction (mimic human)
- 40-90ms keypress delay
- ~60s per message end-to-end

## Test Artifacts
- `voyager_approach/test_send_v3.js` — `mailboxPreWriteValidate` 403 reproduction
- `voyager_approach/test_send_v4.js` — exact format match, still 400
- `voyager_approach/test_send_v5.js` — extra headers, still 400
- `voyager_approach/test_api_fresh_session.js` — fresh session + browser context, still 400
- `voyager_approach/capture_real_ui.js` — captures exact working request from real UI
- `voyager_approach/sessions/live/real_ui_capture.json` — saved working payload
- `voyager_approach/DEVTOOLS_CAPTURE.md` — manual capture instructions
