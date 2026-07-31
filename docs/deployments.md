# LinkedIn Camp Deployment Log

- Auto-deployed to Hetzner: 2026-03-26

## 2026-07-30 — `83cf418f` (worker box only)

Campaign gate + account-recovery fixes (#1, #4, #5 in
`user-testing-bugs-2026-07-28.md`). Backend only — no web changes, no schema
changes, so Vercel and the DB box were untouched.

Verified after deploy: image contains all six code markers, `/health` 200 with
db+redis ok (checked via the LB from the box), env vars populated, scheduler
heartbeat clean, zero errors in the first 5 minutes. The delayed-leads sweep
exercised the new `User: { select: { accountHealth } }` lookup at runtime without
throwing — that was the riskiest line, since the lowercase relation form fails
silently in prod.

### Disk: read this before the next backend build

The worker box has **38 GB and one 4.5 GB backend image. A full rebuild needs
~10 GB transient** (build context + new layers + export + unpack, with the old
image still resident). Starting at 95% full, the build hit `ENOSPC` **twice**.

What it looks like when it happens: the build reaches
`#26 exporting layers` → `unpacking to docker.io/library/linkedin-camp-backend`
and then loops forever on
`write /tmp/.tmp-compose-build-metadataFile-*.json: no space left on device`.
The process does **not** exit — it spins at 0 bytes free. Note the image is
*already tagged* by that point, so the build may have actually succeeded; check
`docker images` before assuming failure and verify the dist:

```bash
docker run --rm --entrypoint sh linkedin-camp-backend:latest -c \
  'grep -c "<a string from your change>" /app/apps/backend/dist/worker-entry.js'
```

**Do this BEFORE building** (in order of value):
```bash
docker builder prune -af && docker image prune -af   # biggest, ~6 GB here
sudo journalctl --vacuum-size=200M                   # ~1 GB of rotated logs
```
Aim for **10 GB+ free**, not 5.

Two stale duplicate repo clones were removed permanently this deploy —
`/root/linkedin-camp` (2.8 GB, HEAD `2538dd68`) and `/app` (1.2 GB, HEAD
`c9bfe5b2`). Neither was the deploy tree (confirmed via
`docker inspect backend-api --format '{{index .Config.Labels "com.docker.compose.project.config_files"}}'`)
and neither was mounted by a container. Both are re-clonable from GitHub. **Don't
recreate them.**

Still on disk and deliberately NOT touched — ask before removing:
`/root/local_raja_session` (170 MB), `/root/linkedin-sessions` (82 MB),
`/root/raja_stealth_final.zip` + `/root/raja_session_fresh.zip` (145 MB),
`/var/log/btmp{,.1}` (269 MB of failed-SSH audit records).

After recreating the containers the old image dropped out and the box went from
**1.8 GB → 18 GB free (51%)**. So the steady state is fine; it's the two-images
window during a build that doesn't fit.

### Gotchas confirmed again
- `--env-file .env.production` is mandatory. Verify after: `docker exec backend-api sh -c 'echo ${DATABASE_URL:+set}'`.
- Detach with `setsid nohup ... < /dev/null &` and **close the SSH command's own
  stdout**, or the SSH call blocks for the whole build.
- Don't `pkill -f "docker compose.*build"` — the pattern matches your own
  `bash -c` wrapper and kills your SSH session. Use `pgrep -f "^docker compose"`
  and kill the PIDs.
- The Hetzner LB needs ~45 s (3 checks × 15 s) after a target restart before
  `https://api.qampi.com/health` stops returning 503. Check
  `http://10.0.0.2:3001/health` from the box to tell a real outage from LB lag.
