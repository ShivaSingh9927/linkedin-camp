import json
from typing import Dict, Optional
from state import StrategyState
from agents.base import BaseAgent

class BusinessAnalysisAgent(BaseAgent):
    async def run(self, state: StrategyState) -> Optional[Dict]:
        user_input = {
            "company": state.user_input.get("company", ""),
            "industry": state.user_input.get("industry", ""),
            "persona": state.user_input.get("persona", ""),
            "valueProp": state.user_input.get("valueProp", ""),
            "targetAudience": state.user_input.get("targetAudience", ""),
            "mainPainPoint": state.user_input.get("mainPainPoint", ""),
            "companyDescription": state.user_input.get("companyDescription", ""),
            "products": state.user_input.get("products", ""),
            "differentiators": state.user_input.get("differentiators", ""),
            "caseStudies": state.user_input.get("caseStudies", ""),
        }
        
        research_output = state.research_output or {}
        
        prompt = self.load_prompt(
            _goal_type=state.user_input.get("goalType"),
            user_input=json.dumps(user_input, indent=2),
            research_output=json.dumps(research_output, indent=2),
        )
        
        response = await self.call_groq_async(
            system=self.system_role(state.user_input.get("goalType"),
                                     "You are a senior business strategist. Return ONLY valid JSON."),
            user=prompt,
        )
        
        return self.parse_json_response(response)
