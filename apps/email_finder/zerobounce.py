"""
ZeroBounce email-finder fallback (pay-as-you-go alternative to Hunter).

Drop-in for hunter.py: exposes the same enabled()/find_email() interface and
returns a Hunter-shaped `data` dict, so main.py's fallback block is unchanged.

ZeroBounce splits what Hunter does in one call into two:
  * /v2/guessformat -> company email pattern + a name-applied guess (email,
    email_confidence, format). This is cheap/free and is what we cache into the
    learning DB (store.py) for free per-company reuse.
  * /v2/validate    -> SMTP status ('valid'|'invalid'|'catch-all'|...) plus a
    `catchall_domain` bool. This is the send-safe signal (1 credit).

We only spend a validate credit when guessformat actually produced an email,
and it can be disabled (ZEROBOUNCE_VERIFY=false) to save credits and lean on
our own SMTP verifier instead. Result is normalized to Hunter's shape:
    {email, domain, score, accept_all, verification: {status}}
so send_safe = (status == 'valid' and not accept_all) still holds.
"""
from __future__ import annotations

import os
from typing import Optional

import httpx

# The key ships in .env.production as ZEROBOUNCE_API; accept _KEY too.
ZEROBOUNCE_API_KEY = os.environ.get("ZEROBOUNCE_API_KEY") or os.environ.get("ZEROBOUNCE_API", "")
ZEROBOUNCE_TIMEOUT = float(os.environ.get("ZEROBOUNCE_TIMEOUT", "10"))
# Verify the guessed address for a send-safe / catch-all signal (1 credit).
ZEROBOUNCE_VERIFY = os.environ.get("ZEROBOUNCE_VERIFY", "true").lower() != "false"

_GUESS_ENDPOINT = "https://api.zerobounce.net/v2/guessformat"
_VALIDATE_ENDPOINT = "https://api.zerobounce.net/v2/validate"


def enabled() -> bool:
    return bool(ZEROBOUNCE_API_KEY)


def _confidence_to_score(conf: Optional[str]) -> int:
    return {"high": 95, "medium": 70, "low": 40}.get((conf or "").lower(), 0)


def find_email(first: str, last: str, domain: Optional[str] = None,
               company: Optional[str] = None) -> Optional[dict]:
    """Return a Hunter-shaped dict (email, domain, score, accept_all,
    verification.status) or None on no-data / error."""
    if not ZEROBOUNCE_API_KEY or not (first and last):
        return None
    if not (domain or company):
        return None

    # ZeroBounce accepts domain XOR company_name (passing both is a hard error).
    # Prefer our resolved domain; fall back to the company name.
    params = {"api_key": ZEROBOUNCE_API_KEY, "first_name": first, "last_name": last}
    if domain:
        params["domain"] = domain
    else:
        params["company_name"] = company
    try:
        with httpx.Client(timeout=ZEROBOUNCE_TIMEOUT) as c:
            r = c.get(_GUESS_ENDPOINT, params=params)
            if r.status_code != 200:
                return None
            g = r.json() or {}
            email = (g.get("email") or "").strip()
            if not email:
                return None  # clean miss -> caller negative-caches the company
            out_domain = g.get("domain") or domain or email.split("@", 1)[-1]
            score = _confidence_to_score(g.get("email_confidence"))
            accept_all = False
            status = None

            if ZEROBOUNCE_VERIFY:
                vr = c.get(_VALIDATE_ENDPOINT,
                           params={"api_key": ZEROBOUNCE_API_KEY, "email": email})
                if vr.status_code == 200:
                    v = vr.json() or {}
                    zb_status = (v.get("status") or "").lower()
                    accept_all = bool(v.get("catchall_domain")) or zb_status == "catch-all"
                    # Normalize to Hunter's vocabulary: 'valid' only when send-safe.
                    status = "valid" if zb_status == "valid" else zb_status
    except Exception:
        return None

    return {
        "email": email,
        "domain": out_domain,
        "score": score,
        "accept_all": accept_all,
        "verification": {"status": status},
    }
