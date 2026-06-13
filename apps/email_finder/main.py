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
import store
import hunter

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


@app.on_event("startup")
def _init_store():
    try:
        store.init_db()
        print("[store] learning DB ready", flush=True)
    except Exception as e:
        print(f"[store] init failed (continuing without cache): {e}", flush=True)


# How many of the (priority-ordered) permutations we ever SMTP-probe. The
# tail beyond this is reserved for LLM ranking / web-search fallback only —
# probing all 19 per lead would blow the backend's 60s budget AND torch the
# box's sending-IP reputation with rapid RCPT probes.
MAX_SMTP_PROBE = int(os.environ.get("EMAIL_FINDER_MAX_PROBE", "12"))
PROBE_BATCH = 3

# Hard wall-clock ceiling for the ENTIRE /guess pipeline (resolve + probe +
# LLM + crawl + refined verify). Kept comfortably under the backend client's
# 60s timeout so a domain that hangs every SMTP probe (greylisting / silent
# drop) returns a clean miss instead of running to the client timeout. This
# is the definitive timeout guard — the per-stage caps only bound their own
# stage; this bounds the sum.
GUESS_DEADLINE_S = float(os.environ.get("EMAIL_FINDER_GUESS_DEADLINE", "60"))


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


async def verify_until_hit(emails: List[str], batch_size: int = PROBE_BATCH):
    """Probe candidates in priority order, stopping at the first usable hit.

    Returns (hit, is_catch_all, tried). `hit` is the first result whose
    is_reachable is safe/risky and is NOT catch-all; None if none found.
    If a catch-all is detected, SMTP is unreliable for this domain, so we
    stop probing immediately and let the LLM/search path take over.
    """
    is_catch_all = False
    tried = 0

    for i in range(0, len(emails), batch_size):
        batch = emails[i : i + batch_size]
        results = await verify_batch(batch)
        tried += len(batch)

        for r in results:
            res = r["result"]
            if not res:
                continue
            if res.get("smtp", {}).get("is_catch_all"):
                is_catch_all = True
            if res.get("is_reachable") in ("safe", "risky") and not res.get("smtp", {}).get("is_catch_all"):
                return r, is_catch_all, tried

        if is_catch_all:
            break

    return None, is_catch_all, tried


@app.post("/email-finder/guess", response_model=GuessEmailResponse, dependencies=[Depends(require_token)])
async def guess_email(req: GuessEmailRequest):
    fn = normalize(req.firstName)
    ln = normalize(req.lastName)

    if not fn or not ln:
        raise HTTPException(status_code=400, detail="firstName and lastName are required")

    # Hard global deadline. HTTPExceptions (e.g. 400 for missing company)
    # propagate normally; only a wall-clock overrun is converted to a clean
    # miss so the caller never waits past its own timeout.
    try:
        return await asyncio.wait_for(_guess_pipeline(req, fn, ln), timeout=GUESS_DEADLINE_S)
    except asyncio.TimeoutError:
        print(f"[guess] deadline {GUESS_DEADLINE_S}s exceeded for {req.firstName} {req.lastName} @ {req.company or req.domain} — returning miss", flush=True)
        return GuessEmailResponse(
            success=False, email=None, source=None, verified=False,
            guesses_tried=0, all_guesses=[], domain=None, domain_confidence=None,
        )


