import json
from typing import Dict, Optional
from state import StrategyState
from agents.base import BaseAgent

class CompetitorAnalysisAgent(BaseAgent):
    async def run(self, state: StrategyState) -> Optional[Dict]:
        user_input = {
            "company": state.user_input.get("company", ""),
            "industry": state.user_input.get("industry", ""),
            "products": state.user_input.get("products", ""),
            "targetAudience": state.user_input.get("targetAudience", ""),
        }

        business_analysis = state.business_analysis or {}

        # Pull just the parts of research_output that matter for competitor
        # selection — the full scrape markdown blows the prompt budget.
        research = state.research_output or {}
        web_research = {
            "ownPositioning": research.get("marketPositioning"),
            "productCategory": research.get("productCategory"),
            "mainKeywords": research.get("mainKeywords", []),
            "competitors": research.get("competitors", []),
        }

        prompt = self.load_prompt(
            business_analysis=json.dumps(business_analysis, indent=2),
            user_input=json.dumps(user_input, indent=2),
            web_research=json.dumps(web_research, indent=2),
        )

        response = await self.call_groq_async(
            system="You are a competitive intelligence analyst. Return ONLY valid JSON.",
            user=prompt,
        )

        return self.parse_json_response(response)
