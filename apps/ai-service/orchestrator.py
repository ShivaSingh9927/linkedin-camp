import asyncio
import json
import time
import hashlib
from typing import Dict, Any
from openai import OpenAI, RateLimitError, APIConnectionError
from state import StrategyState
from config import EXECUTION_ORDER, AGENT_CONFIG, FALLBACK_MODEL, STRATEGY_CACHE_TTL, USE_CLOUDFLARE_GATEWAY
from fallbacks import FALLBACK_STRATEGY
from validators import validate_strategy
from agents.research import ResearchAgent
from agents.business_analysis import BusinessAnalysisAgent
from agents.competitor_analysis import CompetitorAnalysisAgent
from agents.messaging_strategy import MessagingStrategyAgent
from agents.review import ReviewAgent
from agents.synthesizer import SynthesizerAgent

AGENT_CLASSES = {
    "research": ResearchAgent,
    "business_analysis": BusinessAnalysisAgent,
    "competitor_analysis": CompetitorAnalysisAgent,
    "messaging_strategy": MessagingStrategyAgent,
    "review": ReviewAgent,
    "synthesizer": SynthesizerAgent,
}

AGENT_DELAY = 0.8  # seconds between agent calls to avoid rate limits

# Simple in-memory cache for strategy generation
_strategy_cache: Dict[str, Dict] = {}
_cache_timestamps: Dict[str, float] = {}

def get_cache_key(user_input: Dict[str, Any]) -> str:
    """Generate a cache key from user input."""
    # Use only the fields that affect strategy output
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
    return hashlib.md5(cache_str.encode()).hexdigest()

def get_cached_strategy(cache_key: str) -> Dict:
    """Get strategy from cache if it exists and is not expired."""
    if cache_key in _strategy_cache:
        timestamp = _cache_timestamps.get(cache_key, 0)
        if time.time() - timestamp < STRATEGY_CACHE_TTL:
            print(f"[cache] Hit for key {cache_key[:8]}...")
            return _strategy_cache[cache_key]
        else:
            # Cache expired, remove it
            del _strategy_cache[cache_key]
            del _cache_timestamps[cache_key]
    return None

def cache_strategy(cache_key: str, strategy: Dict):
    """Cache a strategy with timestamp."""
    _strategy_cache[cache_key] = strategy
    _cache_timestamps[cache_key] = time.time()
    print(f"[cache] Stored strategy for key {cache_key[:8]}... (TTL: {STRATEGY_CACHE_TTL}s)")

async def run_with_rate_limit_retry(agent, state, max_retries=3):
    """Run an agent with exponential backoff on rate limit errors."""
    for attempt in range(max_retries):
        try:
            result = await agent.run_with_retry(state)
            return result
        except RateLimitError as e:
            wait_time = (2 ** attempt) * 2  # 2s, 4s, 8s
            print(f"[orchestrator] Rate limit hit on {agent.name}, waiting {wait_time}s...")
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

async def generate_strategy(user_input: Dict[str, Any], client: OpenAI, force_regenerate: bool = False) -> Dict[str, Any]:
    # Check cache first (unless force regenerate)
    if not force_regenerate:
        cache_key = get_cache_key(user_input)
        cached = get_cached_strategy(cache_key)
        if cached:
            return cached
    
    state = StrategyState(user_input=user_input)
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
        
        # Run ready agents sequentially with delay to avoid rate limits
        for step in ready:
            agent_name = step["agent"]
            agent = agents[agent_name]
            
            print(f"[orchestrator] Running {agent_name}...")
            result = await run_with_rate_limit_retry(agent, state)
            
            if result is None:
                # Don't add error for review agent - it's optional
                if agent_name != "review":
                    state.errors.append({"agent": agent_name, "error": "Agent returned None"})
            
            attr_name = agent_name
            if hasattr(state, attr_name):
                setattr(state, attr_name, result)
            
            # Synthesizer result is the final strategy
            if agent_name == "synthesizer" and result:
                state.final_strategy = result
            
            completed.add(agent_name)
            
            # Add delay between agents to avoid rate limits
            if len(completed) < len(EXECUTION_ORDER):
                await asyncio.sleep(AGENT_DELAY)
    
    # Validate final strategy
    strategy_valid = True
    if state.final_strategy:
        is_valid, errors = validate_strategy(state.final_strategy)
        if not is_valid:
            print(f"Strategy validation errors: {errors}")
            strategy_valid = False
    
    # Return strategy if synthesizer succeeded and validation passed
    # Review and competitor_analysis errors don't block the result (synthesizer handles missing data)
    critical_errors = [e for e in state.errors if e.get("agent") not in ("review", "competitor_analysis")]
    
    if state.final_strategy and strategy_valid and not critical_errors:
        # Cache the successful strategy
        if not force_regenerate:
            cache_key = get_cache_key(user_input)
            cache_strategy(cache_key, state.final_strategy)
        return state.final_strategy
    
    # Log non-review errors
    if critical_errors:
        print(f"Critical errors: {json.dumps(critical_errors)}")
    
    # Return fallback only if synthesizer failed
    if not state.final_strategy:
        return FALLBACK_STRATEGY
    
    # Return the strategy even with review issues
    return state.final_strategy
