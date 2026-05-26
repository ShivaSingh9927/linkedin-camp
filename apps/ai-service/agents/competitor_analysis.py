import json
from typing import Dict, Optional
from state import StrategyState
from agents.base import BaseAgent
from tools.web_search import web_search

class CompetitorAnalysisAgent(BaseAgent):
    async def run(self, state: StrategyState) -> Optional[Dict]:
        user_input = {
            "company": state.user_input.get("company", ""),
            "industry": state.user_input.get("industry", ""),
            "products": state.user_input.get("products", ""),
            "targetAudience": state.user_input.get("targetAudience", ""),
        }
        
        business_analysis = state.business_analysis or {}
        
        # Try web search for competitors
        search_results = []
        if user_input.get("industry") and user_input.get("company"):
            search_query = f"{user_input['industry']} competitors {user_input['company']} alternatives"
            search_results = await web_search(search_query, num_results=5)
        
        context = {
            "business_analysis": business_analysis,
            "user_input": user_input,
            "search_results": search_results,
        }
        
        prompt = self.load_prompt(
            business_analysis=json.dumps(business_analysis, indent=2),
            user_input=json.dumps(user_input, indent=2),
        )
        
        response = self.call_groq(
            system="You are a competitive intelligence analyst. Return ONLY valid JSON.",
            user=prompt,
        )
        
        return self.parse_json_response(response)
