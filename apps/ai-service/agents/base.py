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
    
    def load_prompt(self, **kwargs) -> str:
        prompt_file = os.path.join(self.base_dir, self.config["prompt_file"])
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

        response = self.client.chat.completions.create(
            model=resolved,
            messages=[
                {"role": "system", "content": system},
                {"role": "user", "content": user}
            ],
            temperature=temperature,
            max_tokens=max_tokens,
            extra_headers=extra_headers if extra_headers else None,
        )
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