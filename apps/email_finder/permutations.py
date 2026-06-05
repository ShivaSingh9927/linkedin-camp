import re
import unicodedata
from typing import List

TEMPLATES = [
    "first!!",
    "f!!last!!",
    "f!!.last!!",
    "f!!_last!!",
    "last!!f!!",
    "last!!.f!!",
    "last!!_f!!",
    "l!!first!!",
    "l!!.first!!",
    "l!!_first!!",
    "first!!l!!",
    "first!!.l!!",
    "first!!_l!!",
    "last!!first!!",
    "last!!.first!!",
    "last!!_first!!",
    "first!!last!!",
    "first!!.last!!",
    "first!!_last!!",
    "first!!last!!1",
    "first!!last!!.1",
    "f!!last!!1",
    "f!!last!!.1",
    "first!!.last!!1",
    "first!!.last!!.1",
    "f!!.last!!1",
    "first!!l!!1",
    "f!!_last!!1",
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
