import os
from typing import Optional, Dict, Any, List
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from groq import Groq
from dotenv import load_dotenv

load_dotenv(os.path.join(os.path.dirname(__file__), '..', '..', '.env'))

api_key = os.environ.get("GROQ_API")
if not api_key:
    raise ValueError("GROQ_API environment variable is not set")

groq_client = Groq(api_key=api_key)

app = FastAPI(title="LeadMate AI Service", description="AI-powered LinkedIn communication enhancement")


class CommentRequest(BaseModel):
    # Profile data (from profile-visit)
    profile_name: str
    profile_headline: Optional[str] = None
    company: Optional[str] = None
    job_title: Optional[str] = None
    location: Optional[str] = None
    about: Optional[str] = None
    
    # Post content (what they're commenting on)
    post_content: str
    
    # Campaign context
    campaign_description: Optional[str] = None
    tone: str = "professional"
    persona: Optional[str] = None
    value_proposition: Optional[str] = None


class MessageRequest(BaseModel):
    # Profile data (from profile-visit)
    recipient_name: str
    recipient_headline: Optional[str] = None
    company: Optional[str] = None
    job_title: Optional[str] = None
    location: Optional[str] = None
    about: Optional[str] = None
    experience: Optional[List[Dict[str, str]]] = None
    education: Optional[List[Dict[str, str]]] = None
    
    # Campaign context
    connection_context: Optional[str] = None
    campaign_description: Optional[str] = None
    tone: str = "professional"
    cta: str = "connect"
    persona: Optional[str] = None
    value_proposition: Optional[str] = None


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


def get_brand_context(persona: Optional[str], value_prop: Optional[str]) -> str:
    context = ""
    if persona:
        context += f"\nYour Persona/Role: {persona}"
    if value_prop:
        context += f"\nYour Company Value Proposition: {value_prop}"
    return context


def call_groq(system: str, user: str, temperature: float = 0.7) -> str:
    response = groq_client.chat.completions.create(
        model="llama-3.1-8b-instant",
        messages=[
            {"role": "system", "content": system},
            {"role": "user", "content": user}
        ],
        temperature=temperature,
        max_tokens=600
    )
    return response.choices[0].message.content


@app.post("/ai/comment")
async def generate_comment(req: CommentRequest):
    brand = get_brand_context(req.persona, req.value_proposition)
    
    # Build profile context
    profile_ctx = f"""
COMMENTER PROFILE:
- Name: {req.profile_name}
- Headline: {req.profile_headline or 'Not specified'}
- Company: {req.company or 'Not specified'}
- Job Title: {req.job_title or 'Not specified'}
- Location: {req.location or 'Not specified'}
"""
    
    # Campaign context
    campaign_ctx = ""
    if req.campaign_description:
        campaign_ctx = f"\nCAMPAIGN OBJECTIVE: {req.campaign_description}\n"
    
    system = f"""You are an expert LinkedIn commenter who engages authentically with posts. {brand}

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
        comment = call_groq(system, user, temperature=0.6)
        return {"comment": comment}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/ai/message")
async def generate_message(req: MessageRequest):
    name = req.recipient_name
    brand = get_brand_context(req.persona, req.value_proposition)
    
    # Build profile context from profile-visit data
    profile_ctx = f"""
RECIPIENT PROFILE:
- Name: {name}
- Headline: {req.recipient_headline or 'Not specified'}
- Company: {req.company or 'Not specified'}
- Job Title: {req.job_title or 'Not specified'}
- Location: {req.location or 'Not specified'}
"""
    
    # Add experience if available
    if req.experience and len(req.experience) > 0:
        profile_ctx += "\n- Work Experience:\n"
        for exp in req.experience[:3]:  # Top 3 experiences
            title = exp.get('jobTitle') or exp.get('company') or 'Not specified'
            profile_ctx += f"  * {title}\n"
    
    # Add education if available
    if req.education and len(req.education) > 0:
        profile_ctx += "\n- Education:\n"
        for edu in req.education[:2]:  # Top 2
            school = edu.get('school') or 'Not specified'
            profile_ctx += f"  * {school}\n"
    
    # Add about if available
    if req.about and len(req.about) > 20:
        profile_ctx += f"\n- About: {req.about[:300]}...\n"
    
    # Campaign context
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
    
    system = f"""You are a LinkedIn outreach expert who does thorough homework before reaching out. {brand}

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
        message = call_groq(system, user, temperature=0.6)
        return {"message": message}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/ai/enhance")
async def enhance_reply(req: EnhanceRequest):
    brand = get_brand_context(req.persona, req.value_proposition)
    
    thread_ctx = ""
    if req.thread_history:
        thread_ctx = "\nRecent Conversation History (last 6 messages):\n"
        for msg in req.thread_history[-6:]:
            thread_ctx += f"- {msg.sender}: {msg.text}\n"
    elif req.original_message:
        thread_ctx = f"\nLast message received: {req.original_message}"

    system = f"""Expert LinkedIn Communication Coach. {brand}
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
        enhanced = call_groq(system, user, temperature=0.8)
        return {"enhanced": enhanced}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8001)
