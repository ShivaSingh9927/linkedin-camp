# How to Capture LinkedIn Voyager Network Calls

## Setup
1. Open **LinkedIn** in a fresh tab (signed in)
2. Open **DevTools** (F12) → **Network** tab
3. Click **Filter** and type: `voyager/api` (then clear the filter later)
4. **Preserve log**: check the checkbox "Preserve log" so requests don't clear

## Capture 1: Find a recipient URN
- Click **Messaging** icon (top bar)
- Wait for the thread list to load
- Look for the request that returns thread data — typically contains:
  - `messengerDash/conversations` or `messaging/dash/conversations`
  - Or `messengerDash/threads` / `messaging/threads`
- In the response preview, find:
  - A `*miniProfile` field → copy one URN (e.g. `urn:li:fs_miniProfile:ACoAA...`)
  - Convert it: `fs_miniProfile` → `fsd_profile` (just replace that substring)
  - That's our `hostRecipientUrn`

## Capture 2: Find the SEND endpoint
- Click into a thread
- Type a test message: `__voyager test from devtools__`
- Click **Send**
- Look for a POST to something like:
  - `voyager/api/.../messages?action=createMessage`
  - `voyager/api/.../messengerDash/messages`
  - `voyager/api/.../messaging/messages`
- Right-click the request → **Copy → Copy as cURL** (this is the cleanest way)
- Paste the cURL command in chat

## What we need (in priority order)

### 1. The send cURL (best — has everything)
- Right-click the createMessage POST → **Copy → Copy as cURL (bash)**
- Paste it in chat. We can extract URL, headers, body from it.

### OR manually copy:

### 2a. Request URL of the send call
- e.g. `https://www.linkedin.com/voyager/api/voyagerMessagingDashMessengerMessages?action=createMessage`

### 2b. Request payload (JSON)
The body sent — something like:
```json
{
  "message": {
    "body": { "text": "...", "attributes": [] },
    "renderContentUnions": [],
    "originToken": "..."
  },
  "hostRecipientUrns": ["urn:li:fsd_profile:..."]
}
```

### 2c. Request headers
Look for any of:
- `csrf-token`
- `x-restli-protocol-version`
- `x-li-page-instance`
- `x-li-track`
- `x-li-source`
- `x-li-lang`
- `x-li-uuid`

### 2d. Response status + body
- Was it 200/201 or 4xx?
- If 4xx, what's the error?

## Optional: pre-send requests
Click into a thread, scroll up, look for:
- `conversations/.../events` (thread load)
- `conversations/.../messages` (message history)
These confirm the URL namespace (messaging vs voyagerMessagingDash).

## If you don't have someone to message
You can also:
- Go to your own profile → Connections → pick a connection you have → **Message**
- This opens a new conversation thread (which is a write, not a read)
