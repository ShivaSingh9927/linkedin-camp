"""
Persistent learning store for the email finder (SQLite, on-box).

The finder box is intentionally isolated from the main Postgres/Redis, so it
keeps its own tiny SQLite DB. Two things are learned and reused:

  1. company -> domain    (so repeat companies skip DNS/crawl resolution)
  2. domain  -> email pattern   (the big win)

Every time we VERIFY an email (or harvest a real one off a company site), we
reverse-infer which placeholder pattern produced it and increment a counter
for that (domain, pattern). The next lead at the same company is then either:
  - resolved instantly (catch-all domains -> high-confidence learned guess, no
    SMTP probe is even possible), or
  - confirmed with a SINGLE probe (verifiable domains),
instead of the full 12-probe + LLM + crawl pipeline.

The DB file lives at $EMAIL_FINDER_DB (default /data/email_finder.db, mounted
as a docker volume so it survives image rebuilds). Falls back to a local file
if /data isn't writable (dev / unit tests).
"""
from __future__ import annotations

import os
import time
import sqlite3
import threading
from typing import Optional

DB_PATH = os.environ.get("EMAIL_FINDER_DB", "/data/email_finder.db")

# Placeholder patterns in the same notation main.py / searcher.py use.
# Ordered most-specific (with separators) first so reverse-inference matches
# deterministically — a dotted local-part should map to "{{first}}.{{last}}"
# before any ambiguous separator-less form is considered.
_PLACEHOLDER_PATTERNS = [
    "{{first}}.{{last}}", "{{first}}_{{last}}", "{{last}}.{{first}}",
    "{{last}}_{{first}}", "{{f}}.{{last}}", "{{f}}_{{last}}",
    "{{first}}.{{l}}", "{{first}}_{{l}}", "{{last}}.{{f}}",
    "{{f}}{{last}}", "{{last}}{{f}}", "{{l}}{{first}}", "{{first}}{{l}}",
    "{{first}}{{last}}", "{{last}}{{first}}", "{{first}}",
]

_lock = threading.Lock()
_conn: Optional[sqlite3.Connection] = None


def _connect() -> sqlite3.Connection:
    global _conn
    if _conn is not None:
        return _conn
    path = DB_PATH
    try:
        d = os.path.dirname(path)
        if d and not os.path.isdir(d):
            os.makedirs(d, exist_ok=True)
        _conn = sqlite3.connect(path, check_same_thread=False, timeout=5, isolation_level=None)
    except Exception:
        # /data not writable (dev/tests) — fall back to a local file.
        _conn = sqlite3.connect("email_finder.db", check_same_thread=False, timeout=5, isolation_level=None)
    _conn.execute("PRAGMA journal_mode=WAL")
    _conn.execute("PRAGMA synchronous=NORMAL")
    return _conn


def init_db() -> None:
    with _lock:
        c = _connect()
        c.execute("""CREATE TABLE IF NOT EXISTS domain_cache(
            company_key TEXT PRIMARY KEY,
            domain TEXT, confidence TEXT, method TEXT,
            created_at REAL, updated_at REAL)""")
        c.execute("""CREATE TABLE IF NOT EXISTS pattern_observation(
            domain TEXT, pattern TEXT, count INTEGER DEFAULT 0,
            PRIMARY KEY(domain, pattern))""")
        c.execute("""CREATE TABLE IF NOT EXISTS domain_meta(
            domain TEXT PRIMARY KEY,
            is_catch_all INTEGER, mx_provider TEXT,
            samples INTEGER DEFAULT 0, updated_at REAL)""")


def _now() -> float:
    return time.time()


def company_key(company: Optional[str]) -> str:
    return " ".join((company or "").lower().split())


# --- company -> domain -------------------------------------------------------

def get_cached_domain(company: Optional[str]) -> Optional[dict]:
    k = company_key(company)
    if not k:
        return None
    try:
        with _lock:
            r = _connect().execute(
                "SELECT domain, confidence, method FROM domain_cache WHERE company_key=?",
                (k,),
            ).fetchone()
    except Exception:
        return None
    if not r or not r[0]:
        return None
    return {"domain": r[0], "confidence": r[1], "method": r[2]}


def put_cached_domain(company: Optional[str], domain: str, confidence=None, method=None) -> None:
    k = company_key(company)
    if not k or not domain:
        return
    try:
        with _lock:
            _connect().execute(
                """INSERT INTO domain_cache(company_key,domain,confidence,method,created_at,updated_at)
                   VALUES(?,?,?,?,?,?)
                   ON CONFLICT(company_key) DO UPDATE SET
                     domain=excluded.domain, confidence=excluded.confidence,
                     method=excluded.method, updated_at=excluded.updated_at""",
                (k, domain, confidence, method, _now(), _now()),
            )
    except Exception:
        pass


# --- domain -> pattern -------------------------------------------------------

def infer_pattern(fn: str, ln: str, local_part: str) -> Optional[str]:
    """Reverse-map a verified local-part to the placeholder pattern that
    produced it, given the (normalized) first/last name. Returns None when
    nothing matches (e.g. multi-token names, nicknames) — we'd rather learn
    nothing than learn a wrong pattern."""
    f = fn[0] if fn else ""
    l = ln[0] if ln else ""
    lp = (local_part or "").lower()
    if not lp or not fn or not ln:
        return None
    for pat in _PLACEHOLDER_PATTERNS:
        rendered = (pat.replace("{{first}}", fn).replace("{{last}}", ln)
                       .replace("{{f}}", f).replace("{{l}}", l))
        if rendered and rendered == lp:
            return pat
    return None


def build_email(pattern: str, fn: str, ln: str, domain: str) -> str:
    f = fn[0] if fn else ""
    l = ln[0] if ln else ""
    local = (pattern.replace("{{first}}", fn).replace("{{last}}", ln)
                    .replace("{{f}}", f).replace("{{l}}", l))
    return f"{local}@{domain}"


def record_pattern(domain: str, pattern: str, is_catch_all: Optional[bool] = None,
                   mx_provider: Optional[str] = None) -> None:
    if not domain or not pattern:
        return
    ca = None if is_catch_all is None else (1 if is_catch_all else 0)
    try:
        with _lock:
            c = _connect()
            c.execute(
                """INSERT INTO pattern_observation(domain,pattern,count) VALUES(?,?,1)
                   ON CONFLICT(domain,pattern) DO UPDATE SET count=count+1""",
                (domain, pattern),
            )
            c.execute(
                """INSERT INTO domain_meta(domain,is_catch_all,mx_provider,samples,updated_at)
                   VALUES(?,?,?,1,?)
                   ON CONFLICT(domain) DO UPDATE SET
                     samples=samples+1, updated_at=excluded.updated_at,
                     is_catch_all=COALESCE(excluded.is_catch_all, domain_meta.is_catch_all),
                     mx_provider=COALESCE(excluded.mx_provider, domain_meta.mx_provider)""",
                (domain, ca, mx_provider, _now()),
            )
    except Exception:
        pass


def record_verified_email(domain: str, fn: str, ln: str, email: str,
                          is_catch_all: Optional[bool] = None,
                          mx_provider: Optional[str] = None) -> Optional[str]:
    """Learn the pattern from a confirmed/harvested email. Returns the inferred
    pattern (or None if it couldn't be reverse-mapped)."""
    local = (email or "").split("@", 1)[0].lower()
    pat = infer_pattern(fn, ln, local)
    if pat:
        record_pattern(domain, pat, is_catch_all, mx_provider)
    return pat


def get_best_pattern(domain: str) -> Optional[dict]:
    if not domain:
        return None
    try:
        with _lock:
            c = _connect()
            row = c.execute(
                "SELECT pattern, count FROM pattern_observation WHERE domain=? ORDER BY count DESC LIMIT 1",
                (domain,),
            ).fetchone()
            meta = c.execute(
                "SELECT is_catch_all, mx_provider, samples FROM domain_meta WHERE domain=?",
                (domain,),
            ).fetchone()
    except Exception:
        return None
    if not row:
        return None
    return {
        "pattern": row[0],
        "count": row[1],
        "is_catch_all": bool(meta[0]) if (meta and meta[0] is not None) else False,
        "mx_provider": meta[1] if meta else None,
        "samples": meta[2] if meta else row[1],
    }
