"""Score regex extractor against ground truth in CSV."""
import sys
import csv
import re
sys.path.insert(0, '/home/shiva/Documents/linkedin-camp')
from regex_extractor import extract_info

with open("smart_list_test6-2026-06-06 (1).csv") as f:
    rows = list(csv.DictReader(f))

# Ground truth from CSV
total = {'company': 0, 'education': 0, 'location': 0, 'job_profile': 0}
found = {'company': 0, 'education': 0, 'location': 0, 'job_profile': 0}
missing_before = {'company': 0, 'education': 0, 'location': 0, 'job_profile': 0}
found_in_missing = {'company': 0, 'education': 0, 'location': 0, 'job_profile': 0}

for r in rows:
    info = r.get('info', '').strip()
    if not info:
        continue
    extracted = extract_info(info)
    for field in ['company', 'education', 'location', 'job_profile']:
        gt = r.get({'job_profile': 'jobProfile'}.get(field, field), '').strip()
        # Skip ground truth that's just noise
        is_noise = gt.lower() in ('2nd degree connection', '3rd+ degree connection', '1st degree connection', '')
        if not is_noise and gt:
            total[field] += 1
            if extracted[field] and extracted[field].lower() in gt.lower():
                found[field] += 1
        elif not gt and info:
            # Row was missing this field — see if regex found something new
            if extracted[field]:
                found_in_missing[field] += 1
                missing_before[field] += 1
            else:
                missing_before[field] += 1

print("─" * 60)
print("EXTRACTION RESULTS — Regex vs Ground Truth")
print("─" * 60)
for f in ['company', 'education', 'location', 'job_profile']:
    if total[f] > 0:
        pct = 100 * found[f] / total[f]
        print(f"  {f:13s}: {found[f]:>2}/{total[f]:<2} correct ({pct:.0f}%)")
    print(f"  {f:13s}: found new in {found_in_missing[f]}/{missing_before[f]} previously-empty rows")
print("─" * 60)
