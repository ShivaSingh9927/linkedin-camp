import re
import unicodedata
from typing import List

# Ordered by real-world corporate prevalence — highest-probability first.
# generate_permutations preserves this order, and the verifier probes in
# order with early-exit, so the common patterns get checked first and the
# long tail rarely hits SMTP at all. The first 12 are the "probe block"
# (see MAX_SMTP_PROBE in main.py); the rest are LLM-fallback candidates only.
TEMPLATES = [
    "first!!.last!!",   # jane.doe
    "first!!last!!",    # janedoe
    "f!!last!!",        # jdoe
    "first!!",          # jane
    "first!!_last!!",   # jane_doe
    "last!!.first!!",   # doe.jane
    "first!!l!!",       # janed
    "f!!.last!!",       # j.doe
    "last!!first!!",    # doejane
    "l!!first!!",       # djane
    "f!!_last!!",       # j_doe
    "last!!_first!!",   # doe_jane
    # --- low-probability tail (LLM ranking / catch-all fallback only) ---
    "last!!f!!",
    "last!!.f!!",
    "last!!_f!!",
    "l!!.first!!",
    "l!!_first!!",
    "first!!.l!!",
    "first!!_l!!",
]


def normalize(name: str) -> str:
    name = name.strip().lower()
    name = unicodedata.normalize("NFKD", name)
    name = name.encode("ascii", "ignore").decode("ascii")
    name = re.sub(r"[^a-z]", "", name)
    return name


def generate_permutations(first_name: str, last_name: str, domain: str) -> List[str]:
    fn = normalize(first_name)
    ln = normalize(last_name)
    f = fn[0] if fn else ""
    l = ln[0] if ln else ""

    if not fn or not ln or not domain:
        return []

    seen = set()
    results = []

    for template in TEMPLATES:
        local_part = template.replace("first!!", fn)
        local_part = local_part.replace("last!!", ln)
        local_part = local_part.replace("f!!", f)
        local_part = local_part.replace("l!!", l)

        email = f"{local_part}@{domain}"
        if email not in seen:
            seen.add(email)
            results.append(email)

    return results
