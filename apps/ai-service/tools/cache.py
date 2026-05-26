import os
import json
import time
from typing import Optional, Any

CACHE_DIR = os.path.join(os.path.dirname(__file__), "..", ".cache")
os.makedirs(CACHE_DIR, exist_ok=True)

def cache_get(key: str) -> Optional[Any]:
    filepath = os.path.join(CACHE_DIR, f"{hash(key)}.json")
    if not os.path.exists(filepath):
        return None
    try:
        with open(filepath, "r") as f:
            data = json.load(f)
        if time.time() - data.get("timestamp", 0) > 86400:
            os.remove(filepath)
            return None
        return data.get("value")
    except Exception:
        return None

def cache_set(key: str, value: Any) -> None:
    filepath = os.path.join(CACHE_DIR, f"{hash(key)}.json")
    try:
        with open(filepath, "w") as f:
            json.dump({"value": value, "timestamp": time.time()}, f)
    except Exception:
        pass
