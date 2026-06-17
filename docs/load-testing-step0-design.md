# Load Testing — Step 0 Design (mock flag + seeder + monitor + cleanup)

Goal of the overall effort: **find which subsystem breaks first** so we know
*what to scale and when*. Tests run **against the prod worker box** with
**synthetic users**, so LinkedIn is mocked (no real accounts, no flag risk) and
every synthetic row is tagged for **guaranteed cleanup**.

This doc is the design for Step 0 only. Nothing here runs until you approve.

---

## 1. `MOCK_LINKEDIN` flag — skip all real LinkedIn I/O

**Why:** without this, load-testing the worker would launch a real Chromium per
job and hit linkedin.com — slow, expensive in RAM, and a ban risk. We want to
exercise the *queue + scheduler + DB + lock* machinery at realistic volume
without any browser.

**CORRECTED after recon.** The original draft named `linkedin.worker.ts`
(`processWorkflowStep`) — that's the *legacy* per-step path on the unused
`linkedin-actions` queue. Prod actually runs:

```
cron scheduler ─enqueue→ campaign-actions queue
  → campaign-worker.ts processCampaignJob (per-account Redis lock, concurrency=6)
    → runCampaign()  [campaign-engine/engine.ts]
      → launchAuthenticatedContext()  [the ONE shared browser launcher]
      → per-lead: handler(nodeCtx, config)  [connect/send-message/like/... nodes]
```

The engine wraps every node call with the canonical DB writes (ActionLog,
Message row, Lead status, transitionLead, writeNodeOutput, enrichment, CRM
events) keyed off the node's returned `output`. **So mocking only needs to (a)
skip the browser launch and (b) return synthetic `output` from each node — the
engine does all the faithful DB writes itself.** No per-node write mirroring.

Exact edits, all in `apps/backend/src/campaign-engine/`:

1. **`engine.ts` — skip the launch.** At `runLead`'s
   `launchAuthenticatedContext` call: if `MOCK_LINKEDIN`, set
   `launch = { ok:true, browser:null, context:null, page:null }`. All later
   `page.*` calls get a `page ?` guard (only `classifyPage(page)` and
   `isFirstDegree(...,page)` run unconditionally — both guarded).
2. **`engine.ts` — stub the node handler.** At the `handler(nodeCtx, nodeConfig)`
   dispatch (and the `executeNode` used by if-else): when `MOCK_LINKEDIN` and the
   node is a LinkedIn action, return `await mockNode(ctx, config)` instead.
   `delay` and `if-else` **pass through** to the real handler (DB-only, we want
   real branching/parking).
3. **`engine.ts` — warmup + seedConnections.** Mock warmup → instant
   `{success:true}`; `seedConnections()` → return `true` without launching.
4. **`engine.ts` — bypass the working-hours gate** under `MOCK_LINKEDIN` (else
   off-hours runs defer every lead and nothing executes).
5. **`mock-linkedin.ts` (new)** — `isMockLinkedIn()`, `MOCK_STEP_MS` jittered
   sleep, and `mockNode(ctx, config)` returning the right `output` per node type
   (connect→`{status:'sent'}`, send-message→`{sent:true,messageText}`,
   profile-visit→enrichment fields, check-connection→`{connected}`, etc.).
6. **`voyager-api.service.ts`** — `getAllConnections`/`isFirstDegree`/
   `getProfileByFsd` early-return fake payloads under `MOCK_LINKEDIN` (belt-and-
   suspenders; the engine paths above already avoid calling them).

