import os
from typing import Optional
from pydantic import BaseModel, Field
import instructor
from groq import Groq
from dotenv import load_dotenv

# Setup env and client
load_dotenv(os.path.join(os.path.dirname(__file__), '..', '.env'))
client = instructor.patch(Groq(api_key=os.environ.get("GROQ_API")))

class LinkedInReplyAgent(BaseModel):
    """Schema for enhancing a user's manual reply to a lead."""
    reasoning: str = Field(description="Internal logic for why these specific improvements were made.")
    enhanced_message: str = Field(description="The polished, high-conversion version of the message.")
    improvement_notes: str = Field(description="Quick summary of what was improved (e.g., 'Softer CTA', 'Better hook').")
    tone_analysis: str = Field(description="Analysis of the message tone (e.g., 'Professional but warm').")

def enhance_reply(user_info: dict, lead_info: dict, manual_reply: str, chat_context: Optional[str] = None):
    """
    Enhances a user's typed reply by aligning it with their persona 
    while optimizing for conversion based on lead context.
    """
    try:
        response = client.chat.completions.create(
            model="llama-3.1-8b-instant ",
            response_model=LinkedInReplyAgent,
            max_tokens=600,
            temperature=0.7,
            messages=[
                {
                    "role": "system", 
                    "content": f"You are an AI Communications Coach for: {user_info.get('name', 'a user')}. Your goal is to take a draft message and polish it into a high-engagement LinkedIn response that mirrors their persona ({user_info.get('persona', 'Sales Professional')})."
                },
                {
                    "role": "user", 
                    "content": f"""
                    USER PERSONA: {user_info}
                    LEAD CONTEXT: {lead_info}
                    CHAT HISTORY (Optional): {chat_context if chat_context else 'N/A'}
                    
                    DRAFT MESSAGE: "{manual_reply}"
                    
                    TASK: Improve this draft message. Make it clearer, more persuasive, and perfectly tailored to the user's style while remaining human and authentic.
                    """
                }
            ]
        )
        return response
    except Exception as e:
        print(f"ERROR: Reply enhancement failed. {e}")
        return None

if __name__ == "__main__":
    test_user = {
        "name": "Alex Rivier",
        "persona": "Strategic Founder",
        "style": "Direct, professional, expert-led"
    }
    test_lead = {
        "name": "David Miller",
        "role": "Operations Manager",
        "recent_topic": "Struggling with manual data entry"
    }
    draft = "Hi David, I saw your post. I have a tool that helps with data entry. Want to see it?"
    
    print(f"--- Enhancing Draft Reply for: '{test_lead['name']}' ---")
    result = enhance_reply(test_user, test_lead, draft)
    
    if result:
        print("\n[DRAFT]")
        print(f"\"{draft}\"")
        print("\n[ENHANCED MESSAGE]")
        print(result.enhanced_message)
        print("\n[IMPROVEMENTS]")
        print(result.improvement_notes)
        print("\n[TONE]")
        print(result.tone_analysis)
    else:
        print("Enhancement failed.")


# from reply_agent import enhance_reply

# user_info = {"name": "Alex", "persona": "Founder", "style": "Expert"}
# lead_info = {"name": "David", "recent_topic": "Manual data entry struggles"}
# draft = "Hey David, I have a tool that helps with data entry. Want to see?"

# result = enhance_reply(user_info, lead_info, draft)
# print(result.enhanced_message)
# # "Hi David, I saw your post. By the way, we've helped teams automate exactly what you're struggling with. Open to a 2-min demo?"
