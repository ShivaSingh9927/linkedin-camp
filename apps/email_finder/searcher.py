"""
Email-format discovery via crawl4ai.

Replaces the previous research-agent round-trip (which used Lightpanda and
hung on JS-heavy pages). We now:
  1. Search DuckDuckGo HTML for the company's email format (no JS, plain
     httpx + BeautifulSoup, ~1s).
  2. Use crawl4ai to scrape the company's own /team, /about, /contact
     pages in parallel (browser-based, JS-aware, no Lightpanda).
  3. Regex-extract real employee emails from the rendered markdown.
  4. Fall back to web search results if own-site pages come up empty.

The research-agent + Lightpanda path is still available via
`RESEARCH_AGENT_URL` and is untouched in research-agent; we just don't
call it from here anymore. To re-enable, swap `search_email_format` →
`search_email_format_via_research_agent` in main.py.
"""
from __future__ import annotations

import asyncio
import re
from typing import Optional
from urllib.parse import urlparse

import httpx
from bs4 import BeautifulSoup

try:
    from crawl4ai import AsyncWebCrawler, BrowserConfig, CrawlerRunConfig, CacheMode
except Exception:  # crawl4ai not installed (e.g. when running unit tests)
    AsyncWebCrawler = None

# --- constants ---------------------------------------------------------------

OWN_PAGES = [
    "/team",
    "/about",
    "/about-us",
    "/contact",
    "/contact-us",
    "/team.html",
    "/people",
    "/leadership",
    "/",
]

PERSONAL_EMAIL_RE = re.compile(r"[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}", re.IGNORECASE)
PUBLIC_PROVIDER_RE = re.compile(
    r"@(gmail|yahoo|outlook|hotmail|protonmail|icloud|aol|live|me|mac)\.", re.IGNORECASE
)
ROLE_PREFIXES_RE = re.compile(
    r"^(info|contact|hello|hi|support|sales|admin|office|help|"
    r"customerservice|cs|press|media|marketing|noreply|no-reply|"
    r"hr|careers|jobs|team|general|enquiries|enquiry|feedback|"
    r"abuse|postmaster|root|webmaster|legal|billing)@",
    re.IGNORECASE,
)
SERP_HOSTS_RE = re.compile(
    r"(^|\.)(duckduckgo\.com|google\.[a-z.]+|bing\.com|search\.brave\.com|"
    r"startpage\.com|yandex\.[a-z.]+|baidu\.com|sogou\.com)$",
    re.IGNORECASE,
)
DDG_HTML = "https://html.duckduckgo.com/html/"

# Hard wall-clock cap for the whole search_email_format call. We aim for
# ~15s on the happy path; this is the kill switch.
DEADLINE_S = 18.0
# Per-page fetch timeout inside crawl4ai.
PAGE_TIMEOUT_S = 8.0


# --- search-engine (DuckDuckGo HTML) ----------------------------------------

def _ddg_search(query: str, max_results: int = 8, timeout: float = 5.0) -> list[str]:
    """Plain-httpx DuckDuckGo HTML search. Returns a list of result URLs."""
    try:
        with httpx.Client(
            timeout=timeout,
            follow_redirects=True,
            headers={"User-Agent": "Mozilla/5.0 (compatible; email-finder/1.0)"},
        ) as client:
            r = client.post(DDG_HTML, data={"q": query})
            r.raise_for_status()
    except Exception:
        return []

    soup = BeautifulSoup(r.text, "html.parser")
    urls: list[str] = []
    for a in soup.select("a.result__a, a.result__url"):
        href = a.get("href", "")
        if not href:
            continue
        # DDG wraps external links in a /l/?uddg= redirect — unwrap.
        if "uddg=" in href:
            try:
                parsed = httpx.URL("https://duckduckgo.com" + href if href.startswith("/") else href)
                unwrapped = parsed.params.get("uddg")
                if unwrapped:
                    href = unwrapped
            except Exception:
                pass
        host = urlparse(href).hostname.lower() if href else ""
        if not host or SERP_HOSTS_RE.match(host):
            continue
        if href not in urls:
            urls.append(href)
        if len(urls) >= max_results:
            break
    return urls


# --- crawl4ai ----------------------------------------------------------------