**Daily caps (`DAILY_CAPS`, counted from `ActionLog`):** left ACTIVE by default
(realistic — caps are per-account and that's a real limit). For a single-user
stress test they'd throttle; scale by adding users instead. A `MOCK_LIFT_CAPS`
escape hatch can be added if we later want to push one account unboundedly.

**Not touched by this flag:** AI calls (see next), and real login. We will not
load-test login.

## 2. `MOCK_AI` flag — avoid DeepSeek spend during queue tests (Steps 1–3)

Message/comment generation calls the AI service **synchronously** and costs real
money per call. For the queue-throughput tests we don't care about AI quality,
only that the call happened and took time. So a separate flag:

- `apps/backend/src/campaign-engine/ai-service.ts` (and `controllers/ai.controller.ts`):
  if `MOCK_AI==='true'`, return a canned string after a configurable
  `MOCK_AI_MS` delay (default ~1500ms to mimic real latency) instead of calling
  the ai-service.

Step 4 (AI concurrency test) runs with `MOCK_AI=false` to measure the real
DeepSeek/gateway ceiling — deliberately, and small.

Two independent flags so we can isolate ceilings: `MOCK_LINKEDIN` (browser) vs
`MOCK_AI` (LLM spend).

## 3. Synthetic-user seeder — `apps/backend/src/scripts/loadtest-seed.ts`

Creates realistic load fixtures, **all tagged** so cleanup is bulletproof.

**Tagging (canonical, non-negotiable):** every synthetic user's email is
`loadtest+<n>@loadtest.qampi.invalid`. The `.invalid` TLD is reserved by RFC and
can never collide with a real signup. Cleanup keys off this exact domain.
Defense-in-depth: also stamp `firstName = 'LOADTEST'`.

Per synthetic user the seeder creates:
- `User` with a **fake** `linkedinCookie` (valid-shaped JSON array, never a real
  session) — harmless because `MOCK_LINKEDIN` means it's never used.
- `BusinessProfile` (so AI paths have inputs), default `goalType='sell'`.
- one `Campaign` with `status='ACTIVE'` and a `workflowJson` copied from a real
  template (connect → delay → message), so the scheduler picks it up.
- `M` `Lead` rows + `CampaignLead` rows with `nextActionDate = now` so the
  1-min scheduler enqueues them immediately.

**CLI params:** `--users N --leads M --steps connect,message --mock` (refuses to
run unless the loadtest email domain is in use; refuses if `--mock` omitted and
flags are off, to prevent accidental real sends).

**Hard safety rails baked in:**
- the script will **only ever** write users whose email ends in
  `@loadtest.qampi.invalid`.
- it prints a summary and requires `--yes` to actually commit on a host where
  `NODE_ENV==='production'`.

## 4. Live monitor — `apps/backend/src/scripts/loadtest-monitor.ts`

Run on the worker box during a test; prints every 2s:
- BullMQ depth for `campaign-actions` and `linkedin-actions`:
  `waiting / active / completed / failed / delayed`
- count of held `linkedin-lock:*` keys (lock contention)
- worker process RSS + system RAM (`free`) + load average
- derived: **completed jobs/min** (the throughput number we actually want)

This is the dashboard you watch to see *where it bends*.

## 5. Cleanup — `apps/backend/src/scripts/loadtest-teardown.ts`

- set all loadtest campaigns to `PAUSED` first (stops the scheduler instantly),
- drain/remove their queued BullMQ jobs,
- `prisma.user.deleteMany` where email domain = `@loadtest.qampi.invalid`
  (relies on `onDelete: Cascade` — **to be verified in schema during build**;
  if any relation lacks cascade, teardown deletes children explicitly first),
- assert zero `loadtest.qampi.invalid` rows remain and print the count.

A `--panic` mode that *only* pauses every loadtest campaign + clears the queue,
for aborting a run mid-flight without deleting data.

---

## Prod-safety summary (because we're on the real box)

| Risk | Mitigation |
|---|---|
| Touch real LinkedIn accounts | `MOCK_LINKEDIN` skips all browser/Voyager I/O; fake cookies anyway |
| DeepSeek $ blowup | `MOCK_AI` for Steps 1–3; Step 4 is small + deliberate |
| Pollute prod DB | every row tagged `@loadtest.qampi.invalid`; teardown deletes by that domain and asserts zero remain |
| Starve real users' jobs | run in a low-traffic window; `--panic` pauses all loadtest campaigns in one command |
| Accidental real send | seeder refuses to run without the mock flag + `--yes` on prod |

## Sequence after Step 0 is approved & built

1. Baseline (1 of each, mocked) → per-path latency
2. API + WS load (k6) → Node/WS ceiling
3. Queue saturation (seed N, watch monitor) → **jobs/min + worker RAM ceiling**
4. AI concurrency (`MOCK_AI=false`, small) → LLM ceiling
5. Soak (run #3 for 2–4h) → leak detection
6. Capacity model → users-per-box
