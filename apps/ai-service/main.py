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
    # NEW (Phase C):
    # channel: 'linkedin' (default — DM, returns {message}) or 'email'
    # (returns {message, subject} — body and short subject line generated
    # together so they reinforce each other and stay consistent in tone).
    channel: str = "linkedin"
    # ai_prompt: per-step user instructions ("This is the opener, no asks
    # yet"). Layered on top of campaign + business context with the
    # highest priority short of the STRICT RULES.
    ai_prompt: Optional[str] = None
    # campaign_progress: where this lead sits in the multi-step sequence.
    # When provided, the AI knows step 1 of N vs step N of N and adjusts
    # tone (intro → nudge → final). Empty completed_steps = first touch,
    # behaves like today.
    campaign_progress: Optional[Dict[str, Any]] = None
    # message_history: prior SENT messages to this lead in this campaign.
    # Full body for now (Groq is cheap and "don't repeat phrasing" works
    # better with exact text). Both LinkedIn DMs and emails included so
    # cross-channel campaigns don't re-use openers.
    message_history: Optional[List[Dict[str, Any]]] = None


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


class SelfProfileRequest(BaseModel):
    # Scraped from the user's OWN LinkedIn profile after they log in. Used to
    # infer their voice and a structured summary that sharpens message gen.
    name: Optional[str] = None
    headline: Optional[str] = None
    about: Optional[str] = None
    company: Optional[str] = None
    job_title: Optional[str] = None
    location: Optional[str] = None
    posts: List[str] = []  # recent post bodies
    # Extended fields from Voyager API (not available via DOM scraper).
    # These give the AI richer context about the user's professional identity.
    industry: Optional[str] = None          # "Computer Software"
    geo_location: Optional[str] = None      # "Kanpur, Uttar Pradesh, India"
    premium: Optional[bool] = None          # LinkedIn Premium subscriber
    pronouns: Optional[str] = None          # "HE_HIM", "SHE_HER", etc.
    vanity: Optional[str] = None            # "shiva-singh-genai-llm"
    member_id: Optional[str] = None         # "660119273"
    profile_picture_url: Optional[str] = None  # full URL


# ── Helper Functions ─────────────────────────────────────────────────────────

