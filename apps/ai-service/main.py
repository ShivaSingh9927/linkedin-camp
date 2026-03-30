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
    profile_name: str
    profile_headline: Optional[str] = None
    post_content: str
    tone: str = "professional"
    persona: Optional[str] = None
    value_proposition: Optional[str] = None


class MessageRequest(BaseModel):
    recipient_name: str
    recipient_headline: Optional[str] = None
    connection_context: Optional[str] = None
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
    
    system = f"""LinkedIn Comment Generator. {brand}
Follow these rules EXACTLY:
1. Output ONLY the comment text, 1-3 sentences
2. NO explanations, NO examples, NO templates, NO placeholders
3. Tone: {req.tone}
4. Stay on-brand according to the persona and value prop provided.
5. NO formatting like quotes, bullets, or prefixes"""

    user = f"""Write a short LinkedIn comment (1-3 sentences) about this post:
---
{req.post_content[:800]}
---

Rules:
- Be specific to this post
- Ask a thoughtful question OR add genuine insight
- Natural and conversational tone
- Output ONLY the comment, nothing else"""

    try:
        comment = call_groq(system, user)
        return {"comment": comment}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/ai/message")
async def generate_message(req: MessageRequest):
    name = req.recipient_name
    brand = get_brand_context(req.persona, req.value_proposition)
    context = req.connection_context or "their professional background"
    cta_map = {
        "connect": "connect with you",
        "reply": "reply to your message",
        "demo": "book a demo call",
        "learn_more": "learn more about your services"
    }
    cta_text = cta_map.get(req.cta, "connect with you")
    
    system = f"""You are a LinkedIn messaging expert. {brand}
Write ONE complete LinkedIn message. Tone: {req.tone}.

STRICT OUTPUT RULES:
- Start directly with "Hi {name},"
- Output ONLY the message, NO intro text
- NO "Here is", "Here are", "Here\'s a", "personalized", "customized"
- NO explanations, tips, suggestions, or notes
- NO placeholders - write real content
- NO lists or numbered options
- 2-3 sentences maximum
- End with CTA: {cta_text}"""

    user = f"""Write a short, personalized LinkedIn message for {name}. 
Make it sound natural and human, not robotic.
Do NOT use any placeholders - write actual text.
Output only the message, nothing else."""
    
    try:
        message = call_groq(system, user, temperature=0.5)
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
