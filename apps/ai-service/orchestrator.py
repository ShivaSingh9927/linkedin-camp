import asyncio
import json
import hashlib
import os
from typing import Dict, Any, Optional

import httpx
from openai import OpenAI, RateLimitError, APIConnectionError

from state import StrategyState
from config import (
    EXECUTION_ORDER,
    AGENT_CONFIG,
    STRATEGY_CACHE_TTL,
    REDIS_URL,
)
from fallbacks import FALLBACK_STRATEGY
from validators import validate_strategy
from agents.business_analysis import BusinessAnalysisAgent
from agents.competitor_analysis import CompetitorAnalysisAgent
from agents.messaging_strategy import MessagingStrategyAgent
from agents.synthesizer import SynthesizerAgent
from tools.web_scraper import scrape_website

AGENT_CLASSES = {
    "business_analysis": BusinessAnalysisAgent,
    "competitor_analysis": CompetitorAnalysisAgent,
    "messaging_strategy": MessagingStrategyAgent,
    "synthesizer": SynthesizerAgent,
}

AGENT_DELAY = 0.8  # gap between sequential agent calls to soften rate limits

# ---- Redis-backed strategy cache ----
# Replaces the previous in-memory dict so generated strategies survive
# container restarts (a 2-minute pipeline run is expensive; losing it on
# every deploy was wasteful).

_redis_client = None

def _get_redis():
    global _redis_client
    if _redis_client is not None:
        return _redis_client
    if not REDIS_URL:
        return None
    try:
        import redis  # type: ignore
        _redis_client = redis.from_url(REDIS_URL, socket_connect_timeout=2, socket_timeout=2)
        # Ping to fail fast if Redis is unreachable
        _redis_client.ping()
        print(f"[cache] Redis connected at {REDIS_URL}")
        return _redis_client
    except Exception as e:
        print(f"[cache] Redis unavailable, falling back to no cache: {e}")
        _redis_client = None
        return None


def get_cache_key(user_input: Dict[str, Any]) -> str:
    """Hash only the fields that affect strategy output."""
    cache_fields = {
        "company": user_input.get("company", ""),
        "industry": user_input.get("industry", ""),
        "persona": user_input.get("persona", ""),
        "valueProp": user_input.get("valueProp", ""),
        "targetAudience": user_input.get("targetAudience", ""),
        "mainPainPoint": user_input.get("mainPainPoint", ""),
        "companyDescription": user_input.get("companyDescription", ""),
        "products": user_input.get("products", ""),
        "differentiators": user_input.get("differentiators", ""),
        "caseStudies": user_input.get("caseStudies", ""),
        "communicationStyle": user_input.get("communicationStyle", ""),
    }
    cache_str = json.dumps(cache_fields, sort_keys=True)
    return "strategy_cache:" + hashlib.md5(cache_str.encode()).hexdigest()


def get_cached_strategy(cache_key: str) -> Optional[Dict]:
    r = _get_redis()
    if not r:
        return None
    try:
        raw = r.get(cache_key)
        if raw:
            print(f"[cache] Hit for key {cache_key[-8:]}")
            return json.loads(raw)
    except Exception as e:
        print(f"[cache] Read failed: {e}")
    return None


def cache_strategy(cache_key: str, strategy: Dict):
    r = _get_redis()
    if not r:
        return
    try:
        r.set(cache_key, json.dumps(strategy), ex=STRATEGY_CACHE_TTL)
        print(f"[cache] Stored strategy for key {cache_key[-8:]} (TTL: {STRATEGY_CACHE_TTL}s)")
    except Exception as e:
        print(f"[cache] Write failed: {e}")


async def run_with_rate_limit_retry(agent, state, max_retries=3):
    """Run an agent with exponential backoff on rate limit errors."""
    for attempt in range(max_retries):
        try:
            return await agent.run_with_retry(state)
        except RateLimitError:
            wait_time = (2 ** attempt) * 2
            print(f"[orchestrator] Rate limit on {agent.name}, waiting {wait_time}s...")
            await asyncio.sleep(wait_time)
            if attempt == max_retries - 1:
                state.errors.append({"agent": agent.name, "error": "Rate limit exceeded"})
                return None
        except APIConnectionError as e:
            print(f"[orchestrator] Connection error on {agent.name}: {e}")
            state.errors.append({"agent": agent.name, "error": str(e)})
            return None
        except Exception as e:
            state.errors.append({"agent": agent.name, "error": str(e)})
            return None
    return None


RESEARCH_AGENT_URL = os.environ.get("RESEARCH_AGENT_URL", "http://research-agent:8002")
RESEARCH_AGENT_TIMEOUT = float(os.environ.get("RESEARCH_AGENT_TIMEOUT", "180"))


async def _call_research_agent(website: str, industry: str, company: str) -> Optional[Dict]:
    """Call the Node sidecar (apps/research-agent) which scrapes the website
    with Lightpanda, derives competitor search queries from the homepage,
    scrapes each competitor's site, and returns a structured landscape.

    Returns None on any failure — the orchestrator falls back to the BS4
    scrape so a research-agent outage never kills strategy gen."""
    payload = {"website": website, "industry": industry or "", "company": company or ""}
    try:
        async with httpx.AsyncClient(timeout=RESEARCH_AGENT_TIMEOUT) as client:
            r = await client.post(f"{RESEARCH_AGENT_URL}/research/competitive-landscape", json=payload)
            if r.status_code != 200:
                print(f"[orchestrator] research-agent {r.status_code}: {r.text[:200]}")
                return None
            return r.json()
    except Exception as e:
        print(f"[orchestrator] research-agent unreachable: {e}")
        return None


