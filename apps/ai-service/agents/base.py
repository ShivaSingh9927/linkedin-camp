import os
import json
import re
import asyncio
from typing import Dict, Any, Optional
from openai import OpenAI, RateLimitError, APIConnectionError
from state import StrategyState
from config import USE_CLOUDFLARE_GATEWAY, CLOUDFLARE_AI_GATEWAY_URL, CF_AIG_TOKEN

class BaseAgent:
    def __init__(self, name: str, config: dict, client: OpenAI):
        self.name = name
        self.config = config
        self.client = client
        self.base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    
    def resolve_prompt_file(self, goal_type: Optional[str]) -> str:
        """Pick the prompt file for this agent given the user's goal.

        Default (goal_type falsy or 'sell') uses the flat prompts/<agent>.txt
        — the original B2B-sales framing, so existing users are untouched.
        Any other goal (e.g. 'job_seeking') looks for a per-goal override at
        prompts/<goal_type>/<basename>; if that file doesn't exist we fall back
        to the default. This lets us add one goal at a time without writing a
        full prompt set for every agent up front."""
        default_rel = self.config["prompt_file"]
        if goal_type and goal_type != "sell":
            basename = os.path.basename(default_rel)
            override_abs = os.path.join(self.base_dir, "prompts", goal_type, basename)
            if os.path.exists(override_abs):
                return override_abs
        return os.path.join(self.base_dir, default_rel)

    # Per-goal system roles. The big task framing lives in the prompt files;
    # this just keeps the one-line role from contradicting the goal. Falls
    # back to the sales role for any goal without an explicit entry.
    SYSTEM_ROLES = {
        "job_seeking": {
            "business_analysis": "You are a senior career strategist who positions candidates for their target roles. Return ONLY valid JSON.",
            "competitor_analysis": "You are a career-market analyst mapping the competitive landscape a candidate faces. Return ONLY valid JSON.",
            "messaging_strategy": "You are a senior career coach and personal-branding strategist who has helped 100+ professionals land roles through LinkedIn outreach. Return ONLY valid JSON.",
            "synthesizer": "You are a technical writer. Return ONLY valid JSON.",
        },
        "recruiting": {
            "business_analysis": "You are a senior talent strategist who assesses how attractive a hiring opportunity is to candidates. Return ONLY valid JSON.",
            "competitor_analysis": "You are a talent-market analyst mapping the employers competing for the same candidates. Return ONLY valid JSON.",
            "messaging_strategy": "You are a senior talent-sourcing strategist who has run outbound recruiting for 100+ roles. Return ONLY valid JSON.",
            "synthesizer": "You are a technical writer. Return ONLY valid JSON.",
        },
        "fundraising": {
            "business_analysis": "You are a startup fundraising advisor who frames a company's investment thesis for investors. Return ONLY valid JSON.",
            "competitor_analysis": "You are a venture-market analyst mapping comparable companies and how investors evaluate them. Return ONLY valid JSON.",
            "messaging_strategy": "You are a fundraising strategist who has helped founders run 100+ investor outreach campaigns on LinkedIn. Return ONLY valid JSON.",
            "synthesizer": "You are a technical writer. Return ONLY valid JSON.",
        },
        "networking": {
            "business_analysis": "You are a personal-brand strategist who positions professionals to build influence and relationships. Return ONLY valid JSON.",
            "competitor_analysis": "You are a community-landscape analyst mapping the people and voices in a professional's target space. Return ONLY valid JSON.",
            "messaging_strategy": "You are a relationship-building and personal-branding strategist who has helped 100+ professionals grow their network on LinkedIn. Return ONLY valid JSON.",
            "synthesizer": "You are a technical writer. Return ONLY valid JSON.",
        },
    }

    def system_role(self, goal_type: Optional[str], default: str) -> str:
        if goal_type and goal_type in self.SYSTEM_ROLES:
            return self.SYSTEM_ROLES[goal_type].get(self.name, default)
        return default

    def load_prompt(self, _goal_type: Optional[str] = None, **kwargs) -> str:
        prompt_file = self.resolve_prompt_file(_goal_type)
        try:
            with open(prompt_file, "r") as f:
                template = f.read()
            for key, value in kwargs.items():
                placeholder = "{" + key + "}"
                if placeholder in template:
                    val = json.dumps(value) if isinstance(value, (dict, list)) else str(value or "")
                    template = template.replace(placeholder, val)
            return template
        except FileNotFoundError:
            return f"Error: prompt file {prompt_file} not found"
    
    def call_llm(self, system: str, user: str, model: str = None, temperature: float = None, max_tokens: int = None) -> str:
        model = model or self.config["model"]
        temperature = temperature if temperature is not None else self.config["temperature"]
        max_tokens = max_tokens or self.config["max_tokens"]

        model_name = model
        extra_headers = {}
        if USE_CLOUDFLARE_GATEWAY:
            openrouter_alias = os.environ.get("CF_BYOK_ALIAS_OPENROUTER", "qampi-openrouter")
            deepseek_alias = os.environ.get("CF_BYOK_ALIAS_DEEPSEEK", "qampi-deepseek-v4-flash")
            groq_alias = os.environ.get("CF_BYOK_ALIAS_GROQ", "")
            if model_name.startswith("openrouter/") and openrouter_alias:
                extra_headers["cf-aig-byok-alias"] = openrouter_alias
            elif model_name.startswith("deepseek/") and deepseek_alias:
                extra_headers["cf-aig-byok-alias"] = deepseek_alias
            elif model_name.startswith("groq/") and groq_alias:
                extra_headers["cf-aig-byok-alias"] = groq_alias
            resolved = model_name
        else:
            # Direct DeepSeek fallback only accepts its own short model names.
            resolved = model_name.split("/", 1)[1].replace(":free", "") if "/" in model_name else model_name

        # Force JSON output mode when the system prompt asks for JSON (which
        # is true for every agent in this codebase). DeepSeek + OpenAI-compat
        # endpoints honor response_format and refuse to emit malformed JSON,
        # which kills the "Expecting ',' delimiter" retries that were burning
        # ~45s per failed messaging_strategy run.
        kwargs: Dict[str, Any] = {
            "model": resolved,
            "messages": [
                {"role": "system", "content": system},
                {"role": "user", "content": user},
            ],
            "temperature": temperature,
            "max_tokens": max_tokens,
        }
        if extra_headers:
            kwargs["extra_headers"] = extra_headers
        if "ONLY valid JSON" in system or "Return ONLY" in system:
            kwargs["response_format"] = {"type": "json_object"}

        response = self.client.chat.completions.create(**kwargs)
        return response.choices[0].message.content
    
    # Keep backward compatibility with old method name
    def call_groq(self, system: str, user: str, model: str = None, temperature: float = None, max_tokens: int = None) -> str:
        return self.call_llm(system, user, model, temperature, max_tokens)

    async def call_llm_async(self, system: str, user: str, model: str = None, temperature: float = None, max_tokens: int = None) -> str:
        """Async wrapper so asyncio.gather actually parallelizes LLM calls.

        Without this, the sync openai SDK blocks the event loop on the first
        request and effectively serializes whatever asyncio.gather scheduled.
        asyncio.to_thread runs the blocking call on a worker thread.
        """
        return await asyncio.to_thread(self.call_llm, system, user, model, temperature, max_tokens)

    async def call_groq_async(self, system: str, user: str, model: str = None, temperature: float = None, max_tokens: int = None) -> str:
        return await self.call_llm_async(system, user, model, temperature, max_tokens)
    
    def extract_json(self, text: str) -> str:
        """Extract JSON from text, handling common LLM output issues."""
        if not text:
            # Upstream returned no content (e.g. OpenRouter quota exhausted on
            # a free model, BYOK key issue, or model timeout). Treat as empty
            # so callers raise a typed JSON error instead of AttributeError.
            return ""
        text = text.strip()

        # Remove markdown code blocks
        text = re.sub(r'^```json\s*', '', text, flags=re.MULTILINE)
        text = re.sub(r'^```\s*', '', text, flags=re.MULTILINE)
        text = re.sub(r'\s*```$', '', text, flags=re.MULTILINE)
        text = text.strip()

        # Find the first { and last }
        start = text.find('{')
        end = text.rfind('}')
        if start != -1 and end != -1:
            text = text[start:end+1]

        return text

    def parse_json_response(self, text: str) -> Dict:
        text = self.extract_json(text)
        if not text:
            raise ValueError(f"[{self.name}] empty LLM response")
        return json.loads(text)
    
    async def run_with_retry(self, state: StrategyState) -> Optional[Dict]:
        from config import MAX_RETRIES, FALLBACK_MODEL
        
        for attempt in range(MAX_RETRIES):
            try:
                result = await self.run(state)
                if result:
                    return result
            except RateLimitError:
                raise  # Let orchestrator handle rate limits
            except APIConnectionError as e:
                print(f"[{self.name}] Connection error (attempt {attempt + 1}): {e}")
                if attempt == MAX_RETRIES - 1:
                    state.errors.append({"agent": self.name, "error": str(e)})
            except json.JSONDecodeError as e:
                print(f"[{self.name}] JSON parse error (attempt {attempt + 1}): {e}")
                if attempt == MAX_RETRIES - 1:
                    # Last resort: try to fix common JSON issues
                    try:
                        raw_text = str(e)
                        # Try with fallback model to fix JSON
                        fixed = await self.call_llm_async(
                            "Fix this JSON. Return ONLY valid JSON, nothing else.",
                            f"Broken JSON: {raw_text[:2000]}",
                            model=FALLBACK_MODEL,
                            temperature=0.1,
                            max_tokens=1500
                        )
                        return self.parse_json_response(fixed)
                    except Exception as fix_error:
                        print(f"[{self.name}] JSON fix failed: {fix_error}")
            except Exception as e:
                print(f"[{self.name}] Error (attempt {attempt + 1}): {e}")
                if attempt == MAX_RETRIES - 1:
                    state.errors.append({"agent": self.name, "error": str(e)})
        
        return None
    
    async def run(self, state: StrategyState) -> Optional[Dict]:
        raise NotImplementedError