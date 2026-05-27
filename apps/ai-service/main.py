import os
import httpx
from typing import Optional, Dict, Any, List
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from openai import OpenAI
from dotenv import load_dotenv

# Local development convenience: load .env from monorepo root if present.
# Inside Docker the file doesn't exist and env vars come from compose.
_root_env = os.path.join(os.path.dirname(__file__), '..', '..', '.env')
if os.path.isfile(_root_env):
    load_dotenv(_root_env)

# Sentry must initialize BEFORE the FastAPI app is constructed so its
# integration can patch the ASGI stack. Shares the backend DSN; events get
# tagged service=ai-service so they're filterable in the Sentry dashboard.
# Disabled silently if SENTRY_DSN is unset (local dev).
_SENTRY_DSN = os.environ.get("SENTRY_DSN", "")
if _SENTRY_DSN:
    try:
        import sentry_sdk
        from sentry_sdk.integrations.fastapi import FastApiIntegration
        from sentry_sdk.integrations.starlette import StarletteIntegration

        def _before_send(event, hint):
            # Strip auth headers the same way the backend does.
            req = event.get("request")
            if req and req.get("headers"):
                for k in ("authorization", "Authorization", "cookie", "Cookie"):
                    req["headers"].pop(k, None)
            return event

        sentry_sdk.init(
            dsn=_SENTRY_DSN,
            environment=os.environ.get("NODE_ENV") or os.environ.get("ENV") or "production",
            traces_sample_rate=0.05,
            send_default_pii=False,
            integrations=[StarletteIntegration(), FastApiIntegration()],
            before_send=_before_send,
        )
        sentry_sdk.set_tag("service", "ai-service")
        print("[SENTRY] initialized (env=" + (os.environ.get("NODE_ENV") or "production") + ")")
    except Exception as e:
        print(f"[SENTRY] init failed: {e}")
else:
    print("[SENTRY] disabled (no SENTRY_DSN set)")

# Cloudflare AI Gateway Configuration
CLOUDFLARE_AI_GATEWAY_URL = os.environ.get("CLOUDFLARE_AI_GATEWAY_URL", "")
CF_AIG_TOKEN = os.environ.get("CF_AIG_TOKEN", "")
USE_CLOUDFLARE_GATEWAY = bool(CLOUDFLARE_AI_GATEWAY_URL and CF_AIG_TOKEN)

# DeepSeek configuration (for direct fallback). config.py reads DEEPSEEK_API
# from the same env to share with agents — accept both names for safety.
DEEPSEEK_API_KEY = os.environ.get("DEEPSEEK_API_KEY") or os.environ.get("DEEPSEEK_API", "")
DEEPSEEK_BASE_URL = os.environ.get("DEEPSEEK_BASE_URL", "https://api.deepseek.com")

# Hard request timeout on every LLM call. Without this, a hung upstream would
# wedge the campaign worker indefinitely while it holds the per-account lock.
LLM_HTTP_TIMEOUT = float(os.environ.get("LLM_HTTP_TIMEOUT_SECONDS", "60"))
_http_client = httpx.Client(timeout=LLM_HTTP_TIMEOUT)

# Initialize OpenAI-compatible client
if USE_CLOUDFLARE_GATEWAY:
    ai_client = OpenAI(
        base_url=CLOUDFLARE_AI_GATEWAY_URL,
        api_key=CF_AIG_TOKEN,
        http_client=_http_client,
    )
    print(f"[AI-SERVICE] Using Cloudflare AI Gateway: {CLOUDFLARE_AI_GATEWAY_URL}")
else:
    # Direct DeepSeek fallback. DeepSeek's native API only accepts its own
    # model names (e.g. 'deepseek-chat') — strip provider prefixes at call time.
    ai_client = OpenAI(
        base_url=DEEPSEEK_BASE_URL,
        api_key=DEEPSEEK_API_KEY,
        http_client=_http_client,
    )
    print("[AI-SERVICE] Using direct DeepSeek API (Cloudflare Gateway not configured)")


def _resolve_model(model_name: str) -> str:
    """Adjust model name for the active provider.

    Cloudflare gateway expects the full prefixed name (openrouter/..., deepseek/..., groq/...).
    Direct DeepSeek expects unprefixed names like 'deepseek-chat'.
    """
    if USE_CLOUDFLARE_GATEWAY:
        return model_name
    # Direct DeepSeek path: strip any provider prefix.
    if "/" in model_name:
        return model_name.split("/", 1)[1].replace(":free", "")
    return model_name

app = FastAPI(title="Qampi AI Service", description="AI-powered LinkedIn communication enhancement")

_cors_origins = [o.strip() for o in os.environ.get(
    "CORS_ORIGIN",
    "https://app.qampi.com,https://qampi.com,https://www.qampi.com"
).split(",") if o.strip()]
app.add_middleware(
    CORSMiddleware,
    allow_origins=_cors_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["*"],
)


# ─── Request Models ──────────────────────────────────────────────────────────

class CommentRequest(BaseModel):
    profile_name: str
    profile_headline: Optional[str] = None
    company: Optional[str] = None
    job_title: Optional[str] = None
    location: Optional[str] = None
    about: Optional[str] = None
    post_content: str
    campaign_description: Optional[str] = None
    tone: str = "professional"
    persona: Optional[str] = None
    value_proposition: Optional[str] = None
    ai_strategy: Optional[Dict[str, Any]] = None
    user_context: Optional[Dict[str, Any]] = None


class MessageRequest(BaseModel):
    recipient_name: str
    recipient_headline: Optional[str] = None
    company: Optional[str] = None
    job_title: Optional[str] = None
    location: Optional[str] = None
    about: Optional[str] = None
    experience: Optional[List[Dict[str, str]]] = None
    education: Optional[List[Dict[str, str]]] = None
    connection_context: Optional[str] = None
    campaign_description: Optional[str] = None
    tone: str = "professional"
    cta: str = "connect"
    persona: Optional[str] = None
    value_proposition: Optional[str] = None
    ai_strategy: Optional[Dict[str, Any]] = None
    user_context: Optional[Dict[str, Any]] = None


class ThreadMessage(BaseModel):
    sender: str
    text: str


class EnhanceRequest(BaseModel):
    original_message: Optional[str] = None
    thread_history: Optional[List[ThreadMessage]] = None
    draft_reply: Optional[str] = None
    tone: str = "professional"
    persona: Optional[str] = None
    value_proposition: Optional[str] = None
    ai_strategy: Optional[Dict[str, Any]] = None


class StrategyRequest(BaseModel):
    user_id: str
    company: Optional[str] = None
    industry: Optional[str] = None
    persona: Optional[str] = None
    valueProp: Optional[str] = None
    targetAudience: Optional[str] = None
    mainPainPoint: Optional[str] = None
    companyDescription: Optional[str] = None
    products: Optional[str] = None
    differentiators: Optional[str] = None
    caseStudies: Optional[str] = None
    communicationStyle: Optional[str] = None
    writingSamples: Optional[List[Dict[str, str]]] = None
    tonePreferences: Optional[List[str]] = None
    website: Optional[str] = None
    trigger: str = "manual"
    force_regenerate: bool = False


class StrategyUpdate(BaseModel):
    overrides: Dict[str, Any]


# ── Helper Functions ─────────────────────────────────────────────────────────

def get_brand_context(persona: Optional[str], value_prop: Optional[str], user_context: Optional[Dict] = None) -> str:
    context = ""
    if persona:
        context += f"\nYour Persona/Role: {persona}"
    if value_prop:
        context += f"\nYour Company Value Proposition: {value_prop}"
    if user_context:
        if user_context.get("companyDescription"):
            context += f"\nCompany Description: {user_context['companyDescription']}"
        if user_context.get("products"):
            context += f"\nProducts/Services: {user_context['products']}"
        if user_context.get("differentiators"):
            context += f"\nKey Differentiators: {user_context['differentiators']}"
        if user_context.get("caseStudies"):
            context += f"\nCase Studies/Results: {user_context['caseStudies']}"
        if user_context.get("communicationStyle"):
            context += f"\nCommunication Style: {user_context['communicationStyle']}"
    return context


def get_strategy_context(ai_strategy: Optional[Dict] = None) -> str:
    if not ai_strategy:
        return ""
    
    ctx = "\n\nBUSINESS STRATEGY (use this to guide your messaging):\n"
    
    if "gtm" in ai_strategy:
        gtm = ai_strategy["gtm"]
        ctx += f"- Positioning: {gtm.get('positioning', 'N/A')}\n"
    
    if "icp" in ai_strategy:
        icp = ai_strategy["icp"]
        if isinstance(icp, dict) and "primary" in icp:
            primary = icp["primary"]
            ctx += f"- Target ICP: {primary.get('title', 'N/A')}\n"
            if primary.get("painPoints"):
                ctx += f"- ICP Pain Points: {', '.join(primary['painPoints'][:3])}\n"
    
    if "messagingPillars" in ai_strategy:
        pillars = ai_strategy["messagingPillars"]
        if isinstance(pillars, list):
            ctx += "- Messaging Pillars:\n"
            for p in pillars[:3]:
                ctx += f"  * {p.get('pillar', '')}: {p.get('angle', '')}\n"
    
    if "outreachAngles" in ai_strategy:
        angles = ai_strategy["outreachAngles"]
        if isinstance(angles, dict):
            ctx += "- Outreach Angles by Persona:\n"
            for persona_name, angle in list(angles.items())[:3]:
                if isinstance(angle, dict):
                    ctx += f"  * {persona_name}: hook={angle.get('hook', '')[:50]}, tone={angle.get('tone', '')}\n"
    
    return ctx


