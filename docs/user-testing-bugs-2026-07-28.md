# Qampi — Bugs found during user testing (2026-07-28)

Testers: shivasingh9927, snehlatasingh9012, shuttleraman011 (Akash),
pranavtiwari (Pranav), salonisingh70177 (Saloni), rajaji98971.
4 of 5 ran campaigns successfully; the issues below surfaced along the way.

Legend: ✅ fixed · 🔧 open · 🧩 infra/design gap · 🔎 needs verification

**Status 2026-07-30:** #1, #4, #5 fixed (code complete, awaiting deploy — one
build ships all three). #3 root-caused precisely, deferred by request. #11, #12
found while fixing #1. Everything else is untouched since the testing session.

---

## P0 — breaks core functionality

### 1. ✅ "Connected?" gate silently drops messages to real 1st-degree connections
**FIXED 2026-07-29 — code complete, NOT yet deployed.**

The follow-up flow (`Visit → Wait → Check Connection → Connected? → Message`)
skipped the message even when the lead IS connected.
Evidence (Akash's run):
```
[CHECK-CONNECTION] Connection status: connected, degree: 1   ← connected
[IF-ELSE] No nodes to execute for branch: false              ← took FALSE branch → message skipped
```

**Actual root cause** (not a propagation race — a hard wiring bug plus a
swallowed error):
1. `if-else.ts` read `storedOutputs['profile-visit']?.connected || false` and
   **nothing else**. `check-connection`'s output was never consulted, despite
   running seconds earlier. Every template gate uses
   `{source:'connectionState', field:'connected', operator:'is_true'}`, so this
   was the path every campaign took.
2. In the `warmDM` shape there is a `WAIT 1d` between PROFILE_VISIT and
   CHECK_CONNECTION, so the gate decided on a value rehydrated from
   `CampaignLead.personalization.nodeOutputs` — up to a day stale.
3. `isFirstDegree()` returned `false` on `!r.ok`, and
   `profile-visit-voyager` wrapped it in `.catch(() => false)`. Any transient
   Voyager failure became a confident "not connected". This is the
   intermittency: rajaji's run got a clean read, Akash's didn't.
4. `probeOnNull` was dead code — it fires only when the value is `null`, but
   the value was always `false`.
5. `ctx.connectionStatus` was declared on NodeContext but never populated, so
   any condition on `connectionStatus` silently read `'not_connected'`.

**Fix:** freshest-source-first resolution in `if-else.ts`
(`check-connection` → Lead row → `profile-visit`), `null` preserved end-to-end
as "unknown" (new `checkFirstDegree()` returning `boolean | null`),
`ctx.connectionStatus` seeded + propagated, and a declined gate now records
`connection_not_confirmed` vs `connection_unknown` on the lead's terminal
reason + CSV export. **No retries added** — per product decision an unknown
state skips terminally, it just does so visibly.

Verify: `cd apps/backend && npx ts-node --transpile-only src/scripts/verify-connection-gate.ts`
(9 cases, runs old vs new logic side by side; 4 cases the old gate silently
skipped now send, none flip the other way).

Also fixed in the same pass: `check-connection` was hardwired to the DOM
handler, bypassing the API-first dispatcher that `profile-visit`/`inbox-sync`
use — so every DM template did a full Chromium profile navigation for a read
Voyager answers in ~300ms. Now dispatches to Voyager by default and is
browser-free; `CONNECTION_CHECK_BACKEND=dom` reverts. Note prod logs now print
`[CHECK-CONNECTION-VOYAGER]` instead of `[CHECK-CONNECTION]`.

### 2. 🔧 App-notification 2FA ("Check your LinkedIn app") not handled
Login automation only handles the email/SMS **code** checkpoint. When LinkedIn
shows the "Check your LinkedIn app — tap Yes" screen, the flow classifies it as
`kind=unknown` → `login_error` and bails. Users with app-based 2FA (a common
default) can't connect. (Pranav eventually got in only by tapping Yes fast.)
Fix: detect that screen and auto-click "I don't have access to this device" to
fall back to the code path Qampi already supports (or poll while user approves).

### 3. 🔧 Team page returns 500 (Prisma relation names)
```
prisma:error  Error fetching team: PrismaClientValidationError
```
Recurring live 500 — opening the Team page errors every time.
**Confirmed 2026-07-29:** not subtle casing drift — the relations named in the
controller **do not exist**. Schema has `Team.TeamMember` / `Team.TeamInvite`,
`TeamMember.User`, `User.TeamMember`; the controller asks for `members`,
`invites`, `user`, `team`, `teamMembers` at `team.controller.ts` lines
16, 18, 113, 121, 123, 159, 162, 170, 175, 212, 220, 239, 270.
These are 15 of the 29 standing `tsc --noEmit` errors, so tsc finds them all.
Fix: rename to the real accessors, keeping the JSON response shape the frontend
expects. `admin.controller.ts` has 3 more of the same class.

---

## P1 — session / re-login lifecycle

### 4. ✅ No auto-resume after successful re-login
**FIXED 2026-07-30 — code complete, NOT yet deployed.**

A campaign that auto-paused with `session_expired` stayed PAUSED after the user
logged back in. User had to manually Resume. (Saloni.)

**Root cause:** `markAccountHealthy` was always correct — it un-parks the
365-day-deferred leads AND auto-resumes campaigns tagged
`pausedReason='session_expired'`. It just had exactly **one** caller
(`login-with-otp.service.ts:300`), so only the `/session/refresh` route
recovered. The **cold login** path and `session-validator`'s success paths set
`sessionInvalid: false` but left `accountHealth` at `NEEDS_LOGIN`, so the
engine's pre-flight gate kept refusing to launch.

**Fix:**
- `markAccountHealthy` now called on **both** session-manager success routes —
  the inline credential login and `handleSuccess()` (already-logged-in / 2FA /
  app-approval). Placed *after* the session blobs are written, since resuming a
  campaign can have a worker pick it up immediately.
- `session-validator` heals a **stale** flag when a session proves itself live,
  via `healStaleAccountHealth()`. Deliberately narrow: only `SESSION_EXPIRED`
  and `NEEDS_LOGIN` (states a working session directly disproves).
  `OTP_REQUIRED` / `RESTRICTED` are left alone — auto-resuming a challenged
  account is how "OTP please" escalates into a real restriction. Returns before
  any query when already HEALTHY, so the hourly sweep costs nothing.

**Also fixed (found while doing the above):** `markAccountHealthy`'s auto-resume
did a blanket `updateMany` PAUSED→ACTIVE, which could leave a user with **two
ACTIVE campaigns** — the user can start a new campaign while the old one sits
paused, and the queue model allows only one active. Now the first campaign
claims the ACTIVE slot only if it's free; the rest go to the tail of the QUEUED
list and get promoted normally. The resume notification and `CAMPAIGN_RESUMED`
socket event now distinguish resumed from queued instead of claiming a queued
campaign "has resumed". This flaw predated the fix but was only reachable
through the one OTP caller — wiring up two more callers would have widened it.

Verify: `cd apps/backend && npx ts-node --transpile-only src/scripts/verify-account-recovery.ts`
(14 static assertions: call sites, the narrow heal rule, write-before-resume
ordering, the queue invariant, and that the de-park is still present).

### 5. ✅ Leads reported Failed on NEEDS_LOGIN + campaign re-run loop
**FIXED 2026-07-30, deployed 2026-07-30, both halves verified in prod 2026-08-05.**
```
[ENGINE] accountHealth=NEEDS_LOGIN — refusing to launch
Stats -> Succeeded: 0, Failed: 2   (repeats every cycle)
```

Two separate problems, neither what the original report assumed.

**(a) The log lied.** The engine always deferred correctly (`engine.ts` →
`transitionLead(..., 'DEFERRED')`, +365d park) — the DB state was right. But the
`paused` branch in `runCampaign` did `summary.failed++`, so parked leads were
counted as failures. Fixed: `CampaignSummary` gains a `parked` counter, parked
leads print `⏸` with their `pausedReason` instead of `❌`, and the worker's stats
line now reads `Succeeded: X, Failed: Y, Parked: Z`. `failed` now means only
genuine failures.

**(b) The re-run loop was a symptom of #4.** The 1-minute heartbeat filters on
`sessionInvalid` but never checked `accountHealth`. Those two can disagree — and
bug #4 was precisely what made them disagree: a re-login cleared
`sessionInvalid` but left `accountHealth` at `NEEDS_LOGIN`, so the scheduler kept
queuing work the engine kept refusing, 1440x/day. Fixing #4 closed that case.

The residual gap: `OTP_REQUIRED` / `RESTRICTED` are deliberately never
auto-healed (see #4), so they can still diverge. Fixed at the right layer — the
scheduler now skips non-HEALTHY owners **before** a job is enqueued, a lock
taken, or a session loaded. Applied to *both* paths: the 1-minute campaign
heartbeat and the 5-minute delayed-leads resume sweep. The engine's pre-flight
gate is now a backstop rather than the only defence.

Verify: `cd apps/backend && npx ts-node --transpile-only src/scripts/verify-account-recovery.ts`
(21 assertions, covering #4 and #5).

**Prod verification of the scheduler gate (2026-08-05).** The `parked` counter and
the un-gate (recovery after re-login) were confirmed earlier; the *gate* itself
needed an unhealthy account, which no natural test produced. Done as a controlled
experiment — an ACTIVE campaign with a lead ready **now**, so a quiet scheduler
could not be mistaken for a working gate, and only `accountHealth` was varied:

```
15:54:00  Found 1 users with ACTIVE campaigns.
15:54:00  User cmpposqs... accountHealth=OTP_REQUIRED. Skipping (needs user action).
15:55:00  User cmpposqs... accountHealth=OTP_REQUIRED. Skipping (needs user action).
          -> queue wait/delayed/paused = 0/0/0, CampaignLeadProgress rows = 0
15:55:17  accountHealth reverted to HEALTHY
15:56:00  Received job: task_cl-step4-... -> Starting Campaign -> Succeeded: 1
```

Same campaign, same ready lead; the only variable was the health field. DB-only
setup, and the campaign was profile-visit-only so even the control run was a read.

### 6. ✅ OTP submit fails in mobile in-app browsers
- "Submit code" shows **Network Error** in in-app browsers (WhatsApp/LinkedIn
  webview); the code never reaches the relay (`no otp-relay enqueued`). *(open)*
- No retry-on-network-failure, and no "open in a real browser" hint. *(open)*
- ✅ **Users restart the login repeatedly → multiple concurrent attempts, each
  with its own LinkedIn code → codes crossed/expired.** FIXED 2026-08-08.
  `POST /session/refresh` spawned a fresh headless login on **every** call with
  no in-flight check, so N retries meant N simultaneous logins for one account.
  This is also what degraded the account itself (Saloni: valid → NEEDS_LOGIN from
  the retry storm), since LinkedIn penalises rapid repeat logins.

  `claimRefreshSlot` / `releaseRefreshSlot` now allow **one attempt per account**.
  A retry **re-attaches** to the in-flight attempt (returns its `requestId`)
  rather than erroring — so the natural user behaviour becomes harmless instead
  of destructive, and the code they type still reaches the worker awaiting it.

  Redis-backed, not an in-process Map, so it survives an API restart and holds if
  the API is scaled past one container. 240s TTL is the safety valve (a process
  death frees the slot rather than locking the account out); release is a Lua
  compare-and-delete so a slow finisher can't free a slot already re-claimed
  after the TTL, and runs in `.finally()` so a genuinely failed login can be
  retried at once.

  Verified against prod Redis with a fake user id: claim → concurrent claim
  refused → re-attach returns the original id → TTL 240s → wrong owner cannot
  release (0) → true owner releases (1) → next attempt claims.

- ✅ **No retry on network failure / no "open in a real browser" hint.**
  FIXED 2026-08-08 (frontend only, `lib/net.ts` + `OtpRecoveryModal`).
  `withNetworkRetry` retries 3x with backoff but **only on transport failures** —
  axios sets `response` whenever the server answered, so its absence is the
  signal. Retrying HTTP errors would be actively harmful: LinkedIn allows ~3 OTP
  attempts and silently resubmitting a rejected code burns them.
  `describeError` now names the browser and the way out instead of showing a bare
  "Network Error", and an advisory banner with a copy-link button appears
  *before* the password field rather than after the submit fails.
  Verify (apps/web has no test runner, so it runs standalone):
  `cd apps/web && npx --yes ts-node --skip-project --compiler-options '{"module":"commonjs","target":"es2019","esModuleInterop":true}' src/lib/net.verify.ts`
  — 21 assertions, incl. "a 400 is never retried" and "real Safari/Chrome are not
  misflagged as webviews".

**#6 is now closed.** The webview itself can still drop a request; it just no
longer ends the recovery, mislead the user, or damage the account.

### 7. 🔧 Possible: corrupted credentials typed into LinkedIn login
Pranav's early attempts submitted a mangled email
(`pranavtiwari.06@g26mail.prancavotmiwari.2606@gmail.com`) → "Wrong email or
password". Likely the email/password field isn't cleared before "human-like
typing," so it interleaves with a pre-filled/autofilled value. (Could also be
user typo — needs confirming.) Fix: clear fields before typing.

---

## P2 — non-fatal / cosmetic

### 8. 🔧 Welcome & success emails failing (SMTP not configured)
```
[MAIL] Error sending welcome/success email: Missing credentials for "LOGIN"
```
Non-fatal (fire-and-forget) but new users get no welcome email and LinkedIn
connects send no confirmation. Fix: configure SMTP creds on the box.

### 9. 🔧 Single-step enrichment leaves CampaignLead.status = PENDING
`isCompleted` flips true (campaign completes correctly), but the `status` enum
stays `PENDING` because `LeadStatus` has no terminal value and the enrichment
path never advances it. Cosmetic for the scheduler (it gates on `isCompleted`),
but wrong for funnel/analytics. Also the `isCompleted` write is a swallowed
fire-and-forget (`.catch(()=>{})`) — a latent re-visit-loop risk if it's ever
lost. Fix: add a terminal `LeadStatus`, set it, and make the write authoritative.

---

## Infra / design (not code bugs, but caused most of the test pain)

### 10. 🧩 All users share one proxy IP → LinkedIn challenge storm
Every fresh LinkedIn login routed through the single `DEFAULT_PROXY`
(82.41.252.111). Multiple different accounts logging in from one IP in a short
window made LinkedIn challenge/OTP/error nearly everyone (Saloni, Pranav).
Fix: per-user dedicated ISP proxy assignment (already the stated architecture
rule — just not wired for these accounts). Highest-leverage scaling fix.

---

## Found later (not from user testing)

### 11. ✅ CONNECT acted on the wrong page — invites never sent
**FIXED + VERIFIED IN PROD 2026-08-07.** Found 2026-07-29 while fixing #1.

`connect.ts` was the only write node that never called `page.goto`. It ran
`detectConnectionState(page, lead.linkedinUrl)` — whose own header says it
"assumes already navigated to" — against whatever page happened to be open. With
profile-visit on the Voyager backend there is no profile page open, so the engine
lazy-launches a browser for CONNECT, warmup navigates to `/feed/`, and the whole
node then operates on the feed.

**The ActionLog reframed the severity.** The original worry was invites going to
strangers off the feed's "People you may know" sidebar. What actually happened:

| result | count | error |
|---|---|---|
| FAILED | 13 | `Connect button not found on profile` |
| SUCCESS | 2 | — both **2026-05-28**, before the Voyager switch |

So no wrong-person invite ever fired — the unbound selector found nothing on the
feed and the node failed safely. The real impact was that **connect never worked
at all**, i.e. `coldInvite` was broken end to end. The wrong-person risk was
latent but genuine: `page.locator('[aria-label*="to connect"]').first()` is bound
to nobody and searches the whole page, one markup change away from firing. Note
`detectConnectionState` already binds *its* lookup to the lead's vanity slug —
with the comment "so we never pick up the connect link for a People you may know
card" — and connect discarded that guarantee one line later.

Fixes:
- navigate to `lead.linkedinUrl` first, like every other write node
- verify we landed on that lead before touching a button, so a redirect
  (checkpoint, login wall, deleted profile) can't become a click
- bind the Connect selector to the lead's slug; scope the aria-label and
  More-menu fallbacks to `<main>` / the open dropdown ("People also viewed"
  renders in `<aside>`)
- `state.isUnknown` used to fall through to the blind click; it now fails. A
  missed invite is recoverable, a wrong one isn't.

The landed-page check compares **parsed slugs for equality**, not
`url.includes(slug)` — LinkedIn slugs are routinely one another's prefixes
(name + digits), so `includes()` accepts `/in/john-smith-123` for a lead whose
slug is `john-smith`. Verify:
`npx ts-node --transpile-only src/scripts/verify-connect-targeting.ts`
(22 assertions incl. that impostor case, feed/checkpoint/login-wall refusals,
sub-pages, percent-encoded slugs).

**Prod verification (2026-08-07).** Ran a connect-only campaign against a
confirmed 1st-degree lead, so the node must early-return above the button lookup
and send nothing:

```
10:22:01  [ENGINE] Lazy-launched browser for Akash (first DOM node reached).
10:22:20  [CONNECT] Navigating to Akash's profile...        <- new; the fix
10:22:26  [CONNECT] Checking connection status for Akash...
10:22:26  [CONNECT] Already DMable (1st-degree or Open Profile).
```

Output `status: "already_connected"` (not `sent`), ActionLog `connect | SUCCESS`
— the first non-failure since 2026-05-28. Lead row unchanged at `CONNECTED/1`.
The same lead has `Connect button not found on profile` failures on record under
the old code, so this is a clean before/after.

**Still untested: the actual send path.** All of rajaji's leads are 1st-degree,
so nothing available exercises "invite reaches the right person". That requires
sending a real invitation to a real human and a deliberate choice of target.

### 12. ✅ profile-visit boots Chromium for what is now an API read
**FIXED 2026-08-05.** `profile-visit-voyager` got its data from Voyager but
hard-failed on `if (!page)` and threaded `page` into every call, so it always
launched Chromium. Measured on prod: **24s** with the browser (`15:27:02`
lazy-launch → `15:27:26` done) for what is three HTTP reads.

Nothing new was needed — `ctx.apiRequest` was already in `NodeContext`, the
engine already built it via `getBrowserlessVoyagerContext`, `voyagerFetch`
already accepted it, and `check-connection-voyager` already used the pattern.
Threaded it through `resolveVanityToFsd` / `getProfileByFsd` /
`getProfilePositions` / `getProfileEducations` / `checkFirstDegree`, and now
require a page only for the two genuinely-DOM sections (contact-info modal,
activity-feed scrape).

**Second half — the duplicate feed scrape.** `enrichPosts` was wasted work
whenever a comment or like node followed: those nodes navigate
`/recent-activity/shares/` and extract the URN from the DOM themselves (they read
profile-visit's output *only* for AI context — headline/company/about — never for
the post). So two Chromium navigations to the same feed, and that scrape was the
**only** thing forcing a browser in the common flow. `postsCoveredLater()` now
suppresses it when a later node covers the feed.

The data isn't lost: comment/like persist what they discover to
`Lead.latestPost/latestPostUrl` via `persistDiscoveredPost`, preferring the
login-free public-post JSON-LD over DOM innerText. Without that the "Recent post"
panel would have quietly emptied.

The browser decision is made **twice** — engine (launch) and node (scrape) — so
both route through `profileVisitNeedsDom` / `effectiveEnrichPosts` in
`read-backend.ts`. Drift means either an unused Chromium or a scrape against a
null page. Verify:
`npx ts-node --transpile-only src/scripts/verify-browser-free-profile-visit.ts`
(28 assertions over the full matrix, asserting both failure directions).

**Deliberately not done:** reusing profile-visit's stored URN so comment can skip
its discovery nav. `storedOutputs` is DB-backed and survives multi-day delay
nodes, so a stale URN would make `n=1` comment on a post that is no longer the
latest — a correctness regression traded for one page load in a session that
already has Chromium up.

### 13. ✅ "Signal Active" shown over a dead session
Reported 2026-08-05. `/auth/linkedin-status` (the endpoint behind the top-bar
pill and `ActivationHero`) answered purely from DB flags: cookie exists,
`!sessionInvalid`, `accountHealth === 'HEALTHY'`. Nothing rewrites those flags
until a campaign happens to run, so between LinkedIn killing a session and the
next run the UI reported a healthy connection — observed with `li_at` literally
set to `delete me`.

The browser-free confirmation already existed (`sessionValidator.liveCheck`:
Voyager `/me` + flag self-heal) but was wired only to the campaign worker. The
old "checking validity on every poll is session suicide" comment on this handler
was about `LinkedInService.isSessionValid`, which launches Chromium — a concern
that doesn't apply to a single HTTP read.

Fixed by adding `liveCheckCached` and routing `/auth/linkedin-status` +
`/session/session-status` through it. Freshness comes from DB
`sessionValidatedAt` (shared with the worker, survives restarts) **plus** an
in-process guard on *attempts* — a transient proxy failure deliberately doesn't
stamp `sessionValidatedAt`, so without the second guard a 30s UI poll becomes a
30s `/me` retry loop for as long as the proxy is sick. In-flight dedupe collapses
multiple tabs. Net: ≤1 browser-free `/me` per user per 15 min, and the probe logs
itself so a throttle regression is visible.

### 14. ✅ profile-visit campaign showed almost no collected data
Reported 2026-08-05. Not a display-layer bug — the data genuinely wasn't being
fetched. **FullProfile-76 carries no experience or education at all** (its
`included[]` holds only Geo + Industry entities, verified against a live
profile), so `getProfileByFsd` hardcoded `experience: []` / `education: []` and
the Career & education panel was permanently empty on API-enriched leads.

They come from `identity/dash/profilePositions` and `profileEducations`. Two
traps: passing a `decorationId` makes both return **HTTP 400**, and the older
`identity/profiles/{vanity}/positions` routes are retired (**HTTP 410**). Called
sequentially, not in `Promise.all` — `voyagerFetch`'s per-user 1500ms read gap is
a read-then-write on a Redis key, so concurrent calls both see the stale
timestamp and fire together, defeating the pacing.

Three more gaps fixed at the same time:
- **company/jobTitle** came from a headline regex that took the first ` at `/`@`
  it saw. For the test lead that produced
  `jobTitle="intern @1DS | Computer Science Student"`, `company=null`; the
  position row says `Business Analyst` at `1DigitalStack`. Position now wins,
  regex is the fallback.
- **location** was always blank: the old chain read `data.locationUnion`, which
  FullProfile-76 never returns. Real value is a Geo entity in `included[]` via
  `geoLocation["*geo"]`, plus its country ref → "Greater Delhi Area, India".
- **latestPost/latestPostUrl** were captured and stored but dropped by the
  campaign leads endpoint, so the Leads tab drawer showed nothing even when the
  scrape had them. Now returned and rendered in the shared drawer.

### 15. ✅ ROOT CAUSE of the recurring "session expired" — Qampi was killing it
**FIXED 2026-08-08.** The mystery of sessions dying every day or two.

`withdraw.worker.ts` (the 2am auto-withdraw cron) built its own Chromium launch
and read `(user as any).proxy` behind a `@ts-ignore`. That value is **always
undefined** — `findUnique` loads no relations, and the relation is named `Proxy`
anyway — so the `if` never fired and the browser launched with **no proxy at
all**. It then injected the user's real session cookies and browsed LinkedIn.

| path | egress LinkedIn sees |
|---|---|
| login, campaigns, inbox sync | `82.41.252.111` (pinned dedicated ISP) |
| this job | **`204.168.167.198`** (Hetzner box) |

Plus a **random user agent** (`getRandomUserAgent()`, 4-way pool) instead of the
pinned `linkedinFingerprint` — so OS and browser changed nightly too. Running for
every user with a cookie, with no `sessionInvalid` / `accountHealth` filter.

**Confirmed prospectively**, not just by inspection:
```
Aug 7 10:20   re-synced                                    -> HEALTHY
Aug 7 10:23   connect test ran fine                        -> session working
Aug 8 02:00:11 [Withdraw Sync] Navigating to sent invitations...   (unproxied)
Aug 8 04:00   [INBOX-WORKER] Redirected to: linkedin.com/uas/login
Aug 8 05:18   -> SESSION_EXPIRED
```
Notification history shows the same 04:0x signature back to 2026-07-27.

**It never worked either.** 11/11 runs on 08-08 logged "No sent invitations found
or layout changed" and withdrew nothing — the unproxied browser was being served
an authwall, and that benign-sounding message is what hid this for weeks. The job
now distinguishes an authwall from an empty list.

**Ruled out first:** proxy rotation. 551 samples over 18h, all `82.41.252.111`.
The dedicated ISP proxy is stable, as expected.

Fixes: withdraw.worker routed through `launchAuthenticatedContext`; the 2am cron
disabled behind `ENABLE_AUTO_WITHDRAW` and given the health/presence gates the
4am sweep already had.

**CONFIRMED FIXED — overnight test, 2026-08-09.** First night with the 2am job
disabled. Session logged in 08-08 06:24 and was still live 08-09 05:33 — **~23h**,
against dying within 17h on every previous night.

```
withdraw job runs overnight:  0          (was: 11 users driven unproxied)
04:00 inbox sync:             Found 5 threads. Inbox sync complete.
                                         (was: Redirected to /uas/login)
session-expired notifications: 0         (was: one every night since 07-27)
sessionValidatedAt:           05:33:35   fresh browser-free /me, 200 + identity
```

Verified two independent ways: a full messenger sync through the session at
04:00, and a Voyager `/me` probe at 05:33. Not a stale flag.

**Full audit of every runtime path that can carry a session** found two more:
- `session-validator.service.ts` set the proxy on `contextOptions` **only** —
  which `session-launch.ts` explicitly warns is insufficient (Chrome's background
  requests escape a context proxy on Linux) — and used `getOrAssignProxy` (the
  *current* assignment) rather than the snapshot the cookies were captured
  behind. Identical today with one proxy; diverges the moment a second is added,
  and would then mark healthy accounts dead.
- `linkedin.worker.ts` injects cookies and launched with no proxy. Dormant (the
  legacy `linkedin-actions` queue has had 0 jobs ever), but a loaded gun. Now
  pins the snapshot; strong deletion candidate.

Clean and unchanged: `session-launch.ts` (canonical), `inbox.worker`,
`self-enrichment`, `getBrowserlessVoyagerContext`, `login-with-otp`,
`session-manager` (cold login — it establishes the snapshot).

Guard: `npx ts-node --transpile-only src/scripts/verify-sticky-proxy.ts`
enumerates every `chromium.launch` in the runtime tree and **fails on any
unreviewed one**, so a new launch site can't quietly skip the proxy (29
assertions).

**Note:** `DEFAULT_PROXY_SERVER` is set in prod to the same IP as the only proxy,
so `session-manager`'s cold-login fallback is harmless today. Once a second proxy
exists it would pin some users to the wrong egress at login. Revisit then.

### 16. ✅ sessionInvalid cleared before the login even happened
**FIXED 2026-08-08.** Spotted live: rajaji sat at `accountHealth=SESSION_EXPIRED`
with `sessionInvalid=false` — the two flags contradicting each other.

`startLogin()` optimistically set `sessionInvalid: false` at the *start* of the
login, before a single credential was submitted, and never touched
`accountHealth`. Open the Connect modal and abandon it and the DB claimed a
working session.

Not merely untidy: the **4am inbox sweep filters on `sessionInvalid: false`**, so
it would drive a dead account into a LinkedIn authwall with an automated browser
every night — accumulating exactly the signal you don't want on an account. It's
also the same flag divergence behind the campaign re-run loop (#5).

Removed; both success paths already clear the flag once cookies are actually
captured, which is the only moment it's true. The 4am sweep now additionally
gates on `accountHealth` — the authoritative signal — so no future divergence,
whatever its cause, can put it back into that state.

---

## Not a bug (noted so it isn't chased)

- **Proxy health-check false-negative** — `[PROXY-HEALTH] … FAILED` on the
  ipify curl probe even while real LinkedIn traffic succeeds through the same
  proxy. Known false-negative for forward proxies; ignore unless real traffic fails.

---

## Fixed & deployed during this session

- ✅ **LinkedIn/Microsoft app sign-in bounced back to /login** — `/auth/callback`
  read the token via `useSearchParams()` on a prerendered page (hydrated empty).
  Now reads `window.location.search`. (commit on `main`)
- ✅ **A stray 401 wiped the fresh session** — the api interceptor logged out on
  *any* 401, including from pollers that fired before the token was stored. Now
  only logs out when the failed request actually carried a token.
- ✅ **Sign-out → sign-in reused the previous account** — added `prompt`
  (`select_account` for Microsoft, `login` for LinkedIn) to force the account
  chooser. (Note: LinkedIn largely ignores `prompt`; real switch still needs a
  LinkedIn logout — see the switch-account note added to the auth screen.)
- ✅ **Google button shape** on the auth screen + switch-account helper note.
