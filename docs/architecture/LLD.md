# Qampi — Low Level Design

Companion to `HLD.md`. Module-level detail, sequence diagrams, schema highlights, env var reference, and runbooks.

**Last updated:** 2026-05-20.

---

## 1. Repo layout

```
linkedin-camp/
├── apps/
│   ├── backend/                  Node + Express + Playwright + BullMQ
│   │   ├── src/
│   │   │   ├── server.ts         ENTRY: backend-api (HTTP + WS + /health)
│   │   │   ├── worker-entry.ts   ENTRY: backend-worker (BullMQ + scheduler)
│   │   │   ├── sentry.ts         Init module; imported first in both entries
│   │   │   ├── socket/index.ts   Socket.IO server (status broadcast only)
│   │   │   ├── routes/           Express route modules
│   │   │   ├── controllers/      Route handlers
│   │   │   ├── services/
│   │   │   │   ├── session-manager.service.ts   LinkedIn login (Playwright)
│   │   │   │   ├── session-validator.service.ts Validates DB session is still alive
│   │   │   │   └── proxy.service.ts             getOrAssignProxy(userId)
│   │   │   ├── workers/
│   │   │   │   ├── campaign-worker.ts           Picks up campaign-actions jobs
│   │   │   │   ├── linkedin.worker.ts           Single-action LinkedIn jobs
│   │   │   │   ├── inbox.worker.ts              Inbox sync
│   │   │   │   └── proxy.worker.ts              Periodic proxy health checks
│   │   │   ├── cron/scheduler.ts                node-cron heartbeats
│   │   │   └── campaign-engine/
│   │   │       ├── engine.ts                    Per-lead campaign runner
│   │   │       └── nodes/                       profile-visit, send-message, connect, ...
│   │   ├── Dockerfile            Multi-stage: builder + runner with Chromium pre-installed
│   │   └── tsup.config.ts        Two entries: server.ts + worker-entry.ts
│   ├── web/                      Next.js frontend (Vercel)
│   ├── landing/                  Marketing site (Vercel)
│   └── ai-service/               Python FastAPI + Groq (not running in prod yet)
├── packages/
│   ├── db/                       Prisma client + schema + migrations
│   │   ├── schema.prisma
│   │   ├── migrations/
│   │   └── index.ts              `export const prisma = new PrismaClient()`
│   └── types/                    Shared TS types
├── production.docker-compose.db.yml      postgres + redis + ai-service
├── production.docker-compose.worker.yml  backend-api + backend-worker
├── docker-compose.local.yml              Same shape for local dev
├── .env.production                       Prod secrets (gitignored)
└── docs/architecture/                    This file + HLD.md
```

---

## 2. Data model (key tables)

```mermaid
erDiagram
    User ||--o{ Campaign : owns
    User ||--o{ Lead : owns
    User ||--o{ BusinessProfile : has
    User }o--|| Proxy : "sticky-assigned (proxyId)"
    Campaign ||--o{ CampaignLead : "lead list"
    Campaign ||--o{ CampaignLeadProgress : "per-lead state"
    Lead ||--o{ CampaignLead : "appears in"
    User ||--o{ WorkerLog : produces
    User ||--o{ Notification : receives

    User {
        cuid id PK
        string email UK
        string passwordHash
        string linkedinCookie "JSON array of cookies"
        string linkedinLocalStorage "JSON object"
        string linkedinFingerprint "JSON object {userAgent,...}"
        string proxyId FK
        bool linkedinActiveInBrowser
        bool sessionInvalid
        datetime sessionValidatedAt
        datetime updatedAt "scheduler activity heartbeat"
    }
    Proxy {
        cuid id PK
        string proxyHost
        int proxyPort
        string proxyCountry
        bool isAssigned
        bool banned
        int failureCount
        int maxUsers
    }
    Campaign {
        cuid id PK
        string userId FK
        string status "ACTIVE|PAUSED|COMPLETED|DRAFT"
        json workflow "node list [{node:'profile-visit'},{node:'send-message',message:'...'}]"
    }
    CampaignLead {
        cuid id PK
        string campaignId FK
        string leadId FK
        bool isCompleted
        datetime lastActionAt
        datetime nextActionDate "set by delay nodes"
    }
    CampaignLeadProgress {
        cuid id PK
        string campaignId FK
        string leadId FK
        int currentNodeIndex
        bool needsRetry
        datetime nextRetryAt
    }
```