CF_BYOK_ALIAS_OPENROUTER = os.environ.get("CF_BYOK_ALIAS_OPENROUTER", "qampi-openrouter")
CF_BYOK_ALIAS_DEEPSEEK = os.environ.get("CF_BYOK_ALIAS_DEEPSEEK", "qampi-deepseek-v4-flash")
CF_BYOK_ALIAS_GROQ = os.environ.get("CF_BYOK_ALIAS_GROQ", "")  # unset = skip


def call_llm(system: str, user: str, temperature: float = 0.7, model: str = "deepseek/deepseek-chat") -> str:
    model_name = model

    extra_headers = {}
    if USE_CLOUDFLARE_GATEWAY:
        if model_name.startswith("openrouter/") and CF_BYOK_ALIAS_OPENROUTER:
            extra_headers["cf-aig-byok-alias"] = CF_BYOK_ALIAS_OPENROUTER
        elif model_name.startswith("deepseek/") and CF_BYOK_ALIAS_DEEPSEEK:
            extra_headers["cf-aig-byok-alias"] = CF_BYOK_ALIAS_DEEPSEEK
        elif model_name.startswith("groq/") and CF_BYOK_ALIAS_GROQ:
            extra_headers["cf-aig-byok-alias"] = CF_BYOK_ALIAS_GROQ

    resolved = _resolve_model(model_name)

    response = ai_client.chat.completions.create(
        model=resolved,
        messages=[
            {"role": "system", "content": system},
            {"role": "user", "content": user}
        ],
        temperature=temperature,
        max_tokens=600,
        extra_headers=extra_headers if extra_headers else None,
    )
    return response.choices[0].message.content


# ─── Strategy Endpoints ───────────────────────────────────────────────────────

@app.post("/ai/generate-strategy")
async def generate_strategy_endpoint(req: StrategyRequest):
    from orchestrator import generate_strategy
    
    user_input = req.model_dump(exclude={"user_id", "trigger", "force_regenerate"})
    result = await generate_strategy(user_input, ai_client, force_regenerate=req.force_regenerate)
    
    return {
        "success": True,
        "strategy": result,
        "isFallback": result.get("_metadata", {}).get("isFallback", False),
        "cached": result.get("_metadata", {}).get("cached", False),
    }


@app.post("/ai/validate-strategy")
async def validate_strategy_endpoint(strategy: Dict[str, Any]):
    from validators import validate_strategy
    is_valid, errors = validate_strategy(strategy)
    return {"valid": is_valid, "errors": errors}


# ─── Existing Endpoints (Updated with AI Strategy Context) ────────────────────

@app.post("/ai/comment")
async def generate_comment(req: CommentRequest):
    brand = get_brand_context(req.persona, req.value_proposition, req.user_context)
    strategy_ctx = get_strategy_context(req.ai_strategy)
    
    profile_ctx = f"""
COMMENTER PROFILE:
- Name: {req.profile_name}
- Headline: {req.profile_headline or 'Not specified'}
- Company: {req.company or 'Not specified'}
- Job Title: {req.job_title or 'Not specified'}
- Location: {req.location or 'Not specified'}
"""
    
    campaign_ctx = ""
    if req.campaign_description:
        campaign_ctx = f"\nCAMPAIGN OBJECTIVE: {req.campaign_description}\n"
    
    system = f"""You are an expert LinkedIn commenter who engages authentically with posts.{brand}{strategy_ctx}

Your goal: Write a genuine, engaging comment that adds value to the conversation.

STRICT RULES:
1. Output ONLY the comment, 1-3 sentences
2. NO "Great post!", "Thanks for sharing", "Well said"
3. NO questions that can be answered with yes/no
4. Add a unique insight, perspective, or question specific to THIS post's content
5. Sound like a real human expert, not a bot
6. NO placeholders or generic templates"""
    
    user = f"""{profile_ctx}

{campaign_ctx}

THE POST YOU'RE COMMENTING ON:
---
{req.post_content[:1000]}
---

Write a comment that:
- Shows you've actually read and understood the post
- Adds genuine value (insight, perspective, or thoughtful question)
- References specific thing from YOUR background that relates to the post
- Feels natural and human, not like a template

Remember: The goal is to get engagement with YOUR comment, not just sound smart."""
    
    try:
        comment = call_llm(system, user, temperature=0.6)
        return {"comment": comment}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/ai/message")
