#!/usr/bin/env bash
#
# Deploy the backend to the worker box, verifying every step that has silently
# failed before.
#
# WHY THIS EXISTS. On 2026-09-18 we found production had been running NINE-DAY-OLD
# public-API code. Nothing was broken in the usual sense — the failure was that
# every signal said it worked:
#
#   * `git pull` printed "Updating <old>..<new>" and THEN aborted on a file it
#     could not unlink (654 files in the tree were owned by root after someone
#     ran `sudo git ...`). Tailing the last line of output showed success.
#   * Docker then built that stale tree and reported "Built".
#   * `up -d` recreated containers from an image that predated the change, and
#     a build log saying "Built" was mistaken for "the change is live".
#
# So this script asserts, in order: the tree is writable, the pull actually
# moved HEAD to the commit we asked for, there is disk to build in, the build
# finished, and — the one that matters — the RUNNING CONTAINERS report the SHA
# we deployed, read from the process itself rather than from the deploy chain.
#
# Usage:
#   scripts/deploy-worker.sh                 # deploy local HEAD
#   scripts/deploy-worker.sh <sha>           # deploy a specific commit
#   SKIP_RESTART=1 scripts/deploy-worker.sh  # build + verify, don't swap containers
#
set -euo pipefail

HOST="${DEPLOY_HOST:-deploy@204.168.167.198}"
DIR="${DEPLOY_DIR:-/home/deploy/linkedin-camp}"
COMPOSE="docker compose -f production.docker-compose.worker.yml --env-file .env.production"
# A build needs room for a second full image alongside the running one.
MIN_FREE_GB="${MIN_FREE_GB:-10}"

SHA="${1:-$(git rev-parse HEAD)}"
SHORT="${SHA:0:8}"

say()  { printf '\n\033[1m▸ %s\033[0m\n' "$*"; }
ok()   { printf '  \033[32m✓\033[0m %s\n' "$*"; }
die()  { printf '  \033[31m✗ %s\033[0m\n' "$*" >&2; exit 1; }
rmt()  { ssh -o ConnectTimeout=20 "$HOST" "cd $DIR && $*"; }

# ── 0. the commit must exist on the remote -----------------------------------
say "Deploying ${SHORT} to ${HOST}"
if ! git cat-file -e "${SHA}^{commit}" 2>/dev/null; then die "unknown commit: $SHA"; fi
if [ -n "$(git rev-list "$SHA"..origin/main 2>/dev/null | head -1)" ] && \
   ! git merge-base --is-ancestor "$SHA" origin/main 2>/dev/null; then
    die "$SHORT is not on origin/main — push it first"
fi
git push -q origin main 2>/dev/null || true
ok "commit is on origin/main"

# ── 1. the tree must be writable --------------------------------------------
# This is the exact condition that froze the public API for nine days: root-owned
# files make git abort mid-pull, AFTER it has already printed "Updating ...".
say "Checking the deploy tree is writable"
FOREIGN=$(rmt "find . -not -user deploy -not -path './node_modules/*' -not -path './.git/*' | wc -l")
if [ "$FOREIGN" -gt 0 ]; then
    die "$FOREIGN file(s) in $DIR are not owned by deploy — git pull WILL abort half-way.
     Fix: ssh $HOST 'sudo chown -R deploy:deploy $DIR'"
fi
ok "all files owned by deploy"

# ── 2. pull, then PROVE HEAD moved -------------------------------------------
say "Pulling"
rmt "git fetch --quiet origin && git checkout --quiet main && git pull --ff-only" >/dev/null 2>&1 || true
REMOTE_HEAD=$(rmt "git rev-parse HEAD")
if [ "$REMOTE_HEAD" != "$SHA" ]; then
    die "remote HEAD is ${REMOTE_HEAD:0:8}, expected ${SHORT}.
     The pull did not take. Check for local modifications or untracked files that
     would be overwritten: ssh $HOST 'cd $DIR && git status --short'"