**Session storage on User** is critical to understand: cookies, localStorage, and fingerprint are stored as JSON strings on the `User` row. **No disk reads anywhere in the runtime path.** This is what makes workers stateless.

---

## 3. LinkedIn login flow

```mermaid
sequenceDiagram
    autonumber
    actor U as User browser
    participant FE as Next.js (app.qampi.com)
    participant API as backend-api
    participant WS as Socket.IO
    participant SM as session-manager.service.ts
    participant PR as proxy.service.getOrAssignProxy
    participant DB as Postgres User row
    participant LI as LinkedIn

    U->>FE: enter LinkedIn creds in Settings
    FE->>API: POST /api/v1/session/start-socket-login
    API->>SM: startSocketLogin(userId)
    SM->>PR: getOrAssignProxy(userId)
    PR->>DB: SELECT proxy / assign one if first time
    PR-->>SM: { host, port, user, pass }
    SM->>LI: Playwright chromium launch + proxy
    SM->>LI: GET https://linkedin.com/login
    SM-->>WS: emit SESSION_LOGIN_STATUS {step:'page_loaded'} to user_${userId}
    FE->>API: POST /submit-credentials {email,password}
    API->>SM: submitCredentials(userId, email, password)
    SM->>LI: human-typing into selector fallback list
    SM->>LI: click Sign in (visibility-checked)
    alt LinkedIn asks for 2FA
        SM-->>WS: SESSION_LOGIN_STATUS {step:'awaiting_2fa'}
        FE->>API: POST /submit-2fa-code {code}
        API->>SM: submit2FA(userId, code)
        SM->>LI: type code, submit
    end
    SM->>LI: navigate to /feed/, harvest cookies + localStorage
    SM->>DB: UPDATE User SET linkedinCookie, linkedinLocalStorage, linkedinFingerprint
    SM-->>WS: SESSION_LOGIN_STATUS {step:'SUCCESS'}
```

**Selector resilience.** LinkedIn ships at least 3 login page variants. `session-manager.service.ts` iterates a list of selector candidates per field (`#username`, `input[name="session_key"]`, `input[autocomplete="username"]`, `input[type="email"]`) and picks the first one `isVisible()`. Same pattern for password and submit button. Don't simplify these to single selectors — that's how we got burned twice in May.

---

## 4. Campaign execution flow

```mermaid
sequenceDiagram
    autonumber
    participant CR as cron/scheduler.ts<br/>(every 1 min)
    participant Q as BullMQ campaign-actions queue
    participant W as campaign-worker.ts
    participant R as Redis (linkedin-lock:${userId})
    participant DB as Postgres
    participant E as campaign-engine/engine.ts
    participant LI as LinkedIn

    CR->>DB: SELECT users with ACTIVE campaigns AND inactive in last 2min
    CR->>Q: enqueue { userId, campaignId, leadId, stepIndex }
    W->>Q: BRPOP job
    W->>R: SET linkedin-lock:${userId} <token> EX 600 NX
    alt lock NOT acquired (another worker has it)
        W->>Q: re-queue with 30s delay
        W->>W: return early
    end
    W->>DB: load User (session JSON, proxyId)
    W->>DB: load Campaign (workflow) + lead + business profile
    W->>E: runCampaign({sessionContext: {cookies, ua, ls, proxy}, flow})
    loop for each flow node
        E->>LI: Playwright launch + sticky proxy + addCookies + injectLocalStorage
        E->>LI: navigate, execute node (profile-visit / send-message / ...)
        E->>DB: writeNodeOutput, update Lead enrichment if profile-visit
        E-->>W: NodeResult
    end
    E-->>W: CampaignSummary
    W->>R: EVAL <lua compare-and-delete>(linkedin-lock:${userId}, token)
    W->>DB: UPDATE CampaignLead SET isCompleted, lastActionAt
```

