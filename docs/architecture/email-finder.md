# Email Finder — Architecture

Self-hosted email discovery + verification for campaign leads. Finds and
**verifies** a sendable email from a person's name + company, with no paid
APIs and complete isolation from the LinkedIn automation infrastructure.

> Guiding constraints: **(1)** never email the wrong person — only *verified*
> addresses are ever sent; **(2)** no paid APIs — flat-cost, self-owned, and
> reusable as a future free public product; **(3)** keep all SMTP-probing
> reputation away from the LinkedIn/automation IPs.

---

## 1. Deployment topology

The finder runs on a **dedicated Kamatera box**, separate from the two Hetzner
servers, because it needs outbound **port 25** (which Hetzner blocks on both
prod boxes) and because SMTP-probing can get an IP blacklisted — that risk must
never touch the LinkedIn automation IP.

```
┌────────────────────────────────────────────────────────────────────┐
│  KAMATERA BOX (Stockholm)  193.168.172.213  · Ubuntu · ~$6/mo         │
│  Outbound port 25 OPEN (the whole reason for this box)                │
│  No LinkedIn session — ever                                           │
│                                                                       │
│   ┌───────────────────────┐         ┌────────────────────────────┐  │
│   │  ef-api  (FastAPI)     │         │  ef-reacher                │  │
│   │  :8002                 │ ──────▶ │  Reacher SMTP verifier     │  │
│   │  /guess /verify        │  :8080  │  internal-only (expose)    │  │
│   │  /resolve-domain       │ (priv)  │  HELO/FROM = box PTR host  │  │
│   └───────────────────────┘         └────────────────────────────┘  │
│                                                                       │
│  Auth:     X-API-Key on /guess + /verify + /resolve-domain            │
│  Firewall: :8002 reachable ONLY from the Hetzner worker box           │
│            (204.168.167.198); DROP from everywhere else (iptables      │
│            DOCKER-USER chain). /health is open for monitoring.         │
│  Compose:  /opt/email-finder/docker-compose.yml (reacher + ef-api)    │
└────────────────────────────────────────────────────────────────────┘
```

Hetzner egress was verified blocked on port 25; Kamatera open. That single
fact is why this box exists.

---

## 2. Core pipeline (`ef-api`)

One call — `POST /email-finder/guess` with `{firstName, lastName, company}`
(`domain` optional) — runs this chain, cheapest/most-confident first:

```
name + company
   │
   ▼
[1] RESOLVE DOMAIN   (resolver.py)            — skipped if caller passed a domain
      clean company name:  "Tech Vedika, Harmony CVI | …"  →  "tech vedika"
      generate candidates: joined / hyphenated  ×  .com .io .ai .co .in .tech …
      pick, in order:
        a) homepage-CONFIRMED MX domain   (strongest)
        b) first MX domain                 (.com preferred via ordering)
        c) A-record domain whose homepage confirms the company
        d) DuckDuckGo "<company> official website" → first real company host
   │
   ▼
[2] PERMUTATIONS     (permutations.py)
      ~28 patterns:  first.last · flast · first · f.last · firstlast · … @domain
   │
   ▼
[3] SMTP VERIFY      (verifier.py → ef-reacher on :25)
      each candidate → safe | risky | invalid | unknown  (+ is_catch_all)
   │
   ├─ a candidate is `safe` AND domain is not catch-all → RETURN verified ✅
   │
   ▼  (nothing verified, or catch-all domain)
[4] LLM RANK + CRAWL FALLBACK   (guesser.py + searcher.py)
      DeepSeek (via Cloudflare AI Gateway) ranks the candidates and proposes a
      search query; crawl4ai scrapes the company's /team /about /contact pages
      for a REAL published address / pattern; those are verified too.
   │
   ▼
RETURN { email, verified, confidence, is_catch_all, source, domain, domain_confidence }
```

### Endpoints
| Endpoint | Purpose |
|---|---|
| `POST /email-finder/guess` | Full pipeline (resolve → permute → verify → fallback). `domain` optional. |
| `POST /email-finder/verify` | Step 3 only — verify a given address. |
| `POST /email-finder/resolve-domain` | Step 1 only — company → domain. |
| `GET /health` | Liveness (open, no auth). |

### Domain resolver precision notes
- Only **full-name stems** are tried (no truncation to "first word") — short
  stems like `hitech` match unrelated companies, and a false-positive domain is
  worse than a miss given the "never email the wrong person" rule.