def get_brand_context(persona: Optional[str], value_prop: Optional[str], user_context: Optional[Dict] = None) -> str:
    context = ""
    if user_context and user_context.get("sender_name"):
        context += f"\nYour Name: {user_context['sender_name']}"
    if persona:
        context += f"\nYour Persona/Role: {persona}"
    if value_prop:
        context += f"\nYour Company Value Proposition: {value_prop}"
    if user_context:
        if user_context.get("company"):
            context += f"\nYour Company: {user_context['company']}"
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

    # Phase C: sequence-awareness. When the engine ships campaign_progress
    # the model knows step N of M and can shift register (opener → nudge →
    # final close) instead of generating every step as if it's the first.
    sequence_ctx = ""
    is_first_touch = True
    if req.campaign_progress:
        cp = req.campaign_progress
        step_num = cp.get("stepNumber")
        total = cp.get("totalSteps")
        completed = cp.get("completedSteps") or []
        pending = cp.get("pendingSteps") or []
        days = cp.get("daysSinceFirstTouch")
        this_label = cp.get("thisStepLabel")
        is_first_touch = len(completed) == 0
        if step_num and total:
            sequence_ctx = f"\nWHERE THIS LEAD IS IN THE SEQUENCE:\n- Step {step_num} of {total}"
            if this_label:
                sequence_ctx += f" ({this_label})"
            sequence_ctx += "\n"
            if completed:
                sequence_ctx += f"- Already done: {', '.join(str(s.get('type','')) for s in completed)}\n"
            if pending:
                sequence_ctx += f"- Still pending after this: {', '.join(str(s) for s in pending)}\n"
            if days is not None:
                sequence_ctx += f"- Days since first touch: {days}\n"

    history_ctx = ""
    if req.message_history:
        history_lines = []
        for i, m in enumerate(req.message_history, 1):
            ch = m.get("channel", "linkedin")
            when = m.get("sentAt", "")
            subj = m.get("subject")
            body = (m.get("body") or "").strip()
            header = f"[{i}] {ch} on {when}"
            if subj:
                header += f' — subject: "{subj}"'
            history_lines.append(f"{header}\n    {body}")
        history_ctx = "\nPAST CONVERSATION (DO NOT REPEAT THESE OPENERS OR PHRASES):\n" + "\n".join(history_lines) + "\n"

    custom_ctx = ""
    if req.ai_prompt:
        custom_ctx = f"\nUSER'S INSTRUCTIONS FOR THIS STEP (highest priority — follow these closely):\n{req.ai_prompt}\n"

    is_email = (req.channel or "linkedin").lower() == "email"

    # Email-specific rules: longer body OK (4-7 sentences), subject line
    # required, no "Hi" rule (use the recipient name naturally in the
    # opening sentence). LinkedIn-specific rules: short DM, "Hi {name}".
    if is_email:
        channel_rules = f"""1. Subject: ≤ 6 words, conversational, lowercase or mixed case, NO exclamation marks, NO ALL CAPS, NO sales-y phrases like "Quick question" / "Following up" / "Saw your profile"
2. Body opens by addressing them by first name naturally — NOT "Dear {name}," — try something like "Hey {name}, ..." or "{name} —"
3. Body: 4-7 short sentences. Plain text. No marketing fluff.
4. Reference SPECIFIC thing from their profile (their role, company, recent experience, or something from their about)
5. End with natural {cta_text}
6. NO "I hope this finds you well", "I came across your profile", "I wanted to reach out"
7. NO placeholders or generic templates - write specific to THIS person
8. Sound like a real human writing a one-off email, not a marketing blast

OUTPUT FORMAT — return EXACTLY this, nothing else:
SUBJECT: <subject line>
---
<body>"""
    else:
        channel_rules = f"""1. Start with "Hi {name}," - NO fluff before
2. Reference SPECIFIC thing from their profile (their role, company, recent experience, location, or something from their about)
3. Show genuine interest in THEIR work, not just what they can do for you
4. 2-4 sentences maximum
5. End with natural {cta_text}
6. NO "I hope this finds you well", "I came across your profile", "I wanted to reach out"
7. NO placeholders or generic templates - write specific to THIS person
8. Sound like a real human, not a bot"""

    # Anti-repetition + step-aware nudge: when this isn't the first touch,
    # the model must NOT reuse the opener or hook from past messages, and
    # should soften the ask vs. step 1.
    sequence_rules = ""
    if not is_first_touch and req.message_history:
        sequence_rules = """

SEQUENCE-AWARE RULES (this is a follow-up, NOT a first touch):
- Do NOT repeat any opener, hook, or specific phrase from the PAST CONVERSATION section
- Reference the prior outreach lightly if natural ("circling back", "wanted to follow up on my note") but do not over-apologize
- If this is the final step, lead with value (case study, resource, insight) rather than asking again
- If this is mid-sequence, keep it light — a short nudge, not a re-pitch"""

    channel_label = "email" if is_email else "LinkedIn message"
    system = f"""You are a {channel_label} outreach expert who does thorough homework before reaching out.{brand}{strategy_ctx}

Your task: Write ONE personalized {channel_label} that shows you've done your research.

STRICT RULES:
{channel_rules}{sequence_rules}"""

    user = f"""{profile_ctx}
{campaign_ctx}{sequence_ctx}{history_ctx}{custom_ctx}
Write a personalized outreach {channel_label} that:
- Shows you've done homework on their profile
- References something specific from their background
- Feels natural and human, not automated
- Ends with: {cta_text}

Remember: The key is making them feel you genuinely read their profile and have a real reason to connect."""

    try:
        raw = call_llm(system, user, temperature=0.6)
        if is_email:
            # Parse "SUBJECT: ...\n---\n<body>". Be lenient: if the model
            # forgot the marker, fall back to first line as subject.
            subject = None
            body = raw
            if "SUBJECT:" in raw:
                head, _, rest = raw.partition("SUBJECT:")
                subject_line, _, after = rest.partition("\n")
                subject = subject_line.strip()
                # Strip the --- separator if present.
                body = after.lstrip()
                if body.startswith("---"):
                    body = body[3:].lstrip("\n").lstrip()
            return {"message": body, "subject": subject}
        return {"message": raw}
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


