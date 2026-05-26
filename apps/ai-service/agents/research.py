import asyncio
from typing import Dict, Optional
from state import StrategyState
from agents.base import BaseAgent
from tools.web_scraper import scrape_website

class ResearchAgent(BaseAgent):
    async def run(self, state: StrategyState) -> Optional[Dict]:
        user_input = state.user_input
        website_url = user_input.get("website", "")
        
        if not website_url:
            return {
                "companyDescription": user_input.get("companyDescription"),
                "products": [],
                "targetMarket": user_input.get("targetAudience"),
                "marketPositioning": None,
            }
        
        result = await scrape_website(website_url)
        
        # Merge with user-provided data
        if user_input.get("companyDescription"):
            result["companyDescription"] = user_input["companyDescription"]
        if user_input.get("products"):
            result["products"] = user_input["products"].split(",") if isinstance(user_input["products"], str) else user_input["products"]
        if user_input.get("targetAudience"):
            result["targetMarket"] = user_input["targetAudience"]
        
        return result
