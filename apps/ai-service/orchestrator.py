import asyncio
import json
import hashlib
from typing import Dict, Any, Optional
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


async def _inline_research(user_input: Dict[str, Any]) -> Dict:
    """Replaces the deleted ResearchAgent: a BeautifulSoup scrape merged with
    user-provided fields. No LLM call — there was never one here, just agent
    ceremony around a synchronous scrape."""
    website_url = user_input.get("website", "")
    if website_url:
        result = await scrape_website(website_url)
    else:
        result = {
            "companyDescription": user_input.get("companyDescription"),
            "products": [],
            "targetMarket": user_input.get("targetAudience"),
            "marketPositioning": None,
        }
    # Merge user-provided overrides on top of scrape
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

        for step in ready:
            agent_name = step["agent"]
            agent = agents[agent_name]
            print(f"[orchestrator] Running {agent_name}...")
            result = await run_with_rate_limit_retry(agent, state)

            if result is None:
                state.errors.append({"agent": agent_name, "error": "Agent returned None"})

            if hasattr(state, agent_name):
                setattr(state, agent_name, result)

            if agent_name == "synthesizer" and result:
                state.final_strategy = result

            completed.add(agent_name)
            if len(completed) < len(EXECUTION_ORDER):
                await asyncio.sleep(AGENT_DELAY)

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
