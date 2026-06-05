import json
import httpx
from typing import List, Optional
from openai import OpenAI

from models import EmailGuess
from config import (
    USE_CLOUDFLARE_GATEWAY,
    CLOUDFLARE_AI_GATEWAY_URL,
    CF_AIG_TOKEN,
    CF_BYOK_ALIAS_DEEPSEEK,
    DEEPSEEK_API_KEY,
    DEEPSEEK_BASE_URL,
    DEEPSEEK_MODEL,
    LLM_HTTP_TIMEOUT,
)

_http_client = httpx.Client(timeout=LLM_HTTP_TIMEOUT)

if USE_CLOUDFLARE_GATEWAY:
    _ai_client = OpenAI(
        base_url=CLOUDFLARE_AI_GATEWAY_URL,
        api_key=CF_AIG_TOKEN,
        http_client=_http_client,
    )
else:
    _ai_client = OpenAI(
        base_url=DEEPSEEK_BASE_URL,
        api_key=DEEPSEEK_API_KEY,
        http_client=_http_client,
    )


def _resolve_model(model_name: str) -> str:
    if USE_CLOUDFLARE_GATEWAY:
        return model_name
    if "/" in model_name:
        return model_name.split("/", 1)[1].replace(":free", "")
    return model_name


def _call_llm(system: str, user: str, temperature: float = 0.3) -> str:
    extra_headers = {}
    if USE_CLOUDFLARE_GATEWAY and DEEPSEEK_MODEL.startswith("deepseek/") and CF_BYOK_ALIAS_DEEPSEEK:
        extra_headers["cf-aig-byok-alias"] = CF_BYOK_ALIAS_DEEPSEEK

    resolved = _resolve_model(DEEPSEEK_MODEL)

    response = _ai_client.chat.completions.create(
        model=resolved,
        messages=[
            {"role": "system", "content": system},
            {"role": "user", "content": user},
        ],
        temperature=temperature,
        max_tokens=800,
        extra_headers=extra_headers if extra_headers else None,
    )
    return response.choices[0].message.content.strip()


def rank_permutations(
    first_name: str,
    last_name: str,
    company: str,
    domain: str,
    candidates: List[str],
    job_title: Optional[str] = None,
    industry: Optional[str] = None,
) -> dict:
    system = """You are an email format expert. Given a list of possible email candidates for a person, rank them by likelihood of being their real corporate email. Consider industry conventions, company size signals, and seniority. Return valid JSON with two fields:
1. "guesses": array of {"email": str, "rank": int, "reason": str} — top 10 ranked
2. "search_prompt": str — a search engine query to find the actual email format for this company (e.g. "acme.com employee email format")"""

    context_parts = [f"First name: {first_name}", f"Last name: {last_name}", f"Company: {company}", f"Domain: {domain}"]
    if job_title:
        context_parts.append(f"Job title: {job_title}")
    if industry:
        context_parts.append(f"Industry: {industry}")

    context = "\n".join(context_parts)
    candidates_text = "\n".join(f"{i+1}. {e}" for i, e in enumerate(candidates))

    user = f"""{context}

Rank these email candidates by likelihood of being this person's real corporate email:

{candidates_text}

Return JSON only, no other text."""

    raw = _call_llm(system, user)
    raw = raw.removeprefix("```json").removeprefix("```").removesuffix("```").strip()
    return json.loads(raw)
