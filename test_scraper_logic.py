"""Test the new parseCardContentLines logic against actual CSV info text."""
import re
import csv

# ---- Inlined JS logic for testing ----
LOC_PREFIX_CITIES = re.compile(r'^(Mumbai|New Delhi|Delhi|Bangalore|Bengaluru|Hyderabad|Chennai|Kolkata|Pune|Noida|Gurugram|Gurgaon|Faridabad|Agra|Nashik|Lucknow|Jaipur|Ahmedabad|Indore|Bhopal|Chandigarh|Coimbatore|Kochi|Thiruvananthapuram|Visakhapatnam|Nagpur|Patna|Ranchi|Dehradun|New York|London|San Francisco|Bay Area|Los Angeles|Seattle|Chicago|Toronto|Vancouver|Sydney|Melbourne|Singapore|Dubai|Berlin|Munich|Paris|Amsterdam|Lahore|Canton|Mandya|Pune District|Thane District|Bengaluru Rural|Bemetara|Valsad|Vapi|Bokaro|Alwar|Ghaziabad|Suryapet|Kanpur Nagar|Greater Delhi Area|Greater Mumbai Area|Greater Bangalore Area|Greater Chennai Area|Greater Hyderabad Area|Greater Kolkata Area|Greater Pune Area)\b', re.I)
LOC_COUNTRY_SUFFIX = re.compile(r',\s*(India|United States|UK|USA|Canada|Australia|Germany|France|Singapore|Dubai|Netherlands|Pakistan|China|Japan|Brazil|Mexico|Spain|Italy|Indonesia|Philippines|Malaysia|Bangladesh|Nepal|Sri Lanka|Thailand|Vietnam|South Korea|Russia|Turkey|Saudi Arabia|UAE|Ireland|Sweden|Norway|Denmark|Finland|Switzerland|Belgium|Austria|Czech Republic|Poland|Romania|Ukraine|Argentina|Chile|Colombia|Peru|Egypt|Nigeria|Kenya|South Africa|Ghana|Ethiopia|Tanzania)\s*$', re.I)

def is_likely_location_line(line):
    if not line: return False
    if line.startswith('•'): return False
    if len(line) < 2 or len(line) > 80: return False
    if '|' in line or '@' in line: return False
    if re.search(r'\bat\s+', line): return False
    if LOC_PREFIX_CITIES.match(line): return True
    if LOC_COUNTRY_SUFFIX.search(line): return True
    return False

def split_title_and_company(line):
    if not line: return '', ''
    # First, take only the part before the first pipe — pipes usually separate
    # title+company from education/skills/location.
    if '|' in line:
        line = line.split('|')[0].strip()
    # Also strip " || " separators (some cards use double pipes)
    if '||' in line:
        line = line.split('||')[0].strip()
    # Also strip bullet " • " (some cards use bullets)
    if '•' in line:
        line = line.split('•')[0].strip()
    if not line: return '', ''
    m = re.search(r'\s+at\s+(.+)', line)
    if m:
        company = m.group(1).split('|')[0].split('•')[0].strip()
        company = re.sub(r'\s*\|\s*(LLM|ML|AI|NLP|DL|Gen|Python|Java|Building|Lead|Senior|Junior|Engineer).*$', '', company, flags=re.I).strip()
        if len(company) > 1:
            title = line[:m.start()].strip()
            return title, company
    m2 = re.match(r'^(.+?)\s*@\s*([A-Z][\w&\'.\-]+(?:\s+[A-Z][\w&\'.\-]+){0,3})', line)
    if m2:
        company = m2.group(2).split('|')[0].split('•')[0].strip()
        if len(company) > 1:
            return m2.group(1).strip(), company
    # Special case: lowercase gerund + " @ Company" — the gerund isn't a real
    # title, the company is. e.g. "building conversational AI @ ixigo"
    gerund_re = re.match(r'^(building|working|leading|designing|developing|creating|building|shipping|hiring|ex-|former|ex)[\w\s]*?\s*@\s*([A-Z][\w&\'.\-]+)', line, re.I)
    if gerund_re:
        return '', gerund_re.group(2).strip()
    return line.strip(), ''