**Lock semantics:** the token is `task_${campaignLeadId}_step_${stepIndex || 'null'}-${Date.now()}`. The Lua release script:

```lua
if redis.call('get', KEYS[1]) == ARGV[1] then
  return redis.call('del', KEYS[1])
else
  return 0
end
```

This ensures a worker can only delete its **own** lock, not one held by a peer that took over after our TTL expired. If the lock has expired and someone else holds it, we no-op and exit cleanly.

---

## 5. Sticky proxy assignment

```mermaid
flowchart TD
    A[getOrAssignProxy userId] --> B{User.proxyId set?}
    B -- yes --> C[Load Proxy by id]
    C --> D{Proxy banned?}
    D -- no --> E[Return proxy]
    D -- yes --> F[Unset User.proxyId]
    F --> G
    B -- no --> G[Find available Proxy<br/>WHERE NOT banned<br/>AND assignedCount lt maxUsers]
    G --> H{Found?}
    H -- yes --> I[Set User.proxyId<br/>increment Proxy assignedCount]
    I --> E
    H -- no --> J[Return null<br/>caller falls back to DEFAULT_PROXY env or fails]
```

A user keeps the same proxy for the lifetime of the relationship unless that proxy is banned. This means **same exit IP for login + every campaign run + every session validator check**, which is the assumption LinkedIn's risk model is built on. Don't ever round-robin proxies per-action.

---

## 6. /health endpoint contract

```
GET /health
```

Pings DB (`SELECT 1`) and Redis (`PING`) with 2s timeouts. Response shape:

```json
// healthy
HTTP 200
{ "status": "ok", "checks": { "db": "ok", "redis": "ok" } }

// degraded (used by LB to mark target unhealthy)
HTTP 503
{ "status": "degraded", "checks": { "db": "fail: db timeout", "redis": "ok" } }
```

LB checks every 15s, 3 retries, 10s timeout. After 3 failures the LB stops routing traffic to the target.

---

## 7. Observability

| Concern | Mechanism | Location |
|---|---|---|
| Unhandled exceptions (API) | Express error middleware → `Sentry.captureException` | `apps/backend/src/server.ts` after all route mounts |
| Unhandled rejections / uncaught exceptions (worker) | `process.on('unhandledRejection')` + `'uncaughtException'` → Sentry | `apps/backend/src/worker-entry.ts` |
| Init | `apps/backend/src/sentry.ts` reads `SENTRY_DSN`, sets `tracesSampleRate: 0.05`, strips `authorization`/`cookie` headers in `beforeSend` | Imported as the **first** import in both entries |
| Liveness | LB → HTTP `/health` every 15s | See section 6 |
| Logs | `docker logs backend-api`, `docker logs backend-worker` | SSH to worker box |
| Backup logs | `/var/log/qampi-pg-backup.log` on db box | SSH to db box as root |

---

## 8. Backup and restore

**Backup (automatic):**
- Script: `/usr/local/bin/qampi-pg-backup.sh` (on db box, run by root)
- Cron: `/etc/cron.d/qampi-pg-backup` — `0 2 * * *` (02:00 UTC daily)
- Path in bucket: `s3://qampi-user-data/pg-backups/qampi-db-01/YYYY-MM-DD_HHMMSS.sql.gz`
- Retention: 30 days (older files auto-deleted via `rclone delete --min-age 30d`)
- Tool: `rclone` with config at `/root/.config/rclone/rclone.conf` (endpoint `hel1.your-objectstorage.com`, region/location_constraint `hel1`)

