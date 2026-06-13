"""
Company name -> primary email domain resolver.

Fully self-hosted, no LinkedIn, no paid API. Strategy, cheapest-first:
  1. Clean the company name (drop legal suffixes, take the first clause).
  2. Generate candidate domains (joined / hyphenated × common TLDs).
  3. Keep candidates that actually resolve in DNS; prefer ones with MX
     records (real mail infra = strong signal it's the corporate domain).
  4. Confirm by fetching the homepage and checking the company name appears.
  5. Fall back to a DuckDuckGo "<company> official website" search.

Returns {domain, confidence, method, candidates_tried}. confidence is
high/medium/low/None — callers gate on it.
"""
from __future__ import annotations

import re
import socket
from urllib.parse import urlparse

import httpx

try:
    import dns.resolver as _dnsresolver
except Exception:  # dnspython missing (shouldn't happen — it's in requirements)
    _dnsresolver = None

from searcher import _ddg_search  # reuse the plain-httpx DDG search

# Pure legal-entity words — ALWAYS strip (never part of a domain).
_LEGAL_ENTITY = re.compile(
    r"\b(private|pvt|limited|ltd|llc|llp|inc|incorporated|corp|corporation|"
    r"co|company|gmbh|ag|sa|srl|bv|plc)\b",
    re.IGNORECASE,
)
# Descriptive words — often DROPPED from the domain ("Stateless Technologies"
# -> stateless.com) but sometimes KEPT ("statelesstechnologies.com"). We build
# candidates both ways rather than guessing.
_DESCRIPTIVE = re.compile(
    r"\b(technologies|technology|solutions|systems|systemz|labs|software|"
    r"services|global|group|holdings|ventures)\b",
    re.IGNORECASE,
)
_TLDS = ["com", "io", "ai", "co", "in", "tech", "net", "org"]
_HTTP_TIMEOUT = 6.0
_DNS_TIMEOUT = 4.0


def clean_company(name: str, drop_descriptive: bool = True) -> str:
    """Lowercase, take the first clause (before , | / -), drop legal suffixes.
    When drop_descriptive is False, keep words like 'technologies' so we can
    also try the longer stem (statelesstechnologies vs stateless)."""
    if not name:
        return ""
    s = name.strip()
    # First meaningful clause — LinkedIn gives "Tech Vedika, Harmony CVI | ...".
    s = re.split(r"[|/]|·|—|–| - |,", s)[0]
    s = s.lower()
    s = _LEGAL_ENTITY.sub(" ", s)
    if drop_descriptive:
        s = _DESCRIPTIVE.sub(" ", s)
    s = re.sub(r"[^a-z0-9 ]", " ", s)
    s = re.sub(r"\s+", " ", s).strip()
    return s


def _tokens(clean: str) -> list[str]:
    return [t for t in clean.split(" ") if t]


def candidate_domains(clean: str, clean_with_desc: str | None = None) -> list[str]:
    """FULL-name stems (joined + hyphenated), from BOTH the short stem (legal +
    descriptive stripped) and, if different, the longer stem that keeps
    descriptive words. We deliberately do NOT truncate to the first 1-2 words —
    short stems ("hitech", "tech") match unrelated companies and, given the
    'never email the wrong person' rule, a false-positive domain is worse than
    a miss. The short stem is ordered first (more common), the longer stem
    second so e.g. statelesstechnologies.com is still tried."""
    def _stems(c: str) -> list[str]:
        toks = _tokens(c)
        if not toks:
            return []
        joined = "".join(toks)
        hyphen = "-".join(toks)
        return [joined] + ([hyphen] if hyphen != joined else [])

    stems: list[str] = []
    for s in _stems(clean) + (_stems(clean_with_desc) if clean_with_desc else []):
        if s not in stems:
            stems.append(s)

    out: list[str] = []
    seen = set()
    for stem in stems:
        if len(stem) < 3:
            continue
        for tld in _TLDS:
            d = f"{stem}.{tld}"
            if d not in seen:
                seen.add(d)
                out.append(d)
    return out


def _dns_status(domain: str) -> tuple[bool, bool]:
    """(resolves, has_mx). MX present => strong corporate-domain signal."""
    has_mx = False
    resolves = False
    if _dnsresolver is not None:
        r = _dnsresolver.Resolver()
        r.lifetime = _DNS_TIMEOUT
        r.timeout = _DNS_TIMEOUT
        try:
            r.resolve(domain, "MX")
            has_mx = True
            resolves = True
        except Exception:
            pass
        if not resolves:
            try:
                r.resolve(domain, "A")
                resolves = True
            except Exception:
                pass
        return resolves, has_mx
    # Fallback: socket A-record lookup only (no MX without dnspython).
    try:
        socket.gethostbyname(domain)
        resolves = True
    except Exception:
        pass
    return resolves, has_mx


