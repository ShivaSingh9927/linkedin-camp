import os
from typing import List, Optional
from pydantic import BaseModel, Field
import instructor
from groq import Groq
from dotenv import load_dotenv

# Load environment variables from the root .env file
dotenv_path = os.path.join(os.path.dirname(__file__), '..', '.env')
load_dotenv(dotenv_path)

# Initialize the Groq client with instructor patching for structured output
# It uses your GROQ_API key from the .env
client = instructor.patch(Groq(api_key=os.environ.get("GROQ_API")))

class LinkedInCommentAgent(BaseModel):
    """
    Schema for the LinkedIn Comment Agent.
    This structure is GUARANTEED by the Pydantic/Instructor combination.
    """
    reasoning: str = Field(description="Internal step-by-step logic used to derive the final comment.")
    comment_text: str = Field(description="The final polished comment ready for LinkedIn.")
    engagement_strategy: str = Field(description="The psychological trigger or strategy used (e.g., 'Insightful Question', 'Counter-Intuitive Take').")
    tone: str = Field(description="The tone used in the final comment (e.g., 'Professional', 'Friendly', 'Thought-provoking').")

def generate_linkedin_comment(post_description: str, user_info: dict):
    """
    Generate a structured comment using Groq and Pydantic.
    Uses user_info to tailor the comment's tone, style, and persona to the user.
    """
    try:
        response = client.chat.completions.create(
            model="llama-3.1-8b-instant",
            response_model=LinkedInCommentAgent,
            
            max_tokens=500,
            temperature=0.7,
            max_retries=2,
            
            messages=[
                {
                    "role": "system", 
                    "content": f"You are a LinkedIn Growth Expert writing on behalf of: {user_info.get('name', 'a user')}. Your goal is to mirror their persona ({user_info.get('persona', 'Expert')}) and writing style ({user_info.get('style', 'Professional')})."
                },
                {
                    "role": "user", 
                    "content": f"""
                    USER PERSONALIZATION: {user_info}
                    POST DESCRIPTION: {post_description}
                    
                    TASK: Create a comment that sounds exactly like the user but optimized for high engagement.
                    """
                }
            ]
        )
        return response
    except Exception as e:
        print(f"ERROR: Generation failed. Cause: {e}")
        return None

if __name__ == "__main__":
    test_user = {
        "name": "Alex Rivier",
        "persona": "Tech Visionary & Founder",
        "style": "Direct, insightful, slightly provocative",
        "keywords": ["Efficiency", "Disruption", "Scalability"]
    }
    test_post = "The future of AI in Sales automation is not just about replacing humans, but augmenting their unique capabilities."
    print(f"--- Generating Personalized Comment for: '{test_user['name']}' ---")
    
    result = generate_linkedin_comment(test_post, test_user)
    
    if result:
        print("\n[REASONING]")
        print(result.reasoning)
        
        print("\n[FINAL COMMENT]")
        print(result.comment_text)
        
        print("\n[STRATEGY]")
        print(f"{result.engagement_strategy} ({result.tone} tone)")
    else:
        print("Generation failed.")

# from post_comment_agent import generate_linkedin_comment

# user_info = {"name": "Alex", "persona": "Founder", "style": "Provocative"}
# post = "AI is changing sales..."
# result = generate_linkedin_comment(post, user_info)
