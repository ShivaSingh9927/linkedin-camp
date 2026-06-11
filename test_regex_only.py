"""Test regex pre-extractor on user's actual CSV."""
import csv
import re

def regex_pre_extract(info_text):
    if not info_text:
        return {}
    result = {}
    lines = [l.strip() for l in info_text.split('\n') if l.strip()]

    # Strip noise
    content_lines = [l for l in lines
        if not l.startswith('View ')
        and not re.match(r'^•\s*\d', l)
        and not re.match(r'^\d+(st|nd|rd|th)\+?\s*degree', l, re.I)
        and l.lower() not in ('2nd degree connection', '3rd+ degree connection')]

    # Company: " at X" or "@X"
    company_pattern = re.compile(r'(?:^|\s)(?:at|@)\s+([A-Z][A-Za-z0-9&\'.]+(?:\s+[A-Z][A-Za-z0-9&\'.]+){0,4})')
    for line in content_lines:
        m = company_pattern.search(line)
        if m:
            c = m.group(1).split('|')[0].strip()
            if 1 < len(c) < 60 and not re.match(r'^(Ex|AI|ML|the)$', c, re.I):
                result['company'] = c
                break

    # Education
    edu_kw = re.compile(r'(?:IIT|IIIT|NIT|BITS|MIT|Stanford|Harvard|Berkeley|CMU|Caltech|Oxford|Cambridge)', re.I)
    deg_kw = re.compile(r'\b(BTech|MTech|B\.Tech|M\.Tech|BE|ME|MSc|MS|PhD|MBA|BBA|BA|BS|BSc)\b')
    for line in content_lines:
        if edu_kw.search(line) or deg_kw.search(line):
            parts = [p.strip() for p in line.split('|')]
            for p in parts:
                if edu_kw.search(p) or deg_kw.search(p):
                    edu = re.sub(r'\s*\|\s*Ex.*$', '', p).strip()
                    if len(edu) < 100:
                        result['education'] = edu
                        break
            if result.get('education'):
                break

    # Location: last short non-pipe line
    for i in range(len(content_lines) - 1, -1, -1):
        l = content_lines[i]
        if len(l) < 50 and '|' not in l and not re.search(r'\b(at|@)\b', l) and len(l.split()) <= 5:
            result['location'] = l
            break

    return result

# Test
with open("smart_list_test6-2026-06-06 (1).csv") as f:
    rows = list(csv.DictReader(f))

print(f"{'#':>3} | {'Name':30s} | {'company':25s} | {'education':35s} | {'location':20s}")
print("-" * 120)
for i, r in enumerate(rows):
    info = r.get('info', '')
    res = regex_pre_extract(info)
    name = f"{r['firstName']} {r['lastName']}"
    print(f"{i+1:>3} | {name:30s} | {res.get('company',''):25s} | {res.get('education',''):35s} | {res.get('location',''):20s}")