fi
ok "remote HEAD == $SHORT"

# ── 3. disk ------------------------------------------------------------------
# The build needs room for a second image; without this check it dies with
# "no space left on device" about eight minutes in.
say "Checking disk"
FREE_GB=$(rmt "df --output=avail -BG / | tail -1 | tr -dc '0-9'")
if [ "$FREE_GB" -lt "$MIN_FREE_GB" ]; then
    echo "  only ${FREE_GB}GB free (need ${MIN_FREE_GB}GB) — reclaiming"
    rmt "docker builder prune -f >/dev/null 2>&1; docker image prune -f >/dev/null 2>&1" || true
    FREE_GB=$(rmt "df --output=avail -BG / | tail -1 | tr -dc '0-9'")
    [ "$FREE_GB" -lt "$MIN_FREE_GB" ] && die "still only ${FREE_GB}GB free. Remove old images or grow the disk."
fi
ok "${FREE_GB}GB free"

# ── 4. build -----------------------------------------------------------------
say "Building (this takes a few minutes)"
LOG="/tmp/deploy-${SHORT}.log"
rmt "GIT_SHA=$SHA nohup $COMPOSE build backend-api > $LOG 2>&1 & echo started" >/dev/null
rmt "until grep -qE 'Built|ERROR|no space left' $LOG 2>/dev/null; do sleep 15; done" >/dev/null
if ! rmt "grep -q 'Built' $LOG"; then
    rmt "tail -20 $LOG" >&2
    die "build failed — see $LOG on the box"
fi
ok "image built"

# ── 5. the image must carry the SHA ------------------------------------------
# Catches a build that succeeded against the wrong tree.
say "Verifying the image"
IMG_SHA=$(rmt "docker run --rm --entrypoint sh linkedin-camp-backend:latest -c 'echo \$GIT_SHA'" | tr -d '\r')
[ "$IMG_SHA" = "$SHA" ] || die "image reports ${IMG_SHA:0:8}, expected ${SHORT}"
ok "image reports $SHORT"

if [ -n "${SKIP_RESTART:-}" ]; then
    printf '\n\033[33mSKIP_RESTART set — image is built and verified but NOT running.\033[0m\n'
    exit 0
fi

# ── 6. restart, then ask the PROCESS what it is ------------------------------
say "Restarting containers"
rmt "GIT_SHA=$SHA $COMPOSE up -d" >/dev/null 2>&1
sleep 8

for c in backend-api backend-worker; do
    RUNNING=$(ssh -o ConnectTimeout=20 "$HOST" "docker exec $c printenv GIT_SHA 2>/dev/null" | tr -d '\r' || echo missing)
    [ "$RUNNING" = "$SHA" ] || die "$c is running ${RUNNING:0:8}, expected ${SHORT} — the swap did not take"
    ok "$c running $SHORT"
done

# ── 7. health, from outside --------------------------------------------------
# POLL, don't sample once. The load balancer takes a beat to re-register a
# recreated backend, so an immediate probe gets a 503 from the LB — which is
# not a failed deploy, but reads exactly like one. Observed on the very first
# run of this script: containers already reporting the right SHA, LB still
# serving 503 for ~20s.
say "Health"
HEALTH=""
for _ in $(seq 1 15); do
    HEALTH=$(curl -s --max-time 10 "${HEALTH_URL:-https://api.qampi.com/health}" || echo '')
    echo "$HEALTH" | grep -q '"status":"ok"' && break
    sleep 5
done
echo "$HEALTH" | grep -q '"status":"ok"' \
    || die "health still not ok after 75s: ${HEALTH:0:200}"
echo "$HEALTH" | grep -q "\"commit\":\"$SHA\"" \
    || printf '  \033[33m!\033[0m health reports a different commit (proxy cache or a second host?): %s\n' "${HEALTH:0:200}"
ok "healthy, serving $SHORT"

printf '\n\033[32m✓ %s is live.\033[0m\n' "$SHORT"