- A **homepage-confirmed** MX domain beats a bare-MX `.com` (so `techsierra.in`
  wins over a parked `techsierra.com`).
- Generic words (`tech`, `soft`, `data`, …) can't alone confirm a homepage.

---

## 3. Campaign integration (Hetzner backend)

```
CAMPAIGN WORKER
  profile_visit node
     └─ scrapes LinkedIn contact-info card → real email if public / 1st-degree
        ▼
  EMAIL_FINDER node   (apps/backend/src/campaign-engine/nodes/email-finder.ts)
     1. profile_visit email present?  → use it (real; no lookup)
     2. lead.email already set?        → use it (no lookup)
     3. neither?  ──HTTP (axios)──▶  ef-api /guess
                  (apps/backend/src/services/email-finder.service.ts)
           ├ verified   → persist to Lead.email (only if empty), use it
           └ unverified → output.suggestedEmail (NOT sent), email stays null
        ▼
  EMAIL node
     recipient = storedOutputs['email-finder'].email  ||  lead.email
     no recipient → skip (success, no send)
```

**Authority order:** real LinkedIn email **>** existing lead email **>** verified
guess. Because `updateLeadEnrichment` writes `Lead.email` whenever a
profile_visit returns one, a **later profile_visit after a connection is
accepted overwrites a guessed email with the real one** — provided the campaign
template has a `profile_visit` step *after* the connect.

**Why the finder is only called when we have nothing:** people often expose
their email on the contact card (and 1st-degree connections always do), so that
real address should win; the finder is the fallback for the rest.

### Environment (worker)
| Var | Value |
|---|---|
| `EMAIL_FINDER_URL` | `http://193.168.172.213:8002` |
| `EMAIL_FINDER_TOKEN` | shared secret (X-API-Key); in `.env.production` + worker compose |

---

## 4. Cross-cutting properties

- **Cost:** flat ~$6/mo, **zero per-lookup cost**. No Apollo/Hunter/PDL. (PDL's
  free API tier ~100/mo was rejected as too small and still a paid dependency.)
- **Isolation:** the box never logs into LinkedIn; domain resolution is pure
  DNS + web. SMTP reputation stays off the automation IP.
- **Verified-only:** unverified / catch-all guesses are surfaced as
  `suggestedEmail` but never reach the EMAIL node's recipient.
- **Security:** X-API-Key auth + iptables firewall (only the worker IP may hit
  `:8002`).
- **AI:** DeepSeek through the existing Cloudflare AI Gateway (same creds as
  ai-service).

---

## 5. Inherent limits (not bugs)

| Limit | Why |
|---|---|
| **Catch-all domains** (e.g. Snapdeal, TensorGo) | The mailserver accepts every address at probe time, so no specific address can be confirmed → returned low-confidence, never auto-sent. |
| **Consumer gmail/outlook** | Providers accept-all at the SMTP probe by design — unverifiable by anyone. |
| **Heuristic domain resolution** | Can miss or pick a sibling TLD; a wrong domain yields a *miss* (guess won't verify), never a wrong send. |

---

## 6. Code map

| Path | Role |
|---|---|
| `apps/email_finder/main.py` | FastAPI app, endpoints, auth, orchestration |
| `apps/email_finder/resolver.py` | company → domain (clean → DNS → homepage → search) |
| `apps/email_finder/permutations.py` | email pattern generation |
| `apps/email_finder/verifier.py` | Reacher SMTP-verify client |
| `apps/email_finder/guesser.py` | DeepSeek ranking (Cloudflare AI Gateway) |
| `apps/email_finder/searcher.py` | crawl4ai + DuckDuckGo email/pattern discovery |
| `apps/backend/src/services/email-finder.service.ts` | backend → box client (`findEmail`) |
| `apps/backend/src/campaign-engine/nodes/email-finder.ts` | EMAIL_FINDER campaign node |

---

## 7. Roadmap / open items

- **Real-email replacement** requires a `profile_visit` step *after* the connect
  in outreach templates (mechanism is in place; templates need the step).
- **`connectionDegree`** scrape is still unreliable (separate follow-up).
- **Public free verifier** on qampi.com (lead magnet) — deferred. Needs rate
  limiting, MX/syntax pre-checks, a public proxy endpoint, and eventually
  separate sending IPs so public abuse can't degrade the internal finder's IP.
