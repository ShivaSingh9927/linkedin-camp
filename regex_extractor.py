"""
Comprehensive regex/heuristic extractor for LinkedIn profile cards.
Pure Python, no model, no network. Tested on real CSVs.
"""

import re
import csv
import json

# Words that should never be extracted as company names
COMPANY_STOPWORDS = {
    'AI', 'ML', 'NLP', 'LLM', 'LLMs', 'DL', 'Gen', 'Generative', 'Agentic',
    'Data', 'Cloud', 'Open', 'Source', 'Building', 'Future', 'The',
    'Ex', 'Senior', 'Junior', 'Lead', 'Chief', 'Head', 'Principal',
    'Engineer', 'Engineering', 'Developer', 'Scientist', 'Analyst',
    'Consultant', 'Architect', 'Manager', 'Director',
    'IIT', 'IIIT', 'NIT', 'BITS', 'MIT', 'Stanford',
    'Machine', 'Learning', 'Deep', 'Computer', 'Vision',
    'Python', 'Java', 'JavaScript', 'C++', 'Rust', 'Go',
    'Solutions', 'Services', 'Technologies', 'Tech', 'Systems',
    'Research', 'Innovation', 'Advanced', 'Edge',
    'Building', 'Built', 'On', 'With', 'From', 'Into', 'For', 'And', 'Or',
    'Production', 'Production-Scale', 'RAG', 'Agentic', 'Agents',
    'LangChain', 'LangGraph', 'Django', 'FastAPI', 'TensorFlow', 'OpenCV',
    'Jetson', 'JetsonNano', 'AWS', 'Azure', 'GCP',
    'LeetCode', 'HackerRank', 'Codeforces', 'GitHub',
    'Bengaluru', 'Kanpur', 'Mumbai', 'Pune', 'Hyderabad', 'Delhi',
    'Thane', 'Agra', 'Bokaro', 'Alwar', 'Ghaziabad', 'Lucknow', 'Valsad',
    'Vapi', 'Bemetara', 'Suryapet',
}

# Common first names that could be falsely extracted (conservative set)
FIRSTNAME_TOKENS = {
    'Aarushi', 'Abhishek', 'Amit', 'Anmol', 'Arush', 'Aryanil', 'Ashutosh',
    'Ayush', 'Bhoomi', 'Dhananjay', 'Harsh', 'Kartik', 'Kusal', 'Lokesh',
    'Omkar', 'Pramod', 'Sahil', 'Sai', 'Sarthak', 'Shailesh', 'Shiv',
    'Shivanshu', 'Shivprasad', 'Somya', 'Swayam', 'Tanmay', 'Veer', 'Akhand',
    'Sneh', 'Patel', 'Kumar', 'Yadav', 'Kannojia', 'Garg', 'Reddy', 'Singh',
    'Gupta', 'Arora', 'Mandaliya', 'Chaudhari', 'Chaudhary', 'Nanekar',
    'Solanki', 'Kulshrestha', 'Agarwal',
}


def strip_noise_lines(text):
    """Remove LinkedIn card noise (profile view, degree badges, etc)."""
    lines = [l.strip() for l in text.split('\n') if l.strip()]
    return [l for l in lines
            if not l.startswith('View ')
            and not re.match(r'^•\s*\d', l)
            and not re.match(r'^\d+(st|nd|rd|th)\+?\s*degree', l, re.I)
            and l.lower() not in ('2nd degree connection', '3rd+ degree connection', '1st degree connection')]


def is_likely_company(s):
    """Heuristic: is this string likely a company name?"""
    if not s or len(s) < 2 or len(s) > 60:
        return False
    # Strip trailing pipe-separated junk
    s = s.split('|')[0].strip()
    # Reject if any token is in stopwords
    tokens = s.split()
    if any(t in COMPANY_STOPWORDS for t in tokens):
        return False
    # Reject if first word is a known first name (means we caught a person, not a company)
    if tokens[0] in FIRSTNAME_TOKENS:
        return False
    # Must start with uppercase or be a known acronym
    if not (s[0].isupper() or s.isupper()):
        return False
    return True


def is_likely_school(s):
    """Heuristic: is this string a school/degree?"""
    if not s or len(s) < 2 or len(s) > 100:
        return False
    school_kw = re.search(
        r'(?:IIT|IIIT|NIT|BITS|MIT|Stanford|Harvard|Berkeley|CMU|Caltech|'
        r'Oxford|Cambridge|IITK|IITB|IITM|IITD|IITR|IITG|IITKGP|'
        r'Indian Institute of Technology|National Institute of Technology|'
        r'Birla Institute|Manipal|VIT|SRM|Amity|Thapar|'
        r'IIIT (?:Lucknow|Bangalore|Hyderabad|Delhi|Allahabad))',
        s, re.I)
    degree_kw = re.search(
        r'\b(BTech|MTech|B\.Tech|M\.Tech|BE|ME|MSc|MS|PhD|MBA|BBA|BSc|MS)\b', s)
    if school_kw or degree_kw:
        # Truncate at "Ex X" tails
        s = re.sub(r'\s*\|\s*Ex.*$', '', s, flags=re.I).strip()
        s = re.sub(r'\s*•\s*Ex.*$', '', s, flags=re.I).strip()
        if len(s) <= 100:
            return True
    return False