async def _inline_research(user_input: Dict[str, Any]) -> Dict:
    """Returns the research-output dict consumed by business_analysis (and now
    competitor_analysis) prompts.

    Order of preference:
      1. Node research-agent sidecar — Lightpanda scrape + LLM synthesis of
         the user's own site, derived competitor queries, and short
         {name, url, positioning, strengths, weaknesses} per competitor.
      2. BeautifulSoup scrape — fallback when the sidecar is unreachable or
         no website is configured.

    User-provided BusinessProfile fields always override scraped values."""
    website_url = user_input.get("website", "")
    result: Dict[str, Any] = {
        "companyDescription": user_input.get("companyDescription"),
        "products": [],
        "targetMarket": user_input.get("targetAudience"),
        "marketPositioning": None,
        "competitors": [],
    }

    if website_url:
        landscape = await _call_research_agent(
            website_url,
            user_input.get("industry", ""),
            user_input.get("company", ""),
        )
        if landscape and isinstance(landscape, dict) and landscape.get("ownSite"):
            own = landscape["ownSite"]
            result["marketPositioning"] = own.get("positioning") or result["marketPositioning"]
            result["productCategory"] = own.get("productCategory") or ""
            result["mainKeywords"] = own.get("mainKeywords") or []
            result["competitors"] = landscape.get("competitors") or []
            result["researchStats"] = landscape.get("stats") or {}
            result["fromCache"] = landscape.get("fromCache", False)
            print(
                f"[orchestrator] research-agent ok "
                f"(competitors={len(result['competitors'])}, "
                f"cache={'hit' if result['fromCache'] else 'miss'})"
            )
        else:
            # Sidecar unreachable or returned nothing useful — fall back to
            # the in-process BS4 scrape so we still feed business_analysis
            # something better than user_input alone.
            print("[orchestrator] research-agent fallback: BS4 scrape")
            scrape = await scrape_website(website_url)
            result.update({k: v for k, v in scrape.items() if v})

    # User-provided BusinessProfile fields always win.
    if user_input.get("companyDescription"):
        result["companyDescription"] = user_input["companyDescription"]
    if user_input.get("products"):
        result["products"] = (
            user_input["products"].split(",")
            if isinstance(user_input["products"], str)
            else user_input["products"]
        )
    if user_input.get("targetAudience"):
        result["targetMarket"] = user_input["targetAudience"]
    return result


async def generate_strategy(user_input: Dict[str, Any], client: OpenAI, force_regenerate: bool = False) -> Dict[str, Any]:
    # Cache hit?
    cache_key = get_cache_key(user_input)
    if not force_regenerate:
        cached = get_cached_strategy(cache_key)
        if cached:
            return cached

    state = StrategyState(user_input=user_input)

    # Inline website research (formerly the ResearchAgent — pure BeautifulSoup)
    state.research_output = await _inline_research(user_input)
    print(f"[orchestrator] Research complete (website={'yes' if user_input.get('website') else 'no'})")

    agents = {name: cls(name, AGENT_CONFIG[name], client) for name, cls in AGENT_CLASSES.items()}
    completed = set()

    while len(completed) < len(EXECUTION_ORDER):
        ready = [
            step for step in EXECUTION_ORDER
            if step["agent"] not in completed
            and all(d in completed for d in step["depends_on"])
        ]
        if not ready:
            break

        # Run every agent in this wave concurrently. asyncio.gather schedules
        # them all on the event loop; LLM time dominates and they don't share
        # mutable state writes (each agent writes only to its own slot on
        # `state`). Was a sequential for-loop with AGENT_DELAY sleeps; that
        # latency was pure waste once we moved everything to DeepSeek (no
        # cross-provider rate-limit contention).
        names = [step["agent"] for step in ready]
        print(f"[orchestrator] Running wave: {', '.join(names)}")
        results = await asyncio.gather(
            *(run_with_rate_limit_retry(agents[n], state) for n in names),
            return_exceptions=False,
        )

        for agent_name, result in zip(names, results):
            if result is None:
                state.errors.append({"agent": agent_name, "error": "Agent returned None"})

            if hasattr(state, agent_name):
                setattr(state, agent_name, result)

            if agent_name == "synthesizer" and result:
                state.final_strategy = result

            completed.add(agent_name)

    # Validate final strategy
    strategy_valid = True
    if state.final_strategy:
        is_valid, errors = validate_strategy(state.final_strategy)
        if not is_valid:
            print(f"Strategy validation errors: {errors}")
            strategy_valid = False

    # competitor_analysis errors don't block (synthesizer can fill gaps)
    critical_errors = [e for e in state.errors if e.get("agent") not in ("competitor_analysis",)]

    if state.final_strategy and strategy_valid and not critical_errors:
        if not force_regenerate:
            cache_strategy(cache_key, state.final_strategy)
        return state.final_strategy

    if critical_errors:
        print(f"Critical errors: {json.dumps(critical_errors)}")

    if not state.final_strategy:
        return FALLBACK_STRATEGY

    return state.final_strategy
