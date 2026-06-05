import os
from dotenv import load_dotenv

load_dotenv()

# Cloudflare AI Gateway (same pattern as ai-service)
CLOUDFLARE_AI_GATEWAY_URL = os.environ.get("CLOUDFLARE_AI_GATEWAY_URL", "")
CF_AIG_TOKEN = os.environ.get("CF_AIG_TOKEN", "")
USE_CLOUDFLARE_GATEWAY = bool(CLOUDFLARE_AI_GATEWAY_URL and CF_AIG_TOKEN)
CF_BYOK_ALIAS_DEEPSEEK = os.environ.get("CF_BYOK_ALIAS_DEEPSEEK", "qampi-deepseek-v4-flash")

# Direct DeepSeek fallback
DEEPSEEK_API_KEY = os.environ.get("DEEPSEEK_API_KEY") or os.environ.get("DEEPSEEK_API", "")
DEEPSEEK_BASE_URL = os.environ.get("DEEPSEEK_BASE_URL", "https://api.deepseek.com")

# Reacher SMTP verification sidecar
REACHER_URL = os.environ.get("REACHER_URL", "http://localhost:8080")

# Research-agent (Lightpanda web search)
RESEARCH_AGENT_URL = os.environ.get("RESEARCH_AGENT_URL", "http://localhost:3012")

# Timeout for LLM HTTP calls
LLM_HTTP_TIMEOUT = float(os.environ.get("LLM_HTTP_TIMEOUT_SECONDS", "60"))

# DeepSeek model name
DEEPSEEK_MODEL = "deepseek/deepseek-chat"