def parse_card_content_lines(lines, own_name):
    job_title = ''
    company = ''
    location = ''

    # Education-only-line detection: a line containing only school keywords
    # (no " at ", no " @ ", no job keyword) is treated as education, not a
    # job title. e.g. "IIT Kanpur CSE", "Undergraduate from Indian Institute..."
    SCHOOL_KW = re.compile(r'\b(IIT[\s\-\']?\w*|IIIT(?:\s+\w+)?|NIT(?:\s+\w+)?|BITS(?:\s+\w+)?|Indian Institute of Technology|National Institute of Technology|Birla Institute|Manipal|VIT|SRM|Amity|Thapar|MIT|Stanford|Harvard)\b', re.I)
    EDUCATION_PHRASE = re.compile(r'^\s*(?:undergraduate|graduate|alumni|student|studying|studied|alumnus|fresher|freshers)\b', re.I)

    for line in lines:
        if not line or line == own_name: continue
        if line.startswith('•'): continue
        # Defense in depth: skip degree-badge text just in case
        if re.match(r'^\d+(st|nd|rd|th)\+?\s*degree\s*connection$', line, re.I): continue
        if len(line) < 2: continue
        if re.match(r'^Current:', line, re.I):
            after = re.sub(r'^Current:\s*', '', line, flags=re.I).strip()
            if ' at ' in after:
                parts = after.split(' at ')
                if not job_title: job_title = parts[0].strip()
                company = ' at '.join(parts[1:]).split('|')[0].strip()
            elif ' @ ' in after:
                parts = after.split(' @ ')
                if not job_title: job_title = parts[0].strip()
                company = ' @ '.join(parts[1:]).split('|')[0].strip()
            elif not job_title:
                job_title = after
            continue
        if re.match(r'^(Past|Education|Skills|Certifications|Summary):', line, re.I): continue
        if line.endswith('followers') or re.match(r'^Visit my', line, re.I): continue
        if re.search(r'mutual connection', line, re.I): continue
        if not location and is_likely_location_line(line):
            location = line
            continue
        # Skip education-only lines (don't set as jobTitle)
        is_education_line = (
            (' at ' not in line and ' @ ' not in line and '@' not in line) and
            (SCHOOL_KW.search(line) or EDUCATION_PHRASE.match(line))
        )
        if is_education_line:
            continue
        if not job_title and len(line) > 2 \
            and not re.match(r'^(Connect|Follow|Message|Send|Pending|More|Dismiss|Promoted)$', line, re.I) \
            and not re.match(r'^\d+(st|nd|rd|th)\+?$', line, re.I):
            title, comp = split_title_and_company(line)
            if title and len(title) >= 2:
                job_title = title
                if comp and not company:
                    company = comp
            elif comp and not company:
                # Gerund-only line — we got a company but no title. Use company.
                company = comp
    return job_title, company, location

# ---- Test on actual CSV ----
def to_content_lines(info_text, name):
    """Mimic content.js preprocessing of cardEl.innerText."""
    name_str = f"{name[0]} {name[1]}" if len(name) >= 2 else name[0]
    lines = [l.strip() for l in info_text.split('\n') if l.strip()]
    out = []
    for l in lines:
        if l == name_str or l == 'LinkedIn Member': continue
        if re.match(r'^(Connect|Follow|Message|Send|Pending|More|Dismiss)$', l, re.I): continue
        if re.match(r'^\d+(st|nd|rd|th)\+?$', l, re.I): continue
        if re.match(r'^•\s*(1st|2nd|3rd\+?)', l, re.I): continue
        # Connection-degree badge line (the one right after • 2nd)
        if re.match(r'^\d+(st|nd|rd|th)\+?\s*degree\s*connection$', l, re.I): continue
        if re.match(r'^Status is (offline|online|away)$', l, re.I): continue
        if re.match(r"^(Open profile photo|View .+?('s|s) profile)", l, re.I): continue
        if re.match(r'^Promoted$', l, re.I): continue
        if len(l) < 3: continue
        out.append(l)
    return out

with open("smart_list_test6-2026-06-06 (1).csv") as f:
    rows = list(csv.DictReader(f))

print(f"{'#':>3} | {'Name':24s} | {'jobTitle':30s} | {'company':25s} | {'location':20s}")
print("-" * 120)
correct_job, correct_comp, correct_loc = 0, 0, 0
total_with_gt = 0
for i, r in enumerate(rows):
    info = r.get('info', '').strip()
    if not info: continue
    name = [r['firstName'], r['lastName']]
    content = to_content_lines(info, name)
    jt, co, lo = parse_card_content_lines(content, name[0])
    nm = f"{name[0]} {name[1]}"[:24]

    gt_jt = r.get('jobProfile', '').strip()
    gt_co = r.get('company', '').strip()
    gt_lo = r.get('location', '').strip()

    def is_noise(v):
        return v.lower() in ('2nd degree connection', '3rd+ degree connection', '1st degree connection', '')

    if not is_noise(gt_jt) or not is_noise(gt_co) or not is_noise(gt_lo):
        total_with_gt += 1
        if not is_noise(gt_jt) and jt and jt.lower() in gt_jt.lower(): correct_job += 1
        if not is_noise(gt_co) and co and co.lower() in gt_co.lower(): correct_comp += 1
        if not is_noise(gt_lo) and lo and lo.lower() in gt_lo.lower(): correct_loc += 1

    print(f"{i+1:>3} | {nm:24s} | {jt[:35]:35s} | {co[:25]:25s} | {lo[:20]:20s}")

print()
print(f"Accuracy (vs ground truth in CSV):")
print(f"  jobTitle:  {correct_job} correct out of rows with valid GT")
print(f"  company:   {correct_comp}")
print(f"  location:  {correct_loc}")
