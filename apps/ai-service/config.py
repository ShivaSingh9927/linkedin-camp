import os
from dotenv import load_dotenv

load_dotenv()

# Cloudflare AI Gateway Configuration
CLOUDFLARE_AI_GATEWAY_URL = os.environ.get("CLOUDFLARE_AI_GATEWAY_URL", "")
CF_AIG_TOKEN = os.environ.get("CF_AIG_TOKEN", "")
USE_CLOUDFLARE_GATEWAY = bool(CLOUDFLARE_AI_GATEWAY_URL and CF_AIG_TOKEN)

# DeepSeek configuration (for direct fallback)
DEEPSEEK_API_KEY = os.environ.get("DEEPSEEK_API", "")  # using existing DEEPSEEK_API from .env
DEEPSEEK_BASE_URL = os.environ.get("DEEPSEEK_BASE_URL", "https://api.deepseek.com")

# Strategy Cache Configuration
STRATEGY_CACHE_TTL = 86400  # 24 hours in seconds

# Model selection mode: "test" (OpenRouter free) or "production" (OpenRouter non-free or DeepSeek)
AI_MODE = os.environ.get("AI_MODE", "production")  # default to production

# Test configuration: OpenRouter free tier models
TEST_AGENT_CONFIG = {
    "research": {
        "model": "openrouter/deepseek/deepseek-chat:free",
        "temperature": 0.3,
        "max_tokens": 800,
        "timeout": 30,
        "prompt_file": "prompts/research_agent.txt",
        "depends_on": [],
    },
    "business_analysis": {
        "model": "openrouter/deepseek/deepseek-chat:free",
        "temperature": 0.5,
        "max_tokens": 800,
        "timeout": 45,
        "prompt_file": "prompts/business_analysis_agent.txt",
        "depends_on": [],
    },
    "competitor_analysis": {
        "model": "openrouter/deepseek/deepseek-v4-flash:free",
        "temperature": 0.4,
        "max_tokens": 1200,
        "timeout": 45,
        "prompt_file": "prompts/competitor_analysis.txt",
        "depends_on": ["business_analysis"],
    },
    "messaging_strategy": {
        "model": "openrouter/deepseek/deepseek-chat:free",
        "temperature": 0.6,
        "max_tokens": 1000,
        "timeout": 60,
        "prompt_file": "prompts/messaging_strategy.txt",
        "depends_on": ["research", "business_analysis", "competitor_analysis"],
    },
    "review": {
        "model": "openrouter/openai/gpt-oss-20b:free",
        "temperature": 0.2,
        "max_tokens": 500,
        "timeout": 30,
        "prompt_file": "prompts/review_agent.txt",
        "depends_on": ["messaging_strategy"],
    },
    "synthesizer": {
        "model": "openrouter/deepseek/deepseek-chat:free",
        "temperature": 0.3,
        "max_tokens": 1500,
        "timeout": 60,
        "prompt_file": "prompts/synthesizer.txt",
        "depends_on": ["review", "messaging_strategy"],
    },
}

# Production configuration: OpenRouter non-free models (since DeepSeek BYOK is not working)
PROD_AGENT_CONFIG = {
    "research": {
        "model": "openrouter/deepseek/deepseek-chat",
        "temperature": 0.3,
        "max_tokens": 800,
        "timeout": 30,
        "prompt_file": "prompts/research_agent.txt",
        "depends_on": [],
    },
    "business_analysis": {
        "model": "openrouter/deepseek/deepseek-chat",
        "temperature": 0.5,
        "max_tokens": 800,
        "timeout": 45,
        "prompt_file": "prompts/business_analysis_agent.txt",
        "depends_on": [],
    },
    "competitor_analysis": {
        "model": "openrouter/deepseek/deepseek-v4-flash",
        "temperature": 0.4,
        "max_tokens": 1200,
        "timeout": 45,
        "prompt_file": "prompts/competitor_analysis.txt",
        "depends_on": ["business_analysis"],
    },
    "messaging_strategy": {
        "model": "openrouter/deepseek/deepseek-chat",
        "temperature": 0.6,
        "max_tokens": 1000,
        "timeout": 60,
        "prompt_file": "prompts/messaging_strategy.txt",
        "depends_on": ["research", "business_analysis", "competitor_analysis"],
    },
    "review": {
        "model": "openrouter/openai/gpt-oss-20b",
        "temperature": 0.2,
        "max_tokens": 500,
        "timeout": 30,
        "prompt_file": "prompts/review_agent.txt",
        "depends_on": ["messaging_strategy"],
    },
    "synthesizer": {
        "model": "openrouter/deepseek/deepseek-chat",
        "temperature": 0.3,
        "max_tokens": 1500,
        "timeout": 60,
        "prompt_file": "prompts/synthesizer.txt",
        "depends_on": ["review", "messaging_strategy"],
    },
}

# Select configuration based on AI_MODE
if AI_MODE == "test":
    AGENT_CONFIG = TEST_AGENT_CONFIG
else:
    AGENT_CONFIG = PROD_AGENT_CONFIG

# Fallback model (used if all agents fail)
FALLBACK_MODEL = "openrouter/openai/gpt-oss-20b" if AI_MODE == "production" else "openrouter/openai/gpt-oss-20b:free"
MAX_RETRIES = 3

EXECUTION_ORDER = [
    {"agent": "research", "depends_on": []},
    {"agent": "business_analysis", "depends_on": []},
    {"agent": "competitor_analysis", "depends_on": ["business_analysis"]},
    {"agent": "messaging_strategy", "depends_on": ["research", "business_analysis", "competitor_analysis"]},
    {"agent": "review", "depends_on": ["messaging_strategy"]},
    {"agent": "synthesizer", "depends_on": ["review", "messaging_strategy"]},
]

REQUIRED_SECTIONS = ["gtm", "icp", "messagingPillars", "outreachAngles"]