// ─── Regex Pre-Extractor ────────────────────────────────────
// Pure regex extraction for LinkedIn card text. No LLM, no
// model load, no GPU required. ~10ms per row, deterministic.

// Words that should never be extracted as company names
const COMPANY_STOPWORDS = new Set([
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
]);

const FIRSTNAME_TOKENS = new Set([
    'Aarushi', 'Abhishek', 'Amit', 'Anmol', 'Arush', 'Aryanil', 'Ashutosh',
    'Ayush', 'Bhoomi', 'Dhananjay', 'Harsh', 'Kartik', 'Kusal', 'Lokesh',
    'Omkar', 'Pramod', 'Sahil', 'Sai', 'Sarthak', 'Shailesh', 'Shiv',
    'Shivanshu', 'Shivprasad', 'Somya', 'Swayam', 'Tanmay', 'Veer', 'Akhand',
    'Sneh', 'Patel', 'Kumar', 'Yadav', 'Kannojia', 'Garg', 'Reddy', 'Singh',
    'Gupta', 'Arora', 'Mandaliya', 'Chaudhari', 'Chaudhary', 'Nanekar',
    'Solanki', 'Kulshrestha', 'Agarwal',
]);

const NOISE_LINE_PATTERNS = [
    /^View\s/,
    /^•\s*\d/,
    /^\d+(st|nd|rd|th)\+?\s*degree/i,
];

const NOISE_LINE_EXACT = new Set([
    '2nd degree connection', '3rd+ degree connection', '1st degree connection',
]);

function stripNoiseLines(text) {
    const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
    return lines.filter(l => {
        if (NOISE_LINE_EXACT.has(l.toLowerCase())) return false;
        for (const p of NOISE_LINE_PATTERNS) {
            if (p.test(l)) return false;
        }
        return true;
    });
}

function isLikelyCompany(s) {
    if (!s || s.length < 2 || s.length > 80) return false;
    s = s.split('|')[0].split('•')[0].trim();
    const tokens = s.split(/\s+/);
    if (tokens.length === 0) return false;
    // Reject if FIRST token is a stopword (e.g. "AI Labs", "Solutions Inc")
    if (COMPANY_STOPWORDS.has(tokens[0])) return false;
    // Reject if FIRST token is a first name
    if (FIRSTNAME_TOKENS.has(tokens[0])) return false;
    // Allow stopwords in MIDDLE/END (e.g. "Goodpick Technologies", "X Solutions")
    // but reject if EVERY token is a stopword.
    if (tokens.length === 1 && COMPANY_STOPWORDS.has(tokens[0])) return false;
    // Must start with uppercase
    if (!(s[0] === s[0].toUpperCase() || s === s.toUpperCase())) return false;
    return true;
}

function isLikelyLocation(s) {
    if (!s || s.length < 2 || s.length > 50) return false;
    if (s.includes('|') || s.includes('@')) return false;
    if (/\b(at|@)\b/.test(s)) return false;
    const tokens = s.split(/\s+/);
    if (tokens.length > 5) return false;
    if (s[0] === s[0].toLowerCase()) return false;
    // "Greater X Area" is ALWAYS a location
    if (/\bGreater\s+[\w\s]+Area$/i.test(s)) return true;
    // "<City> District" / "<City> Rural" patterns
    if (/\b(District|Rural|Urban|Nagar)\b/i.test(s) && tokens.length <= 4) return true;
    // Common city names — accept short lines starting with a known city
    const CITY_KW = /^(Mumbai|New Delhi|Delhi|Bangalore|Bengaluru|Hyderabad|Chennai|Kolkata|Pune|Noida|Gurugram|Gurgaon|Faridabad|Agra|Nashik|Lucknow|Jaipur|Ahmedabad|Indore|Bhopal|Chandigarh|Coimbatore|Kochi|Thiruvananthapuram|Visakhapatnam|Nagpur|Patna|Ranchi|Dehradun|New York|London|San Francisco|Bay Area|Los Angeles|Seattle|Chicago|Toronto|Vancouver|Sydney|Melbourne|Singapore|Dubai|Berlin|Munich|Paris|Amsterdam|Lahore|Canton|Mandya|Valsad|Vapi|Bokaro|Alwar|Ghaziabad|Suryapet|Kanpur Nagar|Bemetara|Jalandhar|Mohali|Ludhiana|Goa|Sonipat|South Delhi|North Delhi|West Delhi|East Delhi|Raebareli|Sahibzada Ajit Singh Nagar|Madurai|Trivandrum|Thrissur|Aligarh|Faridabad|Kanpur)\b/i;
    // "<Region> Division" pattern (e.g. "Pune Division")
    if (/\bDivision$/i.test(s) && tokens.length <= 3) return true;
    if (CITY_KW.test(s)) return true;
    // Reject lines that look like job titles
    const reject = ['Engineer', 'Scientist', 'Developer', 'Manager', 'Director',
        'Building', 'Lead', 'Senior', 'AI', 'ML', 'CTO', 'CEO', 'CFO',
        'Follow', 'Connect', 'Message', 'Send', 'Pending', 'More', 'Dismiss',
        'Promoted', 'Visit', 'mutual', 'followers', 'degree'];
    for (const t of reject) {
        if (new RegExp(`\\b${t}\\b`, 'i').test(s)) return false;
    }
    return true;
}

