import os
import aiohttp
from typing import List, Dict

SERPER_API_KEY = os.environ.get("SERPER_API_KEY", "")

async def web_search(query: str, num_results: int = 5) -> List[Dict]:
    if not SERPER_API_KEY:
        return []
    
    try:
        async with aiohttp.ClientSession() as session:
            async with session.post(
                "https://google.serper.dev/search",
                headers={"X-API-KEY": SERPER_API_KEY, "Content-Type": "application/json"},
                json={"q": query, "num": num_results},
                timeout=aiohttp.ClientTimeout(total=10)
            ) as response:
                if response.status != 200:
                    return []
                data = await response.json()
                
        results = []
        for item in data.get("organic", [])[:num_results]:
            results.append({
                "title": item.get("title", ""),
                "snippet": item.get("snippet", ""),
                "url": item.get("link", ""),
            })
        return results
    except Exception as e:
        print(f"Search error: {e}")
        return []
