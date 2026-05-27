import os
from dotenv import load_dotenv

load_dotenv()

# Cloudflare AI Gateway (every agent routes through here via the
# qampi-deepseek-v4-flash BYOK alias)
CLOUDFLARE_AI_GATEWAY_URL = os.environ.get("CLOUDFLARE_AI_GATEWAY_URL", "")
CF_AIG_TOKEN = os.environ.get("CF_AIG_TOKEN", "")
USE_CLOUDFLARE_GATEWAY = bool(CLOUDFLARE_AI_GATEWAY_URL and CF_AIG_TOKEN)

# Direct DeepSeek fallback (used only if CF gateway is unset)
DEEPSEEK_API_KEY = os.environ.get("DEEPSEEK_API") or os.environ.get("DEEPSEEK_API_KEY", "")
DEEPSEEK_BASE_URL = os.environ.get("DEEPSEEK_BASE_URL", "https://api.deepseek.com")

# Redis-backed strategy cache (was in-memory; survives container restarts)
REDIS_URL = os.environ.get("REDIS_URL", "")
STRATEGY_CACHE_TTL = 86400  # 24 hours

# ---- Single canonical agent config ----
# Every agent uses the same DeepSeek model via the CF gateway. Avoiding the
# previous test/prod + OpenRouter split: one provider, one BYOK alias, no
# review agent (broken on OpenRouter), no separate research agent (the old
# "research" only did a BeautifulSoup scrape — now done inline in the
# orchestrator before agents run).
_DEEPSEEK_MODEL = "deepseek/deepseek-chat"

AGENT_CONFIG = {
    "business_analysis": {
        "model": _DEEPSEEK_MODEL,
        "temperature": 0.5,
        "max_tokens": 800,
        "timeout": 45,
        "prompt_file": "prompts/business_analysis_agent.txt",
        "depends_on": [],
    },
    "competitor_analysis": {
        "model": _DEEPSEEK_MODEL,
        "temperature": 0.4,
        "max_tokens": 1200,
        "timeout": 45,
        "prompt_file": "prompts/competitor_analysis.txt",
        # Independent of business_analysis — the LLM produces competitors
        # primarily from training memory anchored on industry/company in
        # user_input. Letting it run in parallel with business_analysis
        # halves the first-wave latency. Both still feed messaging_strategy.
        "depends_on": [],
    },
    "messaging_strategy": {
        "model": _DEEPSEEK_MODEL,
        "temperature": 0.6,
        "max_tokens": 1000,
        "timeout": 60,
        "prompt_file": "prompts/messaging_strategy.txt",
        "depends_on": ["business_analysis", "competitor_analysis"],
    },
    "synthesizer": {
        "model": _DEEPSEEK_MODEL,
        "temperature": 0.3,
        "max_tokens": 1500,
        "timeout": 60,
        "prompt_file": "prompts/synthesizer.txt",
        "depends_on": ["messaging_strategy"],
    },
}

# Fallback model (used by base.py's JSON-fix retry)
FALLBACK_MODEL = _DEEPSEEK_MODEL
MAX_RETRIES = 3

EXECUTION_ORDER = [
    {"agent": "business_analysis", "depends_on": []},
    {"agent": "competitor_analysis", "depends_on": []},
    {"agent": "messaging_strategy", "depends_on": ["business_analysis", "competitor_analysis"]},
    {"agent": "synthesizer", "depends_on": ["messaging_strategy"]},
]

REQUIRED_SECTIONS = ["gtm", "icp", "messagingPillars", "outreachAngles"]