function extractCompany(contentLines) {
    // 1. "at CompanyName" (with space)
    for (const line of contentLines) {
        const m = line.match(/\bat\s+([A-Z][A-Za-z0-9&'.]+(?:\s+[A-Z][A-Za-z0-9&'.]+){0,5})/);
        if (m) {
            let c = m[1].split('|')[0].split('•')[0].trim();
            c = c.replace(/\s+(LLM|ML|AI|NLP|DL|Gen|Python|Java|Rust|Go|React).*$/i, '').trim();
            if (isLikelyCompany(c)) return c;
        }
        const m2 = line.match(/\bat\s+([A-Z][\w.&'\-]+(?:\s+[A-Z][\w.&'\-]+){0,4})/);
        if (m2) {
            const c = m2[1].split('|')[0].split('•')[0].trim();
            if (isLikelyCompany(c) && c.length > 2) return c;
        }
    }
    // 2. "@ CompanyName" or "@CompanyName"
    for (const line of contentLines) {
        const matches = line.matchAll(/@(\s*)([A-Z][\w.&'\-]*(?:\s+[A-Z][\w.&'\-]*){0,4})/g);
        for (const m of matches) {
            const c = m[2].split('|')[0].split('•')[0].trim();
            if (isLikelyCompany(c) && c.length > 1) return c;
        }
    }
    // 3. Lowercase gerund + " @ Company" (e.g. "building conversational AI @ ixigo")
    for (const line of contentLines) {
        const m = line.match(/^(building|working|leading|designing|developing|creating|shipping|hiring|ex-)\b[\w\s]*?\s*@\s*([A-Z][\w&'.\-]+(?:\s+[A-Z][\w&'.\-]+){0,3})/i);
        if (m) {
            const c = m[2].split('|')[0].split('•')[0].trim();
            if (isLikelyCompany(c) && c.length > 1) return c;
        }
    }
    return null;
}

