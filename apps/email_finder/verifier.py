from typing import Optional
import httpx
from tenacity import retry, stop_after_attempt, wait_exponential, retry_if_exception_type

from config import REACHER_URL

REACHER_TIMEOUT = 30.0


@retry(
    stop=stop_after_attempt(3),
    wait=wait_exponential(multiplier=1, min=1, max=5),
    retry=retry_if_exception_type((httpx.TimeoutException, httpx.ConnectError)),
)
def verify_email(
    email: str,
    proxy: Optional[dict] = None,
    timeout: float = REACHER_TIMEOUT,
) -> dict:
    payload = {"to_email": email}
    if proxy:
        payload["proxy"] = proxy

    with httpx.Client(timeout=timeout) as client:
        resp = client.post(f"{REACHER_URL}/v0/check_email", json=payload)
        resp.raise_for_status()
        return resp.json()
