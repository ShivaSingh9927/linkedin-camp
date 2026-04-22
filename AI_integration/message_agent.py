import os
from typing import Optional
from pydantic import BaseModel, Field
import instructor
from groq import Groq
from dotenv import load_dotenv

# Setup env and client
load_dotenv(os.path.join(os.path.dirname(__file__), '..', '.env'))
# Use JSON mode for stable structured output with Llama 3.1
client = instructor.patch(Groq(api_key=os.environ.get("GROQ_API")), mode=instructor.Mode.JSON)

class OutreachMessageAgent(BaseModel):
    """Schema for guaranteed high-conversion outreach messages."""
    reasoning: str = Field(description="Internal logic for why this specific hook was chosen.")
    subject_line: Optional[str] = Field(description="Only for InMails/Emails, leave empty for connection requests.")
    message_body: str = Field(description="The final personalized message.")
    personalization_hook: str = Field(description="The specific lead detail used to prove it's not a bot.")
    conversion_confidence: float = Field(description="How confident the AI is (0.0 to 1.0) that this will get a reply.")

def generate_outreach_message(user_info: dict, lead_info: dict, campaign_details: dict):
    """
    Creates a hyper-personalized message by combining:
    1. Your Profile (User)
    2. Prospect Profile (Lead)
    3. Campaign Goal (Campaign)
    """
    try:
        response = client.chat.completions.create(
            model="llama-3.1-8b-instant",
            response_model=OutreachMessageAgent,
            max_tokens=600,
            temperature=0.8,
            messages=[
                {
                    "role": "system", 
                    "content": f"You are an Elite Sales Copywriter writing for: {user_info.get('name', 'a user')}. Your goal is to mirror their persona ({user_info.get('persona', 'Founder')}) and unique value prop to convert the lead."
                },
                {
                    "role": "user", 
                    "content": f"""
                    SENDER (USER) DATA: {user_info}
                    RECIPIENT (LEAD) DATA: {lead_info}
                    CAMPAIGN GOAL: {campaign_details}
                    
                    TASK: Create an outreach message that feels personal, high-value, and perfectly aligned with the sender's goal.
                    """
                }
            ]
        )
        return response
    except Exception as e:
        print(f"ERROR: Messaging agent failed. {e}")
        return None

if __name__ == "__main__":
    test_user = {
        "name": "Alex Rivier",
        "persona": "SaaS Founder & AI Engineer",
        "value_prop": "Cutting sales dev time by 80% with Groq-powered agents"
    }
    test_lead = {
        "name": "Sarah Chen",
        "role": "VP of Sales at GrowthCo",
        "background": "Scaling outbound teams, recently posted about SDR burnout"
    }
    test_campaign = {
        "goal": "Book a 15-min demo for the AI outreach platform",
        "cta": "Are you open to a quick chat about how we automated the personalization part?"
    }
    
    print(f"--- Generating Personalized Outreach for: '{test_lead['name']}' ---")
    result = generate_outreach_message(test_user, test_lead, test_campaign)
    
    if result:
        print("\n[REASONING]")
        print(result.reasoning)
        print("\n[HOOK]")
        print(result.personalization_hook)
        print("\n[MESSAGE]")
        print(result.message_body)
    else:
        print("Generation failed.")


# from message_agent import generate_outreach_message

# user_info = {"name": "Alex", "value_prop": "80% less SDR time"}
# lead_info = {"name": "Sarah", "background": "scaling teams"}
# campaign_details = {"goal": "demo"}
# result = generate_outreach_message(user_info, lead_info, campaign_details)