function extractJobTitle(contentLines, company) {
    // Use \b boundaries to prevent "VP" from matching inside "shivPrasad".
    // Allow "Engineering" / "Architecture" / "Management" via optional suffixes.
    const titleKw = /\b(Engineer(?:ing)?|Developer|Scientist|Architect(?:ure)?|Manager(?:ment)?|Director|Analyst|Consultant|Designer|Lead|Head|Chief|CTO|CEO|CFO|COO|CMO|Founder|Co-?founder|VP|President|Intern|Fresher|Trainee|Associate|Senior|Junior|Principal|Staff|Officer|Specialist|Strategist|Producer|Researcher|Writer|Marketer|Marketing|Strategist|Salesperson|Sales|Recruiter|HR|Human|Resources|Engineer 2|Executive|Coordinator|Accountant|Administrator|Supervisor|Planner)\b/i;
    // Education-only patterns to skip (don't treat as a job title)
    const SCHOOL_KW = /\b(IIT[\s\-']?\w*|IIIT(?:\s+\w+)?|NIT(?:\s+\w+)?|BITS(?:\s+\w+)?|Indian Institute of Technology|National Institute of Technology|Birla Institute|Manipal|VIT|SRM|Amity|Thapar|MIT|Stanford|Harvard)\b/i;
    const EDU_PHRASE = /^\s*(?:undergraduate|graduate|alumni|student|studying|studied|alumnus|fresher|freshers)\b/i;

    for (const line of contentLines) {
        if (titleKw.test(line) && line.length < 200) {
            // Skip lines that are education-ONLY (no "at"/"@"/"@" delimiter AND
            // no job title keyword AND has a school keyword).
            // A line that has a job keyword should always be treated as a job.
            // But "AI Engineering | IIT Kanpur" has BOTH — it's a "Job | School"
            // combo. The outer `if (titleKw.test(line))` guarantees there's a
            // job keyword, so this skip is unreachable inside this block.
            let title = line;
            // IMPORTANT: Strip pipes FIRST, then handle " at " / " @ " within the
            // first segment. Otherwise "X | MBA at Y" would split on " at " first
            // and keep the long "X | MBA" pre-at portion (which exceeds 80 chars).
            if (title.includes('||')) title = title.split('||')[0].trim();
            if (title.includes('|')) title = title.split('|')[0].trim();
            // Some cards use lowercase L ("l") or uppercase I ("I") as separators
            // due to font rendering — treat them like pipes.
            if (/\sl\s+/.test(title) && /\b(marketing|seo|expert|strategist|specialist|growth|brand|content|analyst|engineer|designer|writer|head|manager|consultant|lead|director|associate|freelance|ex-)\b/i.test(title)) {
                title = title.split(/\s+[lI]\s+/)[0].trim();
            }
            if (title.includes('•')) title = title.split('•')[0].trim();
            // Strip " at " within the first segment
            if (/\s+at\s+/i.test(title)) {
                title = title.split(/\s+at\s+/i)[0].trim();
            } else if (title.includes('@')) {
                title = title.split('@')[0].trim();
            }
            title = title.replace(/\s+/g, ' ').trim();
            if (2 <= title.length && title.length <= 100) return title;
        }
    }
    return null;
}

function extractEducation(contentLines, company) {
    const schoolKw = /\b((?:IIT[\s\-']?K?G?P?|IIT[\s\-']?KGP|IIIT(?:\s+\w+)?|NIT(?:\s+\w+)?|BITS(?:\s+\w+)?|MIT(?!\s*Kumar)|Stanford|Harvard|Berkeley|CMU|Caltech|Oxford|Cambridge|Indian Institute of Technology[,\s]+[\w\s]+|National Institute of Technology[,\s]+[\w]+|Birla Institute(?:\s+of\s+[\w]+)*|Manipal|VIT|SRM|Amity|Thapar)[A-Za-z0-9\s\(\)\.,'\-]*)/i;
    const shortDeg = /\b(BTech|MTech|B\.Tech|M\.Tech|BE|ME|MSc|PhD|BSc)\b/;
    const fullPhrase = /((?:M\.?Tech|B\.?Tech|BE|ME|MSc|PhD|BSc)\s*(?:\([\w\s]+\))?\s*(?:in\s+[\w\s]+)?(?:\s*@\s*[\w\s\(\)']+)?)/i;

    // "Undergraduate from X" / "Alumni of X" / "Student at X" / "Graduate from X"
    const eduPhraseKw = /^\s*(?:undergraduate|graduate|alumni|student|studying|studied|alumnus|fresher|freshers)\s+(?:from|of|at)\s+(.+)/i;
    // "X'25" / "X '24" (batch notation, often follows school name)
    const batchYear = /['\u2019]\s*\d{2,4}/;

    for (const line of contentLines) {
        // "Undergraduate from X" / "Alumni of X" pattern — first, very specific
        const epMatch = line.match(eduPhraseKw);
        if (epMatch) {
            let edu = epMatch[1].split('|')[0].trim();
            // Stop at pipe, bullet, or " at " (job after school)
            edu = edu.split('|')[0].split('•')[0].trim();
            if (company && edu.toLowerCase() === company.toLowerCase()) continue;
            if (2 <= edu.length && edu.length <= 100) return edu;
        }
        const m = line.match(schoolKw);
        if (m) {
            let end = m.index + m[0].length;
            const tail = line.slice(end, end + 20);
            const extra = tail.match(/[\'\u2019]\d{2,4}\s*\w*|\(\s*[\w\s\.\'\u2019\-]{0,12}\s*\)|\s*[\w\.\']{0,6}/);
            if (extra) end += extra[0].length;
            if (end < line.length && line[end] === ')') end += 1;
            const start = m.index;
            const prefix = line.slice(Math.max(0, start - 40), start);
            const degMatch = prefix.match(shortDeg);
            let edu;
            if (degMatch) {
                edu = line.slice(Math.max(0, start - 40) + degMatch.index, end).trim();
            } else {
                edu = line.slice(start, end).trim();
            }
            edu = edu.replace(/\s*(Ex|•).*$/i, '').trim();
            edu = edu.split('|')[0].trim();
            if (company && edu.toLowerCase() === company.toLowerCase()) continue;
            if (2 <= edu.length && edu.length <= 100) return edu;
        }
        const m2 = line.match(fullPhrase);
        if (m2) {
            let edu = m2[1].trim();
            const schoolM = line.slice(m2.index + m2[0].length).match(schoolKw);
            if (schoolM && schoolM.index < 20) {
                edu = line.slice(m2.index, m2.index + m2[0].length + schoolM[0].length).trim();
            }
            edu = edu.split('|')[0].trim();
            if (company && edu.toLowerCase() === company.toLowerCase()) continue;
            if (3 <= edu.length && edu.length <= 100) return edu;
        }
    }
    return null;
}

function extractLocation(contentLines) {
    for (let i = contentLines.length - 1; i >= 0; i--) {
        if (isLikelyLocation(contentLines[i])) return contentLines[i];
    }
    return null;
}

function extractInfo(infoText) {
    const result = { company: null, education: null, job_profile: null, location: null };
    if (!infoText || !infoText.trim()) return result;
    const contentLines = stripNoiseLines(infoText);
    if (!contentLines.length) return result;
    result.company = extractCompany(contentLines);
    result.education = extractEducation(contentLines, result.company);
    result.location = extractLocation(contentLines);
    result.job_profile = extractJobTitle(contentLines, result.company);
    return result;
}

window.LLM = { extractInfo };
