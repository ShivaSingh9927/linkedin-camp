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

# Legal suffixes / boilerplate we strip before building domain candidates.
_LEGAL = re.compile(
    r"\b(private|pvt|limited|ltd|llc|llp|inc|incorporated|corp|corporation|"
    r"co|company|gmbh|ag|sa|srl|bv|plc|technologies|technology|solutions|"
    r"systems|systemz|labs|software|services|global|group|holdings|ventures)\b",
    re.IGNORECASE,
)
_TLDS = ["com", "io", "ai", "co", "in", "tech", "net", "org"]
_HTTP_TIMEOUT = 6.0
_DNS_TIMEOUT = 4.0


def clean_company(name: str) -> str:
    """Lowercase, take the first clause (before , | / -), drop legal suffixes."""
    if not name:
        return ""
    s = name.strip()
    # First meaningful clause — LinkedIn gives "Tech Vedika, Harmony CVI | ...".
    s = re.split(r"[|/]|·|—|–| - |,", s)[0]
    s = s.lower()
    s = _LEGAL.sub(" ", s)
    s = re.sub(r"[^a-z0-9 ]", " ", s)
    s = re.sub(r"\s+", " ", s).strip()
    return s


def _tokens(clean: str) -> list[str]:
    return [t for t in clean.split(" ") if t]


def candidate_domains(clean: str) -> list[str]:
    """Only the FULL-name stems (joined + hyphenated). We deliberately do NOT
    truncate to the first 1-2 words — short stems ("hitech", "tech") match
    unrelated companies and, given the 'never email the wrong person' rule,
    a false-positive domain is worse than a miss (the search fallback or a
    manual review can still find it)."""
    toks = _tokens(clean)
    if not toks:
        return []
    joined = "".join(toks)
    hyphen = "-".join(toks)
    stems = [joined] + ([hyphen] if hyphen != joined else [])
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
    generic word) appears in the page text. Guards against squatters and
    against generic-stem false positives."""
    distinctive = [t for t in tokens if len(t) >= 4 and t not in _GENERIC]
    if not distinctive:
        return False
    for scheme in ("https", "http"):
        try:
            with httpx.Client(timeout=_HTTP_TIMEOUT, follow_redirects=True,
                              headers={"User-Agent": "Mozilla/5.0 (email-finder domain-resolver)"}) as c:
                resp = c.get(f"{scheme}://{domain}")
                if resp.status_code >= 400:
                    continue
                text = (resp.text or "")[:20000].lower()
                if any(t in text for t in distinctive):
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

    clean = clean_company(company)
    toks = _tokens(clean)
    result.update(clean=clean)
    if not clean:
        return result

    candidates = candidate_domains(clean)
    result["candidates_tried"] = len(candidates)

    # Pass 1: DNS. Candidates are ordered full-name-stem first, .com-first.
    # A homepage-confirmed MX hit is the strongest signal — prefer it over a
    # bare-MX .com (which may be a parked sibling of the real .in/.io domain,
    # e.g. techsierra.com vs the real techsierra.in). Fall back to the first
    # bare-MX hit, then to an A-record domain whose homepage confirms.
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

    if first_mx:
        result.update(domain=first_mx, confidence="medium", method="dns-mx")
        return result

    for d in a_hits:
        if _homepage_confirms(d, toks):
            result.update(domain=d, confidence="medium", method="dns-a+homepage")
            return result

    # Pass 2: search-engine fallback for the official site.
    try:
        hits = _ddg_search(f"{company} official website", max_results=6)
        for url in hits:
            host = (urlparse(url).hostname or "").lower().lstrip("www.")
            if not host:
                continue
            # Skip aggregators / social so we land on the company's own site.
            if re.search(r"(linkedin|facebook|twitter|x|instagram|crunchbase|"
                         r"glassdoor|indeed|youtube|wikipedia|zaubacorp|"
                         r"tracxn|bloomberg)\.", host):
                continue
            resolves, has_mx = _dns_status(host)
            if resolves:
                result.update(domain=host, confidence="medium" if has_mx else "low",
                              method="search")
                return result
    except Exception:
        pass

    return result