async def _crawl_many(urls: list[str], deadline_at: float) -> dict[str, str]:
    """Crawl all urls concurrently with crawl4ai. Returns {url: markdown}."""
    if AsyncWebCrawler is None:
        raise RuntimeError("crawl4ai is not installed")
    if not urls:
        return {}

    browser_cfg = BrowserConfig(headless=True, verbose=False)
    run_cfg = CrawlerRunConfig(
        cache_mode=CacheMode.BYPASS,
        page_timeout=PAGE_TIMEOUT_S * 1000,  # ms
        wait_until="domcontentloaded",
        # Skip slow resources
        exclude_external_links=True,
        exclude_social_media_links=True,
    )

    remaining = max(1.0, deadline_at - asyncio.get_event_loop().time())
    results: dict[str, str] = {}
    async with AsyncWebCrawler(config=browser_cfg) as crawler:
        # crawl4ai arun_many is the parallel path. If unavailable, fall
        # back to sequential arun.
        try:
            crawl_results = await asyncio.wait_for(
                crawler.arun_many(urls=urls, config=run_cfg),
                timeout=remaining,
            )
        except (asyncio.TimeoutError, AttributeError):
            crawl_results = []
            for u in urls:
                if asyncio.get_event_loop().time() >= deadline_at:
                    break
                try:
                    res = await asyncio.wait_for(
                        crawler.arun(url=u, config=run_cfg),
                        timeout=PAGE_TIMEOUT_S,
                    )
                    crawl_results.append(res)
                except Exception:
                    crawl_results.append(None)
        for u, res in zip(urls, crawl_results):
            if res is None:
                continue
            md = ""
            try:
                if hasattr(res, "markdown"):
                    md_obj = res.markdown
                    md = getattr(md_obj, "raw_markdown", None) or (
                        md_obj if isinstance(md_obj, str) else ""
                    )
            except Exception:
                pass
            if not md and hasattr(res, "html"):
                md = res.html or ""
            if md:
                results[u] = md
    return results


# --- email extraction --------------------------------------------------------

def _extract_company_emails(markdown: str, own_hostname: str) -> list[str]:
    """Return personal emails matching the company's hostname, with
    role-based and generic provider addresses filtered out. We also
    drop privacy-redacted aggregator samples (e.g. `n@nanospan.com` on
    NeverBounce/RocketReach — single-letter local-parts are not real
    patterns)."""
    out: list[str] = []
    for raw in PERSONAL_EMAIL_RE.findall(markdown or ""):
        e = raw.lower()
        if PUBLIC_PROVIDER_RE.search(e):
            continue
        if ROLE_PREFIXES_RE.match(e):
            continue
        if not (e.endswith(f"@{own_hostname}") or e.endswith(f".{own_hostname}")):
            continue
        local = e.split("@", 1)[0]
        # Skip privacy-redacted aggregator addresses: single letter, or
        # letter + dot/underscore, etc. We require either a multi-letter
        # local-part (>=3 chars) or a dot/underscore separator that
        # indicates a real firstname+lastname format.
        if "." not in local and "_" not in local and "-" not in local:
            if len(local) < 4:  # `n@`, `ab@`, `jdoe@` is OK (flast = 4+)
                continue
        if e not in out:
            out.append(e)
    return out


# --- main entry point --------------------------------------------------------