**Manual backup:**
```bash
ssh root@89.167.123.143 '/usr/local/bin/qampi-pg-backup.sh'
ssh root@89.167.123.143 'rclone lsl hetzner:qampi-user-data/pg-backups/qampi-db-01/ | tail'
```

**Restore (DESTRUCTIVE — wipes current data):**
```bash
ssh root@89.167.123.143 '
  TS=2026-05-20_084848   # pick from rclone lsl ...
  rclone copyto "hetzner:qampi-user-data/pg-backups/qampi-db-01/${TS}.sql.gz" /tmp/restore.sql.gz
  docker exec postgres psql -U shiva -d postgres -c "DROP DATABASE linkedin_camp; CREATE DATABASE linkedin_camp;"
  gunzip -c /tmp/restore.sql.gz | docker exec -i postgres psql -U shiva -d linkedin_camp
  rm -f /tmp/restore.sql.gz
'
```

The dump uses `--clean --if-exists --no-owner --no-privileges`, so you can also pipe it into a non-empty DB without the DROP/CREATE step.

---

## 9. Environment variables

Single source of truth: `.env.production` on the box (gitignored). The same file lives on both worker box (`/home/deploy/linkedin-camp/.env.production`) and db box (with `PRIVATE_IP` overridden).

| Variable | Set on | Purpose |
|---|---|---|
| `NODE_ENV` | both | `production` |
| `JWT_SECRET` | worker | Sign tokens. **Rotate before public launch.** |
| `SENTRY_DSN` | worker | Error capture |
| `DATABASE_URL` | worker | `postgresql://shiva:password123@10.0.0.4:5432/linkedin_camp?schema=public` |
| `REDIS_URL` | worker | `redis://10.0.0.4:6379` |
| `AI_SERVICE_URL` | worker | `http://10.0.0.4:8001` (ai-service not running yet) |
| `GROQ_API` | both | Used by backend (relays through ai-service) and ai-service directly |
| `DEFAULT_PROXY_*` | worker | Fallback proxy if `getOrAssignProxy` returns null |
| `PORT` | worker | `3001` |
| `PRIVATE_IP` | both | `10.0.0.2` (worker) / `10.0.0.4` (db) — what compose binds container ports to |
| `POSTGRES_USER`/`PASSWORD`/`DB` | db | Postgres container init |
| `NEXT_PUBLIC_API_URL` | Vercel | `https://api.qampi.com/api/v1` |

---

## 10. Production runbook

### Deploy a code change

```bash
# 1. Push to feat/ai-enhancements-prod (or main when merged)
git push

# 2. SSH and pull on worker box
ssh deploy@204.168.167.198 'cd ~/linkedin-camp && git pull'

# 3. Rebuild API image (takes ~3-10 min — Playwright deps)
ssh deploy@204.168.167.198 'cd ~/linkedin-camp && docker compose --env-file .env.production -f production.docker-compose.worker.yml build backend-api'

# 4. Recreate containers (workers share the same image, so both get the new code)
ssh deploy@204.168.167.198 'cd ~/linkedin-camp && docker compose --env-file .env.production -f production.docker-compose.worker.yml up -d --force-recreate'

# 5. Verify
curl https://api.qampi.com/health
ssh deploy@204.168.167.198 'docker logs backend-api --tail 30'
```

If disk fills during build: `docker builder prune -af && docker image prune -af` on the worker box.

### Apply a Prisma schema change

```bash
# Locally: edit packages/db/schema.prisma, then
cd packages/db
npx prisma migrate dev --name describe_change

# Push commit + on the worker box, run the migration in a one-shot container:
ssh deploy@204.168.167.198 'cd ~/linkedin-camp && set -a && . .env.production && set +a && \
  docker run --rm --network host -v "$(pwd)/packages/db:/app" -w /app -e DATABASE_URL="$DATABASE_URL" \
  node:20-slim sh -c "apt-get update -qq && apt-get install -y -qq openssl >/dev/null && \
  npm install --no-audit --no-fund --silent prisma@^6.0.1 @prisma/client@^6.0.1 && \
  npx prisma migrate deploy"'
```