def is_likely_location(s):
    """Heuristic: is this string a city/location?"""
    if not s or len(s) < 2 or len(s) > 50:
        return False
    if '|' in s or '@' in s or ' at ' in s.lower():
        return False
    if re.search(r'\b(at|@)\b', s):
        return False
    # Must be 1-5 words, not look like a title
    tokens = s.split()
    if len(tokens) > 5:
        return False
    # Reject if starts with lowercase (title-like)
    if s[0].islower():
        return False
    # Reject if contains common title words
    if any(re.search(rf'\b{t}\b', s, re.I) for t in
           ['Engineer', 'Scientist', 'Developer', 'Manager', 'Director',
            'Building', 'Lead', 'Senior', 'AI', 'ML', 'CTO', 'CEO', 'CFO']):
        return False
    return True


def extract_company(content_lines):
    """Try patterns in order of specificity."""
    # 1. "at CompanyName" (with space)
    for line in content_lines:
        m = re.search(r'\bat\s+([A-Z][A-Za-z0-9&\'.]+(?:\s+[A-Z][A-Za-z0-9&\'.]+){0,5})', line)
        if m:
            c = m.group(1).split('|')[0].split('•')[0].strip()
            c = re.sub(r'\s+(LLM|ML|AI|NLP|DL|Gen|Python|Java|Rust|Go|React).*$', '', c, flags=re.I).strip()
            if is_likely_company(c):
                return c
        m2 = re.search(r'\bat\s+([A-Z][\w\.\&\'\-]+(?:\s+[A-Z][\w\.\&\'\-]+){0,4})', line)
        if m2:
            c = m2.group(1).split('|')[0].split('•')[0].strip()
            if is_likely_company(c) and len(c) > 2:
                return c

    # 2. "@ CompanyName" or "@CompanyName"
    for line in content_lines:
        matches = re.finditer(r'@(\s*)([A-Z][\w\.\&\-\']*(?:\s+[A-Z][\w\.\&\-\']*){0,4})', line)
        for m in matches:
            c = m.group(2).split('|')[0].split('•')[0].strip()
            if is_likely_company(c) and len(c) > 1:
                return c

    return None


def extract_job_title(content_lines, company):
    """Extract job title — usually the first non-noise line, before 'at' or '@'."""
    title_keywords = re.compile(
        r'\b(Engineer|Developer|Scientist|Architect|Manager|Director|Analyst|'
        r'Consultant|Designer|Lead|Head|Chief|CTO|CEO|CFO|COO|CMO|'
        r'Founder|Co-?founder|VP|President|'
        r'Intern|Fresher|Trainee|Associate|Senior|Junior|Principal|Staff|'
        r'Officer|Specialist|Strategist|Producer|Researcher|Writer|'
        r'Marketer|Salesperson|Sales|Recruiter|HR|Human|Resources|'
        r'Engineer 2)\b', re.I)
    for line in content_lines:
        if title_keywords.search(line) and len(line) < 200:
            title = line
            # Split on " at " (most common)
            if re.search(r'\s+at\s+', title, re.I):
                title = re.split(r'\s+at\s+', title, maxsplit=1, flags=re.I)[0].strip()
            # Split on " @ " or "@" with no space (Title@Company)
            elif re.search(r'@', title):
                title = re.split(r'@', title, maxsplit=1)[0].strip()
            # Split on first " | " or " || "
            elif '|' in title:
                title = re.split(r'\|+', title, maxsplit=1)[0].strip()
            # Clean up
            title = re.sub(r'\s+', ' ', title).strip()
            if 2 <= len(title) <= 80:
                return title
    return None