async def _guess_pipeline(req: GuessEmailRequest, fn: str, ln: str):
    # Resolve the domain from the company name when the caller didn't supply
    # one (DNS-candidate + crawl, no LinkedIn/API). This is the common path:
    # profile_visit hands us a company name, not a domain.
    domain = req.domain
    resolved_conf = None
    if not domain:
        if not req.company:
            raise HTTPException(status_code=400, detail="domain or company is required")
        # Persistent company->domain cache: skip DNS/crawl resolution for a
        # company we've resolved before.
        cached_dom = store.get_cached_domain(req.company)
        if cached_dom:
            domain = cached_dom["domain"]
            resolved_conf = cached_dom.get("confidence")
        else:
            loop = asyncio.get_event_loop()
            res = await loop.run_in_executor(None, resolve_domain, req.company)
            domain = res.get("domain")
            resolved_conf = res.get("confidence")
            # Only persist HIGH-confidence (homepage-confirmed) resolutions to
            # the company->domain cache. Caching a weak search/medium guess
            # poisons every future lead at that company AND blocks the
            # resolver's own guards (e.g. parked-domain rejection) from ever
            # re-running. Weak resolutions are re-derived each time instead.
            if domain and resolved_conf == "high":
                store.put_cached_domain(req.company, domain, resolved_conf, res.get("method"))
        if not domain:
            return GuessEmailResponse(
                success=False, email=None, source=None, verified=False,
                guesses_tried=0, all_guesses=[], domain=None, domain_confidence=None,
            )

    # Learned-pattern fast path: if we already know this domain's email
    # pattern from a previous lead, skip the whole probe/LLM/crawl pipeline.
    learned = store.get_best_pattern(domain)
    if learned:
        cand = store.build_email(learned["pattern"], req.firstName, req.lastName, domain)
        if learned["is_catch_all"]:
            # Catch-all domains can't be SMTP-confirmed by anyone — return the
            # learned pattern as a high-confidence guess (never auto-sent).
            return GuessEmailResponse(
                success=True, email=cand, source="learned-pattern",
                verified=False, confidence="high", is_catch_all=True,
                guesses_tried=0,
                all_guesses=[EmailGuess(email=cand, rank=1,
                    reason=f"learned company pattern (n={learned['count']})")],
                domain=domain, domain_confidence=resolved_conf,
            )
        # Verifiable domain: confirm the single learned candidate with one probe.
        lhit, _, ltried = await verify_until_hit([cand])
        if lhit and lhit["result"].get("is_reachable") == "safe":
            store.record_verified_email(domain, req.firstName, req.lastName, cand, is_catch_all=False)
            return GuessEmailResponse(
                success=True, email=cand, source="learned-pattern",
                verified=True, confidence="high", is_catch_all=False,
                guesses_tried=ltried,
                all_guesses=[EmailGuess(email=cand, rank=1,
                    reason=f"learned company pattern, verified (n={learned['count']})")],
                domain=domain, domain_confidence=resolved_conf,
            )
        # Learned pattern didn't confirm — fall through to the full pipeline.

    candidates = generate_permutations(req.firstName, req.lastName, domain)
    if not candidates:
        raise HTTPException(status_code=400, detail="Could not generate any email candidates")

    # Probe only the high-probability block, in priority order, with early
    # exit on the first usable hit. Common case: 1 batch (3 probes) instead
    # of verifying all candidates.
    probe_candidates = candidates[:MAX_SMTP_PROBE]
    best, is_catch_all, tried = await verify_until_hit(probe_candidates)

    # If catch-all detected, don't trust SMTP results — fall through to LLM + web search
    if best and not is_catch_all:
        # Learn the pattern for this domain (strongest signal: SMTP-confirmed).
        if best["result"]["is_reachable"] == "safe":
            store.record_verified_email(domain, req.firstName, req.lastName, best["email"], is_catch_all=False)
        return GuessEmailResponse(
            success=True,
            email=best["email"],
            source="permutation",
            verified=best["result"]["is_reachable"] == "safe",
            confidence="high" if best["result"]["is_reachable"] == "safe" else "medium",
            is_catch_all=False,
            guesses_tried=tried,
            all_guesses=[
                EmailGuess(email=best["email"], rank=1, reason="SMTP verified")
            ],
            domain=domain,
            domain_confidence=resolved_conf,
        )

    # Hunter.io fallback — runs BEFORE the slow LLM+crawl so a hit short-
    # circuits the expensive path (also bounds latency). Strictly gated: only
    # when configured and we haven't already spent a credit on this company
    # (negative cache). Its pattern is cached into the DB for free reuse.
    if hunter.enabled():
        neg_key = store.company_key(req.company) or domain
        if not store.hunter_tried(neg_key):
            loop = asyncio.get_event_loop()
            hres = await loop.run_in_executor(
                None, lambda: hunter.find_email(req.firstName, req.lastName,
                                                domain=domain, company=req.company))
            store.mark_hunter_tried(neg_key)
            if hres and hres.get("email"):
                h_email = hres["email"]
                h_domain = hres.get("domain") or domain
                h_accept_all = bool(hres.get("accept_all"))
                h_status = ((hres.get("verification") or {}).get("status"))
                # Learn the pattern (+ Hunter's corrected domain) for free reuse.
                store.record_verified_email(h_domain, req.firstName, req.lastName,
                                            h_email, is_catch_all=h_accept_all)
                if req.company and h_domain:
                    store.put_cached_domain(req.company, h_domain, "hunter", "hunter")
                send_safe = (h_status == "valid" and not h_accept_all)
                return GuessEmailResponse(
                    success=True, email=h_email, source="hunter",
                    verified=send_safe,
                    confidence="high" if send_safe else "medium",
                    is_catch_all=h_accept_all,
                    guesses_tried=tried,
                    all_guesses=[EmailGuess(email=h_email, rank=1,
                        reason=f"hunter.io (score={hres.get('score')}, status={h_status})")],
                    domain=h_domain, domain_confidence=resolved_conf,
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
        # Learn the harvested pattern for this catch-all domain so future leads
        # here resolve instantly via the learned-pattern fast path.
        store.record_pattern(domain, top_pattern, is_catch_all=True)
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
        refined_hit, _, _ = await verify_until_hit(refined_candidates)
        if refined_hit:
            best = refined_hit
            if best["result"]["is_reachable"] == "safe":
                store.record_verified_email(domain, req.firstName, req.lastName, best["email"], is_catch_all=False)
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
