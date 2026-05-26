import json
from typing import Dict, Optional
from state import StrategyState
from agents.base import BaseAgent

class ReviewAgent(BaseAgent):
    async def run(self, state: StrategyState) -> Optional[Dict]:
        user_input = {
            "company": state.user_input.get("company", ""),
            "industry": state.user_input.get("industry", ""),
            "companyDescription": state.user_input.get("companyDescription", ""),
        }
        
        prompt = self.load_prompt(
            messaging_strategy=json.dumps(state.messaging_strategy or {}, indent=2),
            business_analysis=json.dumps(state.business_analysis or {}, indent=2),
            research_output=json.dumps(state.research_output or {}, indent=2),
            user_input=json.dumps(user_input, indent=2),
        )
        
        response = self.call_groq(
            system="You are a quality assurance editor. Return ONLY valid JSON.",
            user=prompt,
        )
        
        return self.parse_json_response(response)