def extract_education(content_lines, company=None):
    """Extract education — look for school/degree keywords. Skip company name."""
    # School name patterns — must contain a recognized school keyword
    school_kw = re.compile(
        r'\b((?:IIT[\s\-\']?K?G?P?|IIT[\s\-\']?KGP|IIIT(?:\s+\w+)?|NIT(?:\s+\w+)?|'
        r'BITS(?:\s+\w+)?|MIT(?!\s*Kumar)|Stanford|Harvard|Berkeley|CMU|Caltech|'
        r'Oxford|Cambridge|'
        r'Indian Institute of Technology[,\s]+[\w\s]+|'
        r'National Institute of Technology[,\s]+[\w]+|'
        r'Birla Institute(?:\s+of\s+[\w]+)*|'
        r'Manipal|VIT|SRM|Amity|Thapar)[A-Za-z0-9\s\(\)\.,\'\-]*)', re.I)

    # Degree patterns (need school context to be valid)
    # Include optional qualifier like "IITK'25 CSE" or "(Data Science)" before the school
    full_phrase = re.compile(
        r'((?:M\.?Tech|B\.?Tech|BE|ME|MSc|PhD|BSc)\s*(?:\([\w\s]+\))?\s*'
        r'(?:in\s+[\w\s]+)?(?:\s*@\s*[\w\s\(\)\']+)?)', re.I)
    short_degree = re.compile(
        r'\b(BTech|MTech|B\.Tech|M\.Tech|BE|ME|MSc|PhD|BSc)\b')

    for line in content_lines:
        m = school_kw.search(line)
        if m:
            # Extend the match to include trailing content like "'25 CSE" or "(CSE'24)"
            end = m.end()
            # Allow more chars of trailing apostrophe+year+text or balanced parens
            tail = line[end:end + 20]
            extra = re.match(
                r"[\'\u2019]\d{2,4}\s*\w*"
                r"|\(\s*[\w\s\.\'\u2019\-]{0,12}\s*\)"
                r"|\s*[\w\.\']{0,6}", tail)
            if extra:
                end = end + extra.end()
            # If the next non-space char is a stray closing paren, include it
            if end < len(line) and line[end:end + 1] == ')':
                end += 1
            if extra:
                end = end + extra.end()
            # Find the FULL phrase containing the school — extend to include leading degree
            start = m.start()
            # Look up to 40 chars before for a degree word
            prefix = line[max(0, start - 40):start]
            deg_match = short_degree.search(prefix)
            if deg_match:
                edu = line[max(0, start - 40) + deg_match.start():end].strip()
            else:
                edu = line[start:end].strip()
            # Cut at " Ex " or " • " tail
            edu = re.sub(r'\s*(Ex|•).*$', '', edu, flags=re.I).strip()
            edu = edu.split('|')[0].strip()
            # Skip if it's actually the company name
            if company and edu.lower().strip() == company.lower().strip():
                continue
            if 2 <= len(edu) <= 100:
                return edu
        m2 = full_phrase.search(line)
        if m2:
            edu = m2.group(1).strip()
            # Append the school if present later
            school_m = school_kw.search(line, m2.end())
            if school_m and school_m.start() - m2.end() < 20:
                edu = line[m2.start():school_m.end()].strip()
            edu = edu.split('|')[0].strip()
            if company and edu.lower().strip() == company.lower().strip():
                continue
            if 3 <= len(edu) <= 100:
                return edu
    return None


def extract_location(content_lines):
    """Location is usually the last short non-pipe non-@ line."""
    # Walk backwards, but skip empty/short content that might be a tag
    for i in range(len(content_lines) - 1, -1, -1):
        l = content_lines[i]
        if is_likely_location(l):
            return l
    return None


def extract_info(info_text):
    """Main extraction function."""
    if not info_text or not info_text.strip():
        return {'company': None, 'education': None, 'job_profile': None, 'location': None}

    content_lines = strip_noise_lines(info_text)
    if not content_lines:
        return {'company': None, 'education': None, 'job_profile': None, 'location': None}

    company = extract_company(content_lines)
    education = extract_education(content_lines, company)
    location = extract_location(content_lines)
    job_profile = extract_job_title(content_lines, company)

    return {
        'company': company,
        'education': education,
        'job_profile': job_profile,
        'location': location,
    }


# ─── Test ───
if __name__ == '__main__':
    import sys
    csv_path = sys.argv[1] if len(sys.argv) > 1 else "smart_list_test6-2026-06-06 (1).csv"
    with open(csv_path) as f:
        rows = list(csv.DictReader(f))

    print(f"{'#':>3} | {'Name':28s} | {'company':25s} | {'education':35s} | {'job_profile':35s} | {'location':20s}")
    print("-" * 160)
    n = {'company_correct': 0, 'edu_correct': 0, 'loc_correct': 0, 'job_correct': 0}
    for i, r in enumerate(rows):
        info = r.get('info', '')
        result = extract_info(info)
        name = f"{r['firstName']} {r['lastName']}"[:28]

        # Compare with what's already in the CSV (ground truth for some rows)
        gt_company = r.get('company', '').strip()
        gt_edu = r.get('education', '').strip()
        gt_loc = r.get('location', '').strip()
        gt_job = r.get('jobProfile', '').strip()

        if gt_company and result['company'] and result['company'].lower() in gt_company.lower():
            n['company_correct'] += 1
        if gt_edu and result['education'] and result['education'].lower() in gt_edu.lower():
            n['edu_correct'] += 1
        if gt_loc and result['location'] and result['location'].lower() in gt_loc.lower():
            n['loc_correct'] += 1
        if gt_job and result['job_profile'] and result['job_profile'].lower() in gt_job.lower():
            n['job_correct'] += 1

        print(f"{i+1:>3} | {name:28s} | {(result['company'] or ''):25s} | {(result['education'] or ''):35s} | {(result['job_profile'] or ''):35s} | {(result['location'] or ''):20s}")

    print()
    print(f"Accuracy vs ground truth (only rows where GT exists):")
    print(f"  Company:  {n['company_correct']}/? (need to count)")
    print(f"  Education: {n['edu_correct']}/?")
    print(f"  Location:  {n['loc_correct']}/?")
    print(f"  Job:       {n['job_correct']}/?")
