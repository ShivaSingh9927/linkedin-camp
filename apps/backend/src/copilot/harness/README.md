# Qampi copilot evaluation harness

This directory tests the existing copilot contract without changing the
production architecture.

## Default, zero-API-cost checks

```bash
npm --workspace backend run test:copilot-harness
npm --workspace backend run harness:copilot
```

The same commands are available from the repository root as
`npm run test:copilot-harness` and `npm run harness:copilot`.

The first command runs deterministic contract and LinkedIn-copy graders. The
second validates that the golden dataset is available, but deliberately makes
no model calls.

## Opt-in live evaluation

Live evaluation calls the configured AI service once per golden case and
therefore consumes DeepSeek tokens:

```bash
COPILOT_HARNESS_LIVE=1 AI_SERVICE_URL=http://localhost:8001 \
  npm --workspace backend run harness:copilot
```

Each case has a 30-second timeout by default. Override it with
`COPILOT_HARNESS_TIMEOUT_MS` when testing a slower environment. A failed or
timed-out case is reported alongside the rest of the suite instead of aborting
the run.

Run a small smoke subset by passing comma-separated case IDs:

```bash
COPILOT_HARNESS_LIVE=1 \
COPILOT_HARNESS_CASES=route-find-leads,route-launch-campaign,reject-prompt-injection \
AI_SERVICE_URL=http://localhost:8001 npm run harness:copilot
```

Live runs are capped at five calls by default. Raising
`COPILOT_HARNESS_MAX_CALLS` is always explicit. Regression defaults are 100%
pass rate, average score at least 90, and p95 latency no higher than 30 seconds;
each threshold can be overridden through its corresponding environment variable.

For a periodic check, run the three-case smoke subset above on a controlled
schedule. It costs exactly three model calls per run. The repository CI remains
deterministic and never enables live mode.

The suite fails when an intent is misclassified, a side effect bypasses
confirmation, a reply invents numbers, a placeholder leaks, or another hard
contract is violated.

## Data policy

- Golden cases are synthetic and versioned in Git.
- The web app records privacy-minimized turn metadata in IndexedDB.
- Reply records include quality-flag codes and lifecycle outcomes such as
  edited, regenerated, sent, or send-failed.
- Raw messages, lead names, profile URLs, cookies, and tokens are not stored by
  the browser harness.
- Live evaluation is opt-in so CI cannot silently incur model spend.

## LinkedIn skill provenance

The deterministic writing heuristics are adapted from selected ideas in
[`sergebulaev/linkedin-skills`](https://github.com/sergebulaev/linkedin-skills),
licensed under MIT. Qampi uses the humanizer, comment-quality, approval, and
untrusted-content principles as review heuristics. It does not install or call
Apify, Publora, Pixfaro, or third-party detector APIs.

Upstream algorithm and engagement claims are not treated as facts or deployment
gates until validated against Qampi's own outcome data.

## Runtime reply selection

The reply endpoint already receives up to three variations from the existing
model call. It grades those candidates deterministically and returns the
cleanest one, along with non-sensitive quality-flag codes for the local browser
record. This adds no model call and does not alter the service architecture.
