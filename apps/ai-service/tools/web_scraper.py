import asyncio
import aiohttp
from bs4 import BeautifulSoup
from typing import Dict, Optional
from .cache import cache_get, cache_set

async def scrape_website(url: str, timeout: int = 10) -> Dict:
    cached = cache_get(f"scrape:{url}")
    if cached:
        return cached
    
    result = {
        "companyDescription": None,
        "products": [],
        "targetMarket": None,
        "marketPositioning": None,
    }
    
    try:
        async with aiohttp.ClientSession() as session:
            async with session.get(url, timeout=aiohttp.ClientTimeout(total=timeout)) as response:
                if response.status != 200:
                    return result
                html = await response.text()
        
        soup = BeautifulSoup(html, "html.parser")
        
        # Remove script and style elements
        for script in soup(["script", "style", "nav", "footer"]):
            script.decompose()
        
        # Extract title
        title = soup.find("title")
        if title:
            result["marketPositioning"] = title.get_text(strip=True)
        
        # Extract meta description
        meta_desc = soup.find("meta", attrs={"name": "description"})
        if meta_desc and meta_desc.get("content"):
            result["companyDescription"] = meta_desc["content"]
        
        # Extract h1
        h1 = soup.find("h1")
        if h1:
            result["marketPositioning"] = h1.get_text(strip=True)
        
        # Extract body text (first 2000 chars)
        body_text = soup.get_text(separator=" ", strip=True)[:2000]
        if not result["companyDescription"] and body_text:
            sentences = body_text.split(".")
            result["companyDescription"] = ".".join(sentences[:3]) + "." if len(sentences) >= 3 else body_text[:500]
        
        # Try to find products/services section
        for heading in soup.find_all(["h2", "h3"]):
            text = heading.get_text(strip=True).lower()
            if any(kw in text for kw in ["product", "service", "feature", "solution", "offer"]):
                parent = heading.find_parent()
                if parent:
                    items = parent.find_all(["li", "p"])
                    for item in items[:10]:
                        item_text = item.get_text(strip=True)
                        if item_text and len(item_text) > 10:
                            result["products"].append(item_text[:200])
        
        if not result["products"]:
            # Fallback: extract all h2/h3 text as potential product indicators
            for heading in soup.find_all(["h2", "h3"])[:10]:
                text = heading.get_text(strip=True)
                if len(text) > 5 and len(text) < 100:
                    result["products"].append(text)
        
        result["products"] = list(dict.fromkeys(result["products"]))[:10]
        
        cache_set(f"scrape:{url}", result)
        
    except Exception as e:
        print(f"Scrape error for {url}: {e}")
    
    return result