async def search_email_format(
    domain: str,
    search_prompt: Optional[str] = None,
    timeout: float = DEADLINE_S,
) -> dict:
    """
    Find the email pattern for `domain` by scraping its own website first,
    then falling back to DuckDuckGo results.

    Returns dict shaped for the existing main.py consumer:
        {
          "domain": str,
          "query": str,
          "sampleEmails": [str, ...],
          "patterns": [str, ...],   # placeholder pattern strings
          "fallbackUsed": bool,
          "webSearchUsed": bool,
          "mxProvider": str|None,
          "mxHosts": [str, ...],
          "sources": [{"url": str, "title": str}],
          "stats": {...},
        }
    """
    import time
    from dns import resolver as dns_resolver

    started = time.time()
    deadline_at = started + timeout
    own_hostname = domain.lower()

    sample_emails: list[str] = []
    sources: list[dict] = []
    web_search_used = False
    own_pages_tried = 0
    web_pages_tried = 0

    # ---- Step 1: own-website pages (crawl4ai, parallel) ----
    own_urls = [f"https://{own_hostname}{p}" for p in OWN_PAGES]
    try:
        own_results = await _crawl_many(own_urls, deadline_at=deadline_at)
        own_pages_tried = len(own_urls)
        for url, md in own_results.items():
            sources.append({"url": url, "title": ""})
            for e in _extract_company_emails(md, own_hostname):
                if e not in sample_emails:
                    sample_emails.append(e)
                if len(sample_emails) >= 8:
                    break
            if len(sample_emails) >= 2:
                break  # good enough, skip web search
    except Exception as e:
        sources.append({"url": "", "title": f"own-site error: {e}"})

    # ---- Step 2: web search fallback (DuckDuckGo HTML + crawl4ai) ----
    if len(sample_emails) < 2 and asyncio.get_event_loop().time() < deadline_at:
        web_search_used = True
        query = search_prompt or f"{domain} employee email format"
        # Run DDG in a thread to keep the event loop free
        loop = asyncio.get_event_loop()
        try:
            hits = await asyncio.wait_for(
                loop.run_in_executor(None, _ddg_search, query, 6),
                timeout=4.0,
            )
        except Exception:
            hits = []
        if hits:
            try:
                web_results = await _crawl_many(hits, deadline_at=deadline_at)
                web_pages_tried = len(hits)
                for url, md in web_results.items():
                    sources.append({"url": url, "title": ""})
                    for e in _extract_company_emails(md, own_hostname):
                        if e not in sample_emails:
                            sample_emails.append(e)
                        if len(sample_emails) >= 8:
                            break
            except Exception:
                pass

    # ---- Step 3: DNS MX for fallback pattern inference ----
    mx_provider = None
    mx_hosts: list[str] = []
    try:
        records = dns_resolver.resolve(domain, "MX")
        mx_hosts = sorted(
            [(r.preference, r.exchange.to_text().rstrip(".")) for r in records],
            key=lambda x: x[0],
        )
        mx_hosts = [h for _, h in mx_hosts]
        joined = " ".join(mx_hosts).lower()
        if "outlook.com" in joined or "protection.outlook.com" in joined:
            mx_provider = "microsoft365"
        elif "google.com" in joined or "googlemail.com" in joined:
            mx_provider = "google"
        elif "zoho." in joined:
            mx_provider = "zoho"
        elif "protonmail" in joined:
            mx_provider = "proton"
        elif "pphosted.com" in joined:
            mx_provider = "proofpoint"
        elif "mimecast" in joined:
            mx_provider = "mimecast"
        elif "barracuda" in joined:
            mx_provider = "barracuda"
        elif "messaging.microsoft" in joined or "frontbridge" in joined:
            mx_provider = "microsoft365-legacy"
    except Exception:
        pass

    # ---- Step 4: derive patterns from samples or provider default ----
    patterns: list[str] = []
    fallback_used = False
    if sample_emails:
        # Cheap deterministic pattern inference — we still pass them to the
        # LLM in guesser.py for ranking, but the placeholder strings here
        # are what gets used for the actual email construction.
        patterns = _infer_patterns_from_samples(sample_emails, own_hostname)
    if not patterns:
        fallback_used = True
        patterns = _default_patterns_for_provider(mx_provider)

    elapsed = int((time.time() - started) * 1000)
    return {
        "domain": domain,
        "query": search_prompt or f"{domain} employee email format",
        "sampleEmails": sample_emails,
        "patterns": patterns,
        "fallbackUsed": fallback_used,
        "webSearchUsed": web_search_used,
        "mxProvider": mx_provider,
        "mxHosts": mx_hosts,
        "sources": sources[:8],
        "stats": {
            "ownPagesTried": own_pages_tried,
            "webPagesTried": web_pages_tried,
            "sampleEmailsFound": len(sample_emails),
            "patternsInferred": len(patterns) if not fallback_used else 0,
            "fallbackPatternsUsed": len(patterns) if fallback_used else 0,
            "elapsedMs": elapsed,
        },
    }


