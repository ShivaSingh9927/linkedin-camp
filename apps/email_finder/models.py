from typing import Optional, List
from pydantic import BaseModel


class GuessEmailRequest(BaseModel):
    firstName: str
    lastName: str
    company: str
    # Optional now — when omitted, the service resolves it from `company`
    # via resolver.resolve_domain (DNS-candidate + crawl, no LinkedIn/API).
    domain: Optional[str] = None
    jobTitle: Optional[str] = None
    industry: Optional[str] = None


class ResolveDomainRequest(BaseModel):
    company: str


class ResolveDomainResponse(BaseModel):
    company: str
    domain: Optional[str] = None
    confidence: Optional[str] = None
    method: Optional[str] = None
    candidates_tried: int = 0


class VerifyEmailRequest(BaseModel):
    email: str


class EmailGuess(BaseModel):
    email: str
    rank: int
    reason: str


class GuessEmailResponse(BaseModel):
    success: bool
    email: Optional[str] = None
    source: Optional[str] = None
    verified: bool = False
    confidence: Optional[str] = None
    is_catch_all: bool = False
    guesses_tried: int = 0
    all_guesses: List[EmailGuess] = []
    # Populated when the domain was resolved from the company name.
    domain: Optional[str] = None
    domain_confidence: Optional[str] = None


class VerifyEmailResponse(BaseModel):
    success: bool
    email: str
    is_reachable: str = "unknown"
    smtp_details: Optional[dict] = None