async def generate_message(req: MessageRequest):
    name = req.recipient_name
    brand = get_brand_context(req.persona, req.value_proposition, req.user_context)
    strategy_ctx = get_strategy_context(req.ai_strategy)
    
    profile_ctx = f"""
RECIPIENT PROFILE:
- Name: {name}
- Headline: {req.recipient_headline or 'Not specified'}
- Company: {req.company or 'Not specified'}
- Job Title: {req.job_title or 'Not specified'}
- Location: {req.location or 'Not specified'}
"""
    
    if req.experience and len(req.experience) > 0:
        profile_ctx += "\n- Work Experience:\n"
        for exp in req.experience[:3]:
            title = exp.get('jobTitle') or exp.get('company') or 'Not specified'
            profile_ctx += f"  * {title}\n"
    
    if req.education and len(req.education) > 0:
        profile_ctx += "\n- Education:\n"
        for edu in req.education[:2]:
            school = edu.get('school') or 'Not specified'
            profile_ctx += f"  * {school}\n"
    
    if req.about and len(req.about) > 20:
        profile_ctx += f"\n- About: {req.about[:300]}...\n"
    
    campaign_ctx = ""
    if req.campaign_description:
        campaign_ctx = f"\nCAMPAIGN OBJECTIVE/DESCRIPTION: {req.campaign_description}\n"
    if req.connection_context:
        campaign_ctx += f"\nOUTREACH PURPOSE: {req.connection_context}\n"
    
    cta_map = {
        "connect": "connect with you",
        "reply": "reply to your message",
        "demo": "book a demo call",
        "learn_more": "learn more about your services",
        "referral": "provide a referral",
        "meeting": "schedule a quick call"
    }
    cta_text = cta_map.get(req.cta, "connect with you")
    
    system = f"""You are a LinkedIn outreach expert who does thorough homework before reaching out.{brand}{strategy_ctx}

Your task: Write ONE personalized LinkedIn message that shows you've done your research.

STRICT RULES:
1. Start with "Hi {name}," - NO fluff before
2. Reference SPECIFIC thing from their profile (their role, company, recent experience, location, or something from their about)
3. Show genuine interest in THEIR work, not just what they can do for you
4. 2-4 sentences maximum
5. End with natural {cta_text}
6. NO "I hope this finds you well", "I came across your profile", "I wanted to reach out"
7. NO placeholders or generic templates - write specific to THIS person
8. Sound like a real human, not a bot"""
    
    user = f"""{profile_ctx}

{campaign_ctx}

Write a personalized outreach message that:
- Shows you've done homework on their profile
- References something specific from their background
- Feels natural and human, not automated
- Ends with: {cta_text}

Remember: The key is making them feel you genuinely read their profile and have a real reason to connect."""
    
    try:
        message = call_llm(system, user, temperature=0.6)
        return {"message": message}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/ai/enhance")
async def enhance_reply(req: EnhanceRequest):
    brand = get_brand_context(req.persona, req.value_proposition)
    strategy_ctx = get_strategy_context(req.ai_strategy)
    
    thread_ctx = ""
    if req.thread_history:
        thread_ctx = "\nRecent Conversation History (last 6 messages):\n"
        for msg in req.thread_history[-6:]:
            thread_ctx += f"- {msg.sender}: {msg.text}\n"
    elif req.original_message:
        thread_ctx = f"\nLast message received: {req.original_message}"
    
    system = f"""Expert LinkedIn Communication Coach.{brand}{strategy_ctx}
Enhance draft replies or suggest a reply based on conversation history.
Tone: {req.tone}. Stay authentic to the persona provided."""
    
    user = f"""{thread_ctx}

User's current draft: "{req.draft_reply or '(No draft provided, please suggest a fresh reply)'}"

INSTRUCTIONS:
- Enhance the draft to be more engaging and natural.
- If no draft is provided, write a thoughtful reply based on the history.
- Maintain the user's voice and brand identity.
- 2-4 sentences maximum.
- Output ONLY the enhanced reply, no preamble."""
    
    try:
        enhanced = call_llm(system, user, temperature=0.8)
        return {"enhanced": enhanced}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ─── Health Check ─────────────────────────────────────────────────────────────

@app.get("/health")
async def health_check():
    # Determine model based on AI_MODE for display
    ai_mode = os.environ.get("AI_MODE", "production")
    if ai_mode == "test":
        model_display = "openrouter/deepseek/deepseek-chat:free"
    else:
        model_display = "deepseek/deepseek-chat"
    
    return {
        "status": "healthy",
        "service": "qampi-ai",
        "model": model_display,
        "gateway": "cloudflare" if USE_CLOUDFLARE_GATEWAY else "direct",
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8001)