import json
from datetime import datetime
from typing import Dict, Optional
from state import StrategyState
from agents.base import BaseAgent

class SynthesizerAgent(BaseAgent):
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
            "communicationStyle": state.user_input.get("communicationStyle", ""),
            "writingSamples": state.user_input.get("writingSamples", []),
            "tonePreferences": state.user_input.get("tonePreferences", []),
        }
        
        prompt = self.load_prompt(
            _goal_type=state.user_input.get("goalType"),
            messaging_strategy=json.dumps(state.messaging_strategy or {}, indent=2),
            competitor_analysis=json.dumps(state.competitor_analysis or {}, indent=2),
            business_analysis=json.dumps(state.business_analysis or {}, indent=2),
            research_output=json.dumps(state.research_output or {}, indent=2),
            review_feedback=json.dumps(state.review_feedback or {}, indent=2),
            user_input=json.dumps(user_input, indent=2),
        )
        
        response = await self.call_groq_async(
            system="You are a technical writer. Return ONLY valid JSON.",
            user=prompt,
        )
        
        result = self.parse_json_response(response)
        result["_metadata"] = {
            "generatedAt": datetime.utcnow().isoformat(),
            "model": self.config["model"],
            "version": 1,
        }
        
        return result