Note: the existing two migrations in `packages/db/migrations/` are broken — they were never applied cleanly. Prod schema was initialized with `prisma db push`. Future migrations are fine; just be aware that `migrate deploy` from a blank state will fail on the second migration. Plan to either baseline (`prisma migrate resolve --applied`) or delete the broken migrations and squash to a fresh initial migration.

### Rotate a banned proxy

```sql
-- via psql on db box
docker exec -it postgres psql -U shiva -d linkedin_camp -c \
  "UPDATE \"Proxy\" SET banned=false, \"failureCount\"=0 WHERE id='<proxy-id>'"

-- or unassign all users from a permanently-dead proxy
UPDATE "User" SET "proxyId"=NULL WHERE "proxyId"='<proxy-id>';
```

### Force-clear a stuck Redis lock

```bash
ssh deploy@89.167.123.143 'docker exec redis redis-cli DEL linkedin-lock:<userId>'
```

Use only if you're certain no worker is actively driving that account — otherwise you create the bug the lock exists to prevent.

### Re-run a campaign for testing

```sql
UPDATE "Campaign" SET status='ACTIVE' WHERE id='<id>';
UPDATE "CampaignLead" SET "isCompleted"=false, "lastActionAt"=NULL WHERE id='<id>';
DELETE FROM "CampaignLeadProgress" WHERE "campaignId"='<id>';
-- scheduler picks it up within 60s; clear the activity throttle:
UPDATE "User" SET "updatedAt"=NOW() - INTERVAL '10 minutes' WHERE id='<userId>';
```

### Renew Let's Encrypt cert

Hetzner manages it — automatic. To check expiry:

```bash
echo | openssl s_client -connect api.qampi.com:443 -servername api.qampi.com 2>/dev/null | openssl x509 -noout -dates
```

---

## 11. Known gotchas

- **`session-manager` still writes session JSON to disk** even though no reader uses it. Vestigial — safe to delete in a future cleanup pass, but not breaking anything.
- **The `sessions_data` volume in `production.docker-compose.worker.yml`** is no longer needed for correctness. Can be removed; only used as a place for debug screenshots which will fill the disk over time.
- **Proxy health worker calls `curl`** which is not in the worker container image. Health checks fail silently and can mark good proxies as banned. Workaround: manually unban (see runbook). Real fix: install curl in the Dockerfile or rewrite the health check to use `fetch`.
- **CORS allows `*`** in prod. Fine for now since auth is JWT-bearer, not cookie-based, so CSRF is not a vector — but tighten to `https://app.qampi.com` before public launch.
- **`docker compose up -d` without `--env-file`** silently substitutes empty strings for env vars. Always pass `--env-file .env.production`.
- **The first time you bring up a recreated container, it may attach to no network** (a Docker compose quirk seen during initial setup). Symptom: `connect ENETUNREACH`. Fix: `docker compose down && up -d`.

---

## 12. Capacity assumptions (current)

| Resource | Limit | Why it's enough today |
|---|---|---|
| Worker box | 4 vCPU, ~4 GB RAM (CPX32) | One Playwright + one API process. Chromium peaks ~800MB |
| DB box | 2 vCPU, 8 GB RAM (CCX13) | Postgres + Redis with no expected concurrent campaigns at launch |
| Postgres `max_connections` | 100 (default) | Prisma pool ≈ `cpus * 2 + 1` per process; 2 processes × 9 = 18 well below limit |
| Hetzner LB11 | 25 targets, 10K concurrent connections | We have 1 target |
| BullMQ queue depth | unbounded (Redis-backed) | Sized to RAM, not a concern at launch |
| Hetzner Object Storage | TB-scale | A 30-day window of 5KB sql.gz dumps is ~150KB |

When any of these gets close to limit, the next move is documented in HLD section 6 (Out of scope).