# ─── Self-Profile Summary ─────────────────────────────────────────────────────

@app.post("/ai/profile-summary")
async def profile_summary(req: SelfProfileRequest):
    """
    Turn the user's scraped OWN profile + recent posts into (1) a confident,
    structured summary of who they are, and (2) an inferred communication style
    + tone tags. The summary powers the dashboard "here's what I learned about
    you" card; the style/tone feed message generation so outreach sounds like
    them. Returns JSON: { summary, communicationStyle, tonePreferences[] }.
    """
    import json
    import re

    profile_lines = []
    if req.name:
        profile_lines.append(f"Name: {req.name}")
    if req.headline:
        profile_lines.append(f"Headline: {req.headline}")
    if req.job_title or req.company:
        profile_lines.append(f"Role: {req.job_title or ''} at {req.company or ''}".strip())
    if req.location:
        profile_lines.append(f"Location: {req.location}")
    if req.about:
        profile_lines.append(f"About:\n{req.about}")
    # Voyager API extended fields — richer context for the AI
    if req.industry:
        profile_lines.append(f"Industry: {req.industry}")
    if req.geo_location:
        profile_lines.append(f"Detailed Location: {req.geo_location}")
    if req.premium is not None:
        profile_lines.append(f"LinkedIn Plan: {'Premium' if req.premium else 'Free'}")
    if req.pronouns:
        # Normalize pronoun codes to readable form
        pronoun_map = {
            "HE_HIM": "he/him", "SHE_HER": "she/her", "THEY_THEM": "they/them",
            "ZE_ZIR": "ze/zir", "XE_XEM": "xe/xem", "VE_VER": "ve/ver",
        }
        readable = pronoun_map.get(req.pronouns.upper(), req.pronouns.lower().replace("_", "/"))
        profile_lines.append(f"Pronouns: {readable}")

    posts_block = ""
    if req.posts:
        posts_block = "\n\nTheir recent LinkedIn posts (their authentic voice):\n"
        for i, p in enumerate(req.posts[:5], 1):
            posts_block += f"\n[Post {i}]\n{p[:1500]}\n"

    system = (
        "You analyze a professional's own LinkedIn profile and posts to build a "
        "crisp profile that another AI will use to write outreach in THEIR voice. "
        "Be specific and grounded ONLY in what's provided — never invent facts. "
        "When industry, location details, pronouns, or LinkedIn plan are provided, "
        "use them to sharpen your understanding of their professional domain, "
        "geographic context, and communication preferences. "
        "Return STRICT JSON only, no prose, no code fences."
    )

    user = f"""Here is the person's LinkedIn profile and recent posts.

{chr(10).join(profile_lines) if profile_lines else "(no profile fields scraped)"}
{posts_block}

Return EXACTLY this JSON shape:
{{
  "summary": "2-4 sentence confident summary of who they are, what they do, who they help, and what they care about — written so it reads like 'here's the picture I've built of you'.",
  "communicationStyle": "1-2 sentences describing how they write — sentence length, formality, use of humor/data/stories, emoji, etc. Inferred from their posts if available.",
  "tonePreferences": ["3-6 short lowercase tone tags, e.g. 'direct', 'warm', 'data-driven', 'conversational'"]
}}"""

    try:
        raw = call_llm(system, user, temperature=0.4)
        # Be tolerant: strip code fences and pull the first {...} block.
        cleaned = re.sub(r"^```(?:json)?|```$", "", raw.strip(), flags=re.MULTILINE).strip()
        match = re.search(r"\{.*\}", cleaned, re.DOTALL)
        data = json.loads(match.group(0) if match else cleaned)
        return {
            "summary": (data.get("summary") or "").strip(),
            "communicationStyle": (data.get("communicationStyle") or "").strip(),
            "tonePreferences": [str(t).strip() for t in (data.get("tonePreferences") or []) if str(t).strip()][:6],
        }
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