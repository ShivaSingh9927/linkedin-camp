"""
Hunter.io email-finder fallback.

Opt-in (set HUNTER_API_KEY). Used only as a LAST resort when our own pipeline
can't resolve an address, because it's a paid/credit-metered dependency. Its
real value is the company email PATTERN: we cache that into the learning DB
(store.py) so the next lead at the same company resolves for free — we pay
Hunter roughly once per company, not per lead.

Hunter does NOT beat accept-all: on Google/M365/catch-all domains it returns a
pattern-based guess with verification status "accept_all" — the same limit
everyone has. We treat its result as send-safe ONLY when verification is
"valid" AND accept_all is false; otherwise it's a high-confidence guess.
"""
from __future__ import annotations

import os
from typing import Optional

import httpx

HUNTER_API_KEY = os.environ.get("HUNTER_API_KEY", "")
HUNTER_TIMEOUT = float(os.environ.get("HUNTER_TIMEOUT", "10"))
_ENDPOINT = "https://api.hunter.io/v2/email-finder"


def enabled() -> bool:
    return bool(HUNTER_API_KEY)


def find_email(first: str, last: str, domain: Optional[str] = None,
               company: Optional[str] = None) -> Optional[dict]:
    """Return Hunter's `data` dict (email, score, accept_all, domain,
    verification.status, ...) or None on no-data / error. We pass `company`
    when we have it so Hunter resolves the canonical domain itself (it often
    corrects ours, e.g. scaleai.in -> scale.com); otherwise we pass our domain.
    """
    if not HUNTER_API_KEY or not (first and last):
        return None
    params = {"api_key": HUNTER_API_KEY, "first_name": first, "last_name": last}
    if company:
        params["company"] = company
    elif domain:
        params["domain"] = domain
    else:
        return None
    try:
        with httpx.Client(timeout=HUNTER_TIMEOUT) as c:
            r = c.get(_ENDPOINT, params=params)
        if r.status_code != 200:
            return None
        data = (r.json() or {}).get("data") or {}
        # No email found => treat as a clean miss (caller negative-caches it).
        return data if data.get("email") else None
    except Exception:
        return None