def _infer_patterns_from_samples(emails: list[str], own_hostname: str) -> list[str]:
    """Look at the local-parts of `emails` and figure out the placeholder
    pattern. Limited to the 6 most common corporate variants — the LLM
    ranker in main.py will pick the best one for the actual candidate.
    """
    if not emails:
        return []
    local_parts = [e.split("@", 1)[0] for e in emails]
    counts = {
        "f.last": 0,        # jane.doe
        "first": 0,         # jane
        "flast": 0,         # jdoe
        "firstlast": 0,     # janedoe
        "first.l": 0,       # jane.d
        "lastf": 0,         # doej
        "f_last": 0,        # j_doe
        "first_last": 0,    # jane_doe
        "last.first": 0,    # doe.jane
        "lfirst": 0,        # djanedoe
    }
    for lp in local_parts:
        lp_n = lp.replace(".", "").replace("_", "").replace("-", "")
        if "." in lp:
            parts = lp.split(".")
            if len(parts) == 2 and parts[0] and parts[1]:
                counts["f.last"] += 1
                if len(parts[0]) == 1:
                    counts["flast"] += 1
                if len(parts[1]) == 1:
                    counts["first.l"] += 1
        elif "_" in lp:
            parts = lp.split("_")
            if len(parts) == 2 and parts[0] and parts[1]:
                counts["first_last"] += 1
                if len(parts[0]) == 1:
                    counts["f_last"] += 1
        elif len(lp) <= 8 and not any(c.isdigit() for c in lp):
            # could be `first` (just first name) or `flast` (initial+last)
            # we keep it ambiguous; LLM ranker disambiguates
            counts["first"] += 1
        else:
            # longer single token → likely firstlast
            counts["firstlast"] += 1

    # Return top 3 by frequency, mapped to placeholder strings.
    placeholder_map = {
        "f.last": "{{first}}.{{last}}",
        "first": "{{first}}",
        "flast": "{{f}}{{last}}",
        "firstlast": "{{first}}{{last}}",
        "first.l": "{{first}}.{{l}}",
        "lastf": "{{last}}{{f}}",
        "f_last": "{{f}}_{{last}}",
        "first_last": "{{first}}_{{last}}",
        "last.first": "{{last}}.{{first}}",
        "lfirst": "{{l}}{{first}}",
    }
    ranked = sorted(counts.items(), key=lambda x: -x[1])
    out = []
    for key, n in ranked:
        if n == 0:
            continue
        if placeholder_map[key] not in out:
            out.append(placeholder_map[key])
        if len(out) >= 3:
            break
    return out


def _default_patterns_for_provider(mx_provider: Optional[str]) -> list[str]:
    if mx_provider in ("microsoft365", "microsoft365-legacy", "google", "barracuda"):
        return ["{{first}}.{{last}}", "{{first}}{{last}}", "{{f}}{{last}}"]
    if mx_provider in ("zoho", "proton"):
        return ["{{first}}.{{last}}", "{{first}}.{{l}}", "{{f}}{{last}}"]
    if mx_provider in ("proofpoint", "mimecast"):
        # Catch-all territory — SMTP verification is unreliable, so the
        # research-agent path is the source of truth.
        return ["{{first}}.{{last}}", "{{first}}", "{{f}}{{last}}"]
    # Unknown / custom — generic top-3 industry defaults
    return ["{{first}}.{{last}}", "{{first}}", "{{f}}{{last}}"]


# --- legacy Lightpanda-based path (kept for reference / future use) ---------

async def search_email_format_via_research_agent(
    domain: str,
    search_prompt: Optional[str] = None,
    timeout: float = 30.0,
) -> dict:
    """Calls the existing Node.js research-agent. Lightpanda-based; slower
    and prone to hangs on JS-heavy pages. Kept for fallback; not used
    by default. Set `RESEARCH_AGENT_URL` to enable.
    """
    from config import RESEARCH_AGENT_URL

    if not RESEARCH_AGENT_URL:
        return {"error": "RESEARCH_AGENT_URL not configured"}
    payload = {"domain": domain, "search_prompt": search_prompt or ""}
    async with httpx.AsyncClient(timeout=timeout) as client:
        r = await client.post(f"{RESEARCH_AGENT_URL}/research/email-format", json=payload)
        r.raise_for_status()
        return r.json()