# Generic words that match too many unrelated sites — never confirm on these
# alone (so "tech"/"soft" can't validate the wrong company).
_GENERIC = {"tech", "soft", "data", "info", "app", "apps", "web", "cloud",
            "digital", "media", "online", "world", "india", "global", "the"}


def _homepage_confirms(domain: str, tokens: list[str]) -> bool:
    """Fetch the homepage; true if a DISTINCTIVE company token (len>=4, not a
    generic word) OR the joined multi-word stem appears in the page. The
    <title>/<meta> (the head) is the strongest signal, so we check it first and
    fall back to the body. Guards against squatters and generic-stem false
    positives."""
    distinctive = [t for t in tokens if len(t) >= 4 and t not in _GENERIC]
    # The joined stem ("asianpaints") is distinctive even when individual
    # tokens ("asian"/"paints") are common — accept it too.
    joined = "".join(tokens)
    needles = list(distinctive)
    if len(joined) >= 6 and joined not in needles:
        needles.append(joined)
    if not needles:
        return False
    for scheme in ("https", "http"):
        try:
            with httpx.Client(timeout=_HTTP_TIMEOUT, follow_redirects=True,
                              headers={"User-Agent": "Mozilla/5.0 (email-finder domain-resolver)"}) as c:
                resp = c.get(f"{scheme}://{domain}")
                if resp.status_code >= 400:
                    continue
                full = (resp.text or "").lower()
                # Head (title + meta) first — strongest, least noisy signal.
                head = full[:full.find("</head>")] if "</head>" in full[:60000] else full[:8000]
                if any(t in head for t in needles):
                    return True
                if any(t in full[:40000] for t in needles):
                    return True
        except Exception:
            continue
    return False


def resolve_domain(company: str) -> dict:
    comp_lower = company.strip().lower()
    result = {"company": company, "clean": None, "domain": None,
              "confidence": None, "method": None, "candidates_tried": 0}
    
    if re.match(r"^[a-z0-9-]+(\.[a-z0-9-]+)*\.[a-z]{2,6}$", comp_lower):
        resolves, has_mx = _dns_status(comp_lower)
        if resolves:
            result.update(clean=comp_lower, domain=comp_lower, confidence="high" if has_mx else "medium", method="direct-domain")
            return result

    clean = clean_company(company)                                   # legal + descriptive stripped
    clean_desc = clean_company(company, drop_descriptive=False)      # keeps "technologies" etc.
    # Tokens used for homepage confirmation — the fuller set (with descriptive
    # words) gives more distinctive needles.
    toks = _tokens(clean_desc) or _tokens(clean)
    result.update(clean=clean)
    if not clean:
        return result

    candidates = candidate_domains(clean, clean_desc if clean_desc != clean else None)
    result["candidates_tried"] = len(candidates)

    # Pass 1: DNS over name-stem candidates (.com-first). A homepage-confirmed
    # MX hit is the strongest signal — prefer it over a bare-MX .com (which may
    # be a parked sibling of the real .in/.io domain). Collect weaker hits for
    # fallback after the search pass.
    first_mx = None
    a_hits: list[str] = []
    for d in candidates:
        resolves, has_mx = _dns_status(d)
        if has_mx:
            if _homepage_confirms(d, toks):
                result.update(domain=d, confidence="high", method="dns-mx+homepage")
                return result
            if first_mx is None:
                first_mx = d
        elif resolves:
            a_hits.append(d)

    # Pass 2: official-website search, now a CONFIRMED-PRIMARY signal (not a
    # last resort). The search often finds the exact right domain the stem
    # candidates missed (wrong TLD, abbreviation, rebrand). A search host whose
    # homepage confirms the company name beats any unconfirmed DNS guess.
    search_host = None
    search_host_mx = False
    try:
        hits = _ddg_search(f"{company} official website", max_results=6)
        for url in hits:
            host = (urlparse(url).hostname or "").lower()
            host = re.sub(r"^www\.", "", host)
            if not host:
                continue
            # Skip aggregators / social so we land on the company's own site.
            if re.search(r"(linkedin|facebook|twitter|x|instagram|crunchbase|"
                         r"glassdoor|indeed|youtube|wikipedia|zaubacorp|"
                         r"tracxn|bloomberg|ambitionbox|zoominfo)\.", host):
                continue
            resolves, has_mx = _dns_status(host)
            if not resolves:
                continue
            if _homepage_confirms(host, toks):
                result.update(domain=host, confidence="high", method="search+homepage")
                return result
            if search_host is None:
                search_host, search_host_mx = host, has_mx
    except Exception:
        pass

    # Pass 3: fallbacks, strongest first.
    if first_mx:
        result.update(domain=first_mx, confidence="medium", method="dns-mx")
        return result
    for d in a_hits:
        if _homepage_confirms(d, toks):
            result.update(domain=d, confidence="medium", method="dns-a+homepage")
            return result
    if search_host:
        result.update(domain=search_host, confidence="medium" if search_host_mx else "low",
                      method="search")
        return result

    return result
