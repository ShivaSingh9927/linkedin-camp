import os
import asyncio
import httpx
from typing import List
from fastapi import FastAPI, HTTPException, Depends, Header
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv

from models import (
    GuessEmailRequest,
    GuessEmailResponse,
    VerifyEmailRequest,
    VerifyEmailResponse,
    EmailGuess,
    ResolveDomainRequest,
    ResolveDomainResponse,
)
from permutations import generate_permutations, normalize
from verifier import verify_email
from guesser import rank_permutations
from searcher import search_email_format
from resolver import resolve_domain

_root_env = os.path.join(os.path.dirname(__file__), "..", "..", ".env")
if os.path.isfile(_root_env):
    load_dotenv(_root_env)

app = FastAPI(title="Email Finder Service", description="Email guessing, SMTP verification, and web search fallback")

_cors_origins = [o.strip() for o in os.environ.get("CORS_ORIGIN", "*").split(",")]
app.add_middleware(
    CORSMiddleware,
    allow_origins=_cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Shared-secret auth. When EMAIL_FINDER_TOKEN is set, every guess/verify
# call must present it as `X-API-Key`. Unset = open (local dev only).
_EXPECTED_TOKEN = os.environ.get("EMAIL_FINDER_TOKEN", "")


def require_token(x_api_key: str = Header(default="")):
    if _EXPECTED_TOKEN and x_api_key != _EXPECTED_TOKEN:
        raise HTTPException(status_code=401, detail="Invalid or missing API key")


async def verify_batch(emails: List[str], concurrency: int = 5) -> List[dict]:
    sem = asyncio.Semaphore(concurrency)

    async def _verify(email: str) -> dict:
        async with sem:
            loop = asyncio.get_event_loop()
            try:
                result = await loop.run_in_executor(None, verify_email, email)
                return {"email": email, "result": result, "error": None}
            except Exception as e:
                return {"email": email, "result": None, "error": str(e)}

    tasks = [_verify(e) for e in emails]
    return await asyncio.gather(*tasks)


@app.post("/email-finder/guess", response_model=GuessEmailResponse, dependencies=[Depends(require_token)])
async def guess_email(req: GuessEmailRequest):
    fn = normalize(req.firstName)
    ln = normalize(req.lastName)

    if not fn or not ln:
        raise HTTPException(status_code=400, detail="firstName and lastName are required")

    # Resolve the domain from the company name when the caller didn't supply
    # one (DNS-candidate + crawl, no LinkedIn/API). This is the common path:
    # profile_visit hands us a company name, not a domain.
    domain = req.domain
    resolved_conf = None
    if not domain:
        if not req.company:
            raise HTTPException(status_code=400, detail="domain or company is required")
        loop = asyncio.get_event_loop()
        res = await loop.run_in_executor(None, resolve_domain, req.company)
        domain = res.get("domain")
        resolved_conf = res.get("confidence")
        if not domain:
            return GuessEmailResponse(
                success=False, email=None, source=None, verified=False,
                guesses_tried=0, all_guesses=[], domain=None, domain_confidence=None,
            )

    candidates = generate_permutations(req.firstName, req.lastName, domain)
    if not candidates:
        raise HTTPException(status_code=400, detail="Could not generate any email candidates")

    results = await verify_batch(candidates)

    verified = [r for r in results if r["result"] and r["result"].get("is_reachable") in ("safe", "risky")]
    is_catch_all = any(r["result"].get("smtp", {}).get("is_catch_all") for r in results if r["result"])

    # If catch-all detected, don't trust SMTP results — fall through to LLM + web search
    if verified and not is_catch_all:
        best = verified[0]
        return GuessEmailResponse(
            success=True,
            email=best["email"],
            source="permutation",
            verified=best["result"]["is_reachable"] == "safe",
            confidence="high" if best["result"]["is_reachable"] == "safe" else "medium",
            is_catch_all=False,
            guesses_tried=len(candidates),
            all_guesses=[
                EmailGuess(email=best["email"], rank=1, reason="SMTP verified")
            ],
            domain=domain,
            domain_confidence=resolved_conf,
        )

    # All failed — try LLM ranking + search fallback.
    # rank_permutations uses a synchronous OpenAI client; run it in a
    # thread so the LLM round-trip doesn't block the event loop.
    try:
        loop = asyncio.get_event_loop()
        ranked = await loop.run_in_executor(
            None,
            lambda: rank_permutations(
                first_name=req.firstName,
                last_name=req.lastName,
                company=req.company,
                domain=domain,
                candidates=candidates,
                job_title=req.jobTitle,
                industry=req.industry,
            ),
        )
    except Exception as e:
        return GuessEmailResponse(
            success=False,
            email=None,
            source=None,
            verified=False,
            guesses_tried=len(candidates),
            all_guesses=[],
        )

    search_prompt = ranked.get("search_prompt", "")

    # Try the web-search fallback for refined guesses
    refined_patterns = []
    if search_prompt:
        try:
            search_result = await search_email_format(domain, search_prompt)
            refined_patterns = search_result.get("patterns", [])
        except Exception:
            pass

    # Build refined candidates from patterns if found
    refined_candidates = []
    if refined_patterns:
        for pattern in refined_patterns:
            local = pattern.replace("{{first}}", fn).replace("{{last}}", ln).replace("{{f}}", fn[0]).replace("{{l}}", ln[0])
            refined_candidates.append(f"{local}@{domain}")

    # If catch-all, also try the same-name sample emails as a sanity check
    # (the SMTP layer will say "deliverable" either way, so we just trust the
    # pattern and skip the verify step here).
    if is_catch_all and refined_patterns:
        # Build the top pattern candidate and return it without verifying.
        top_pattern = refined_patterns[0]
        local = top_pattern.replace("{{first}}", fn).replace("{{last}}", ln).replace("{{f}}", fn[0]).replace("{{l}}", ln[0])
        best_email = f"{local}@{domain}"
        all_guesses_list = [EmailGuess(email=e, rank=i + 1, reason=r) for i, (e, r) in enumerate(
            zip([g["email"] for g in ranked.get("guesses", [])], [g["reason"] for g in ranked.get("guesses", [])])
        )]
        return GuessEmailResponse(
            success=True,
            email=best_email,
            source="research-pattern",
            verified=False,
            confidence="low",
            is_catch_all=True,
            guesses_tried=len(candidates) + len(refined_candidates),
            all_guesses=all_guesses_list,
            domain=domain,
            domain_confidence=resolved_conf,
        )

    # Verify refined candidates
    all_guesses_list = []
    if refined_candidates:
        refined_results = await verify_batch(refined_candidates)
        refined_verified = [r for r in refined_results if r["result"] and r["result"].get("is_reachable") in ("safe", "risky") and not r["result"].get("smtp", {}).get("is_catch_all")]
        if refined_verified:
            best = refined_verified[0]
            for i, g in enumerate(ranked.get("guesses", [])):
                all_guesses_list.append(EmailGuess(**g))
            return GuessEmailResponse(
                success=True,
                email=best["email"],
                source="research",
                verified=best["result"]["is_reachable"] == "safe",
                confidence="high" if best["result"]["is_reachable"] == "safe" else "medium",
                is_catch_all=False,
                guesses_tried=len(candidates) + len(refined_candidates),
                all_guesses=all_guesses_list,
                domain=domain,
                domain_confidence=resolved_conf,
            )

    for i, g in enumerate(ranked.get("guesses", [])):
        all_guesses_list.append(EmailGuess(**g))

    return GuessEmailResponse(
        success=False,
        email=None,
        source=None,
        verified=False,
        is_catch_all=is_catch_all,
        guesses_tried=len(candidates) + len(refined_candidates),
        all_guesses=all_guesses_list,
        domain=domain,
        domain_confidence=resolved_conf,
    )


@app.post("/email-finder/resolve-domain", response_model=ResolveDomainResponse, dependencies=[Depends(require_token)])
async def resolve_domain_endpoint(req: ResolveDomainRequest):
    if not req.company or not req.company.strip():
        raise HTTPException(status_code=400, detail="company is required")
    loop = asyncio.get_event_loop()
    res = await loop.run_in_executor(None, resolve_domain, req.company)
    return ResolveDomainResponse(
        company=req.company,
        domain=res.get("domain"),
        confidence=res.get("confidence"),
        method=res.get("method"),
        candidates_tried=res.get("candidates_tried", 0),
    )


@app.post("/email-finder/verify", response_model=VerifyEmailResponse, dependencies=[Depends(require_token)])
async def verify_email_endpoint(req: VerifyEmailRequest):
    if not req.email or "@" not in req.email:
        raise HTTPException(status_code=400, detail="Invalid email address")

    try:
        loop = asyncio.get_event_loop()
        result = await loop.run_in_executor(None, verify_email, req.email)
        return VerifyEmailResponse(
            success=True,
            email=req.email,
            is_reachable=result.get("is_reachable", "unknown"),
            smtp_details=result.get("smtp"),
        )
    except httpx.HTTPStatusError as e:
        raise HTTPException(status_code=e.response.status_code, detail=f"Reacher error: {e.response.text}")
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Verification failed: {str(e)}")


@app.get("/health")
async def health():
    return {"status": "ok", "service": "email-finder"}


if __name__ == "__main__":
    import uvicorn

    port = int(os.environ.get("PORT", "8002"))
    uvicorn.run(app, host="0.0.0.0", port=port)
