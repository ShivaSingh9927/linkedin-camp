// content.js — LinkedIn content script (isolated world)
// Receives leads from inject.js (MAIN world) via postMessage
// Handles DOM scanning + popup communication + auto-pagination
console.log('AutoConnect: content.js loaded on', window.location.href);

// --- Lead Storage (Map for dedup by URL) ---
const collectedLeads = new Map();

// --- Receive data from inject.js (MAIN world) ---
window.addEventListener('message', (event) => {
    if (event.source !== window || !event.data || event.data.type !== 'AUTOCONNECT_VOYAGER_DATA') return;
    const incoming = event.data.leads || [];
    let added = 0;
    incoming.forEach(lead => {
        if (lead.linkedinUrl && !collectedLeads.has(lead.linkedinUrl)) {
            collectedLeads.set(lead.linkedinUrl, lead);
            added++;
        }
    });
    if (added > 0) {
        console.log('AutoConnect: Received', added, 'from inject.js (total:', collectedLeads.size + ')');
    }
});

// --- DOM Scraping ---
// LinkedIn's new UI uses data-view-name="people-search-result" for each card.
// Named profiles have <a href="/in/..."> inside; LinkedIn Members don't.

// Simple gender detection from first name
const FEMALE_NAMES = new Set(['aarti', 'aisha', 'akshita', 'amrita', 'anamika', 'ananya', 'ankita', 'anushka', 'aparna', 'archana', 'asha', 'bhavna', 'chitra', 'deepa', 'deepika', 'disha', 'divya', 'ekta', 'gargi', 'gayatri', 'harini', 'isha', 'ishani', 'ishita', 'jaya', 'jyoti', 'kajal', 'kavita', 'kavya', 'kiran', 'kriti', 'kritika', 'lakshmi', 'lata', 'madhuri', 'manisha', 'meena', 'megha', 'monika', 'namita', 'nandini', 'neha', 'nidhi', 'nimisha', 'nisha', 'nishta', 'pallavi', 'pooja', 'prachi', 'pragya', 'prarthana', 'pratibha', 'preeti', 'priya', 'priyanka', 'raafia', 'rachna', 'radha', 'rajni', 'rekha', 'renuka', 'rina', 'ritu', 'riya', 'rohini', 'rupal', 'sadhana', 'sakshi', 'sangeeta', 'sanjana', 'sapna', 'sarika', 'seema', 'shikha', 'shivani', 'shreya', 'simran', 'sneha', 'sonali', 'sonam', 'sonia', 'sridevi', 'srishti', 'sudha', 'suman', 'sunita', 'swati', 'tanvi', 'tara', 'tina', 'trisha', 'uma', 'usha', 'varsha', 'vidya', 'vineeta', 'vrinda', 'yamini', 'yashika', 'khushbu', 'khushi']);
const MALE_NAMES = new Set(['aarav', 'abhay', 'abhishek', 'aditya', 'ajay', 'ajit', 'akash', 'akshay', 'amit', 'amrit', 'anil', 'ankit', 'ankur', 'anuj', 'arun', 'aryan', 'ashish', 'ashok', 'atul', 'bharat', 'bhushan', 'chandan', 'chirag', 'deepak', 'devesh', 'dhruv', 'dinesh', 'dipak', 'ekansh', 'gaurav', 'girish', 'gopal', 'govind', 'hari', 'harish', 'hemant', 'himanshu', 'hitesh', 'jagdish', 'jai', 'jayesh', 'jitendra', 'kamal', 'kapil', 'karan', 'kartik', 'keshav', 'kishore', 'krishna', 'kunal', 'lalit', 'lokesh', 'mahesh', 'manoj', 'mayank', 'mohit', 'mukesh', 'naman', 'naresh', 'naveen', 'nikhil', 'nilesh', 'nitin', 'pankaj', 'parag', 'parth', 'piyush', 'pradeep', 'prakash', 'pranav', 'prashant', 'pratik', 'praveen', 'prem', 'rahul', 'raj', 'rajat', 'rajesh', 'rajiv', 'rakesh', 'ram', 'raman', 'ramesh', 'ranjit', 'ravi', 'rishabh', 'rohit', 'sachin', 'sahil', 'sajjan', 'sameer', 'sandeep', 'sanjay', 'saurabh', 'shantanu', 'shashank', 'shiv', 'shivam', 'shreyas', 'siddharth', 'sudeep', 'sumeet', 'sumit', 'sunil', 'suraj', 'suresh', 'sushil', 'tarun', 'tushar', 'utkarsh', 'varun', 'vijay', 'vikash', 'vikram', 'vinay', 'vinod', 'vipin', 'virender', 'vishal', 'vivek', 'yogesh']);

function detectGender(firstName) {
    const name = (firstName || '').toLowerCase().trim();
    if (FEMALE_NAMES.has(name)) return 'female';
    if (MALE_NAMES.has(name)) return 'male';
    return '';
}

// ---- Shared line-parser for LinkedIn card subtitle lines ----
//
// LinkedIn 2026 cards typically render the subtitle as ONE line that combines
// everything: "AI Engineer at Meril | MTech (Data Science) IIIT Lucknow |
// Python | Computer Vision" followed by a location line. The previous
// per-strategy code only handled the legacy "Current: X at Y" prefix and
// dumped the whole line into jobTitle, leaving company blank.
//
// This parser walks a list of "content lines" (already stripped of name /
// degree / button noise) and returns { jobTitle, company, location } using:
//   1. "Current: X at Y" prefix
//   2. "X at Y" / "X @ Y" split within a single line
//   3. Pipe-segmented lines ("X at Y | Edu | Skills | City")
//   4. Pure-title lines (just "AI Engineer" with no company) → jobTitle only
//   5. Location detection (last short line, "Greater X Area", "X District",
//      explicit country suffix, or known city dictionary)
const LOC_PREFIX_CITIES = /^(Mumbai|New Delhi|Delhi|Bangalore|Bengaluru|Hyderabad|Chennai|Kolkata|Pune|Noida|Gurugram|Gurgaon|Faridabad|Agra|Nashik|Lucknow|Jaipur|Ahmedabad|Indore|Bhopal|Chandigarh|Coimbatore|Kochi|Thiruvananthapuram|Visakhapatnam|Nagpur|Patna|Ranchi|Dehradun|New York|London|San Francisco|Bay Area|Los Angeles|Seattle|Chicago|Toronto|Vancouver|Sydney|Melbourne|Singapore|Dubai|Berlin|Munich|Paris|Amsterdam|Lahore|Canton|Mandya|Pune District|Thane District|Bengaluru Rural|Bemetara|Valsad|Vapi|Bokaro|Alwar|Ghaziabad|Suryapet|Kanpur Nagar|Greater Delhi Area|Greater Mumbai Area|Greater Bangalore Area|Greater Chennai Area|Greater Hyderabad Area|Greater Kolkata Area|Greater Pune Area)\b/i;
const LOC_COUNTRY_SUFFIX = /,\s*(India|United States|UK|USA|Canada|Australia|Germany|France|Singapore|Dubai|Netherlands|Pakistan|China|Japan|Brazil|Mexico|Spain|Italy|Indonesia|Philippines|Malaysia|Bangladesh|Nepal|Sri Lanka|Thailand|Vietnam|South Korea|Russia|Turkey|Saudi Arabia|UAE|Ireland|Sweden|Norway|Denmark|Finland|Switzerland|Belgium|Austria|Czech Republic|Poland|Romania|Ukraine|Argentina|Chile|Colombia|Peru|Egypt|Nigeria|Kenya|South Africa|Ghana|Ethiopia|Tanzania)\s*$/i;

function isLikelyLocationLine(line) {
    if (!line) return false;
    if (line.length < 2 || line.length > 80) return false;
    if (line.includes('|') || line.includes('@')) return false;
    if (/\bat\s+/.test(line)) return false;
    if (LOC_PREFIX_CITIES.test(line)) return true;
    if (LOC_COUNTRY_SUFFIX.test(line)) return true;
    return false;
}

// Split a subtitle line on the FIRST " at " or " @ " that looks like a
// company delimiter (i.e. the right side is short, title-cased, and not a
// skill/education fragment). Returns { title, company }.
function splitTitleAndCompany(line) {
    if (!line) return { title: '', company: '' };
    // First, take only the part before the first pipe — pipes usually separate
    // title+company from education/skills/location.
    if (line.includes('|')) line = line.split('|')[0].trim();
    // Also strip " || " separators (some cards use double pipes)
    if (line.includes('||')) line = line.split('||')[0].trim();
    // Also strip bullet " • " (some cards use bullets)
    if (line.includes('•')) line = line.split('•')[0].trim();
    if (!line) return { title: '', company: '' };

    // Try " at " first (more specific)
    const atMatch = line.match(/\s+at\s+(.+)/);
    if (atMatch) {
        let company = atMatch[1].split('|')[0].split('•')[0].trim();
        company = company.replace(/\s*\|\s*(LLM|ML|AI|NLP|DL|Gen|Python|Java|Building|Lead|Senior|Junior|Engineer).*$/i, '').trim();
        if (company.length > 1) {
            const title = line.substring(0, atMatch.index).trim();
            return { title, company };
        }
    }
    // Try " @ " or "@" (no space)
    const atMatch2 = line.match(/^(.+?)\s*@\s*([A-Z][\w&'.\-]+(?:\s+[A-Z][\w&'.\-]+){0,3})/);
    if (atMatch2) {
        const company = atMatch2[2].split('|')[0].split('•')[0].trim();
        if (company.length > 1) {
            return { title: atMatch2[1].trim(), company };
        }
    }
    // Special case: lowercase gerund + " @ Company" — the gerund isn't a real
    // title, the company is. e.g. "building conversational AI @ ixigo"
    const gerundRe = /^(building|working|leading|designing|developing|creating|shipping|hiring|ex-|former)[\w\s]*?\s*@\s*([A-Z][\w&'.\-]+)/i;
    const gerundMatch = line.match(gerundRe);
    if (gerundMatch) {
        return { title: '', company: gerundMatch[2].trim() };
    }
    return { title: line.trim(), company: '' };
}

// Walk a card's content lines and return { jobTitle, company, location }.
// Used by all 3 strategies.
function parseCardContentLines(lines, ownName) {
    let jobTitle = '';
    let company = '';
    let location = '';

    // Education-only-line detection: a line containing only school keywords
    // (no " at ", no " @ ", no "@") is treated as education, not a job title.
    const SCHOOL_KW = /\b(IIT[\s\-']?\w*|IIIT(?:\s+\w+)?|NIT(?:\s+\w+)?|BITS(?:\s+\w+)?|Indian Institute of Technology|National Institute of Technology|Birla Institute|Manipal|VIT|SRM|Amity|Thapar|MIT|Stanford|Harvard)\b/i;
    const EDUCATION_PHRASE = /^\s*(?:undergraduate|graduate|alumni|student|studying|studied|alumnus|fresher|freshers)\b/i;

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (!line || line === ownName) continue;
        if (line.length < 2) continue;
        if (/^\d+(st|nd|rd|th)\+?\s*degree\s*connection$/i.test(line)) continue;

        // 1. "Current: Role at Company"
        if (/^Current:/i.test(line)) {
            const after = line.replace(/^Current:\s*/i, '').trim();
            if (after.includes(' at ')) {
                const parts = after.split(' at ');
                if (!jobTitle) jobTitle = parts[0].trim();
                company = parts.slice(1).join(' at ').split('|')[0].trim();
            } else if (after.includes(' @ ')) {
                const parts = after.split(' @ ');
                if (!jobTitle) jobTitle = parts[0].trim();
                company = parts.slice(1).join(' @ ').split('|')[0].trim();
            } else if (!jobTitle) {
                jobTitle = after;
            }
            continue;
        }

        // 2. Skip metadata labels
        if (/^(Past|Education|Skills|Certifications|Summary):/i.test(line)) continue;
        if (line.endsWith('followers') || /^Visit my/i.test(line)) continue;
        if (/mutual connection/i.test(line)) continue;

        // 3. Location (must check before jobTitle fallback)
        if (!location && isLikelyLocationLine(line)) {
            location = line;
            continue;
        }

        // 4. Skip education-only lines (don't set as jobTitle)
        const isEducationLine = (
            !line.includes(' at ') && !line.includes(' @ ') && !line.includes('@') &&
            (SCHOOL_KW.test(line) || EDUCATION_PHRASE.test(line))
        );
        if (isEducationLine) continue;

        // 5. Job title line — try to split "X at Y" / "X @ Y" / pipe-segments
        if (!jobTitle && line.length > 2 &&
            !/^(Connect|Follow|Message|Send|Pending|More|Dismiss|Promoted)$/i.test(line) &&
            !/^\d+(st|nd|rd|th)\+?$/i.test(line)) {
            const split = splitTitleAndCompany(line);
            if (split.title && split.title.length >= 2) {
                jobTitle = split.title;
                if (split.company && !company) company = split.company;
            } else if (split.company && !company) {
                company = split.company;
            }
        }
    }

    return { jobTitle, company, location };
}

// ---- Degree-anchored card discovery (LinkedIn 2026 layout) ----
//
// LinkedIn's current search-results page uses obfuscated dynamic CSS class
// names + drops the `data-view-name="people-search-result"` attribute that
// older versions exposed. The only stable signals left are:
//   - profile-link anchors with `/in/<slug>/` href
//   - the visible degree-badge text ("1st" / "2nd" / "3rd+")
//   - aria-label filter pills (which must be EXCLUDED — they also contain
//     the degree token but aren't per-card markers)
//
// Walking up from a profile anchor fails because the degree-badge often sits
// in a SIBLING subtree, and the walk hits a multi-card ancestor before
// reaching the badge. Inverting works: find every degree-text node, walk up
// to the smallest single-slug ancestor — that ancestor IS the card.
//
// This function returns an array of { slug, url, name, degree, cardEl }.
// cardEl is the DOM element so the caller can extract the remaining card
// metadata (jobTitle, company, location) using the existing line-parser.
// Detect the logged-in LinkedIn user's own profile slug so we can exclude
// it from extracted results. LinkedIn puts a "Me" / "View profile" link in
// the top nav pointing at the user's own /in/<slug>. We grab that slug
// once per scan.
function getOwnProfileSlug() {
    // The "Me" nav anchor is inside the global header. It carries either:
    //   - aria-label="<your name>" with a child a[href*="/in/"]
    //   - a child img with the user's photo + an /in/<slug> href
    // Pattern works across LinkedIn nav layouts.
    const navAnchors = document.querySelectorAll('header a[href*="/in/"], nav a[href*="/in/"], [role="banner"] a[href*="/in/"]');
    for (const a of navAnchors) {
        const m = (a.getAttribute('href') || '').match(/\/in\/([^/?#]+)/);
        if (m) return m[1];
    }
    return null;
}

function findSearchResultCards() {
    const FILTER_PILL_TEXTS = ['Filter by 1st connections', 'Filter by 2nd connections', 'Filter by 3rd+ connections'];
    const ownSlug = getOwnProfileSlug();

    const isFilterPill = (el) => {
        for (let n = el; n && n !== document.body; n = n.parentElement) {
            const al = (n.getAttribute && n.getAttribute('aria-label')) || '';
            if (/Filter by .* connections/.test(al)) return true;
            if (n.tagName === 'LABEL') return true;
        }
        return false;
    };

    const uniqueSlugsUnder = (el) => {
        const set = new Set();
        for (const a of el.querySelectorAll('a[href*="/in/"]')) {
            const m = (a.getAttribute('href') || '').match(/\/in\/([^/?#]+)/);
            if (m) set.add(m[1]);
        }
        return set;
    };

    const degreeRe = /(?:^|\s|•\s*)(1st|2nd|3rd\+?)(?:\s|$|\b)/;
    const xpath = document.evaluate(
        '//text()[contains(., "1st") or contains(., "2nd") or contains(., "3rd")]',
        document, null, XPathResult.ORDERED_NODE_SNAPSHOT_TYPE, null
    );

    const seenSlugs = new Set();
    const cards = [];

    for (let i = 0; i < xpath.snapshotLength; i++) {
        const textNode = xpath.snapshotItem(i);
        const m = (textNode.textContent || '').match(degreeRe);
        if (!m) continue;
        const degreeRaw = m[1];

        let el = textNode.parentElement;
        if (!el || isFilterPill(el)) continue;

        let cardEl = null;
        let slug = null;
        for (let depth = 0; depth < 20 && el && el !== document.body; depth++, el = el.parentElement) {
            if (el.closest('nav, header, [role="banner"]')) { el = null; break; }
            const slugs = uniqueSlugsUnder(el);
            if (slugs.size === 1) {
                cardEl = el;
                slug = [...slugs][0];
            } else if (slugs.size > 1) {
                break;
            }
        }
        if (!cardEl || !slug) continue;
        if (seenSlugs.has(slug)) continue;
        // Skip the logged-in user's own profile if it leaked through (e.g.
        // a sponsored "Promoted for you" card or a "People you may know"
        // entry that happens to be themselves).
        if (ownSlug && slug === ownSlug) continue;
        seenSlugs.add(slug);

        let degreeParsed = null;
        if (degreeRaw === '1st') degreeParsed = 1;
        else if (degreeRaw === '2nd') degreeParsed = 2;
        else if (degreeRaw.startsWith('3rd')) degreeParsed = 3;

        // There are usually 2-3 anchors per card pointing at /in/<slug>:
        //   1. The avatar/image link — text is empty OR "Status is offline" /
        //      "Open profile photo of X" / "View X's profile"
        //   2. The visible name link — text is the clean name (sometimes
        //      duplicated as a screen-reader span)
        //   3. A "View X's profile" CTA link near the bottom of the card
        // We want the visible-name anchor. Pick the one whose textContent,
        // after stripping known noise, has the longest meaningful name.
        const allAnchors = Array.from(cardEl.querySelectorAll('a[href*="/in/"]'))
            .filter(a => {
                const h = a.getAttribute('href') || '';
                return h.match(/\/in\/([^/?#]+)/)?.[1] === slug;
            });
        const noiseRe = /^(Status is (?:offline|online|away)|Open profile photo of [^]+|View [^]+'s profile)$/i;

        let anchor = null;
        let name = '';
        for (const a of allAnchors) {
            // Prefer a visible-name span (aria-hidden="true") inside this anchor.
            const visibleSpan = a.querySelector('span[aria-hidden="true"]');
            const candidate = (visibleSpan ? visibleSpan.textContent : a.textContent || '')
                .trim().replace(/\s+/g, ' ');
            if (!candidate || candidate.length < 2) continue;
            // Strip on first '•' (drops the degree half).
            let cleaned = candidate;
            const bulletIdx = cleaned.indexOf('•');
            if (bulletIdx > 0) cleaned = cleaned.substring(0, bulletIdx).trim();
            // Strip trailing "View X's profile" / "Status is offline" if it
            // got concatenated.
            cleaned = cleaned.replace(/\s*View [^]+?(?:'s|s) profile\s*$/i, '').trim();
            cleaned = cleaned.replace(/\s*Status is (?:offline|online|away)\s*/gi, ' ').replace(/\s+/g, ' ').trim();
            if (!cleaned || cleaned.length < 2 || noiseRe.test(cleaned)) continue;
            // De-double "Name Name" palindrome.
            const parts = cleaned.split(' ');
            if (parts.length >= 2 && parts.length % 2 === 0) {
                const first  = parts.slice(0, parts.length / 2).join(' ');
                const second = parts.slice(parts.length / 2).join(' ');
                if (first === second) cleaned = first;
            }
            // Pick the longest qualifying candidate — visible-name anchors
            // tend to be richer than avatar links.
            if (cleaned.length > name.length) {
                name = cleaned;
                anchor = a;
            }
        }
        if (!anchor && allAnchors.length > 0) anchor = allAnchors[0];

        const href = anchor ? (anchor.getAttribute('href') || '') : '';
        const url = href.startsWith('http') ? href.split('?')[0] : `https://www.linkedin.com${href.split('?')[0]}`;

        cards.push({ slug, url, name, degree: degreeParsed, cardEl });
    }
    return cards;
}

function scanDOM() {
    let added = 0;
    const currentPage = getCurrentPageNumber();

    // ============================================================
    // PRIMARY STRATEGY (2026 layout): degree-anchored card discovery.
    // Returns { slug, url, name, degree, cardEl } per card.
    // ============================================================
    const primaryCards = findSearchResultCards();
    if (primaryCards.length > 0) {
        console.log(`[AutoConnect] Primary strategy: ${primaryCards.length} cards`);
        for (const c of primaryCards) {
            if (!c.url || collectedLeads.has(c.url)) continue;

            const nameParts = (c.name || '').split(' ');
            const firstName = nameParts[0] || '';
            const lastName = nameParts.slice(1).join(' ') || '';

            // Re-use the line-parser pattern from the legacy fallback to
            // extract jobTitle / company / location from the card text.
            const lines = (c.cardEl.innerText || '').split('\n')
                .map(l => l.trim())
                .filter(l => l.length > 0)
                // Strip button/badge noise
                .filter(l => !/^(Connect|Follow|Message|Send|Pending|More|Dismiss)$/i.test(l))
                .filter(l => !/^\d+(st|nd|rd|th)\+?$/i.test(l))
                .filter(l => !/^•\s*(1st|2nd|3rd\+?)/i.test(l))
                .filter(l => !/^Status is (offline|online|away)$/i.test(l))
                .filter(l => !/^(Open profile photo|View [^]+?(?:'s|s) profile)/i.test(l))
                .filter(l => !/^Promoted$/i.test(l));

            const parsed = parseCardContentLines(lines, c.name);
            let jobTitle = parsed.jobTitle;
            let company = parsed.company;
            let location = parsed.location;

            let country = '';
            if (location) {
                const lp = location.split(',').map(x => x.trim());
                if (lp.length) country = lp[lp.length - 1];
            }
            const gender = detectGender(firstName);

            // Full raw card text — exactly what LinkedIn displayed. Useful
            // when the structured parse misses something or the user wants
            // to verify "is this who I thought?". Capped to 1000 chars so
            // a sponsored card with a giant description doesn't bloat the
            // payload.
            const info = (c.cardEl.innerText || '').replace(/\s+\n/g, '\n').trim().substring(0, 1000);

            collectedLeads.set(c.url, {
                firstName, lastName, jobTitle,
                company, location, country, gender,
                linkedinUrl: c.url,
                connectionDegree: c.degree,
                info,
            });
            added++;
        }
    }

    // ============================================================
    // LEGACY PRIMARY (kept as fallback): data-view-name="people-search-result"
    // Runs unconditionally so LinkedIn Member rows (no /in/ URL) still get
    // captured — they're invisible to the degree-anchored primary because
    // it requires a profile-link anchor.
    // ============================================================
    const searchResultCards = document.querySelectorAll('[data-view-name="people-search-result"]');
    let memberIdx = 0;

    searchResultCards.forEach((card, cardIndex) => {
        try {
            // Find the profile link (named profiles have <a href="/in/...">)
            const titleLink = card.querySelector('[data-view-name="search-result-lockup-title"]');
            const profileLink = card.querySelector('a[href*="/in/"]');

            let linkedinUrl = '';
            let rawName = '';

            if (profileLink && profileLink.href.includes('/in/')) {
                // Named profile — extract URL and name
                linkedinUrl = profileLink.href.split('?')[0].replace(/\/$/, '');
                if (collectedLeads.has(linkedinUrl)) return;

                // Best name source: the search-result-lockup-title element
                if (titleLink) {
                    rawName = titleLink.textContent.trim();
                } else {
                    // Fallback: use the first text in the profile link
                    const nameEl = profileLink.querySelector('p');
                    rawName = nameEl ? nameEl.textContent.trim() : '';
                }
            } else {
                // LinkedIn Member — no /in/ link
                const cardText = card.innerText || '';
                if (!cardText.includes('LinkedIn Member')) return;

                // Generate a stable key for dedup, but keep the URL empty
                const stableId = `linkedin-member-p${currentPage}-m${memberIdx}`;
                memberIdx++;
                if (collectedLeads.has(stableId)) return;
                linkedinUrl = stableId; // Internal key only, NOT a real URL
                rawName = 'LinkedIn Member';
            }

            // Clean the name (remove degree indicators, bullets, extra whitespace)
            rawName = rawName
                .replace(/View.*?profile/ig, '')
                .replace(/(1st|2nd|3rd\+?)/g, '')
                .replace(/[•·]/g, '')
                .replace(/\s+/g, ' ')
                .trim();

            if (!rawName || rawName.length < 2) return;

            // Parse first/last name
            let firstName, lastName;
            if (rawName === 'LinkedIn Member') {
                firstName = 'LinkedIn';
                lastName = 'Member';
            } else {
                const nameWords = rawName.split(' ');
                firstName = nameWords[0] || '';
                lastName = nameWords.slice(1).join(' ') || '';
            }

            // ---- Extract structured data from card DOM ----
            // LinkedIn's card structure has specific divs for different data:
            //   1. Name (in <p> with class containing _31e492f1)
            //   2. Headline/Job Title (first <div> after name containing a <p>)
            //   3. Location (second <div> after name, has class _3f5ca314)
            //   4. "Current:", "Skills:", etc. lines (in <div class="ea4a229b"> sections)

            // Get text from card for line-by-line analysis
            const allText = card.innerText || '';
            const lines = allText.split('\n')
                .map(l => l.trim())
                .filter(l => l.length > 0);

            const parsed = parseCardContentLines(lines, rawName);
            let jobTitle = parsed.jobTitle;
            let company = parsed.company;
            let location = parsed.location;

            // Extract country from location
            let country = '';
            if (location) {
                const locParts = location.split(',').map(p => p.trim());
                if (locParts.length > 0) {
                    country = locParts[locParts.length - 1];
                }
            }

            // Detect gender from first name
            const gender = rawName === 'LinkedIn Member' ? '' : detectGender(firstName);

            // For LinkedIn Members, use the internal key for dedup but store empty URL
            const isLinkedInMember = rawName === 'LinkedIn Member';
            const storeUrl = isLinkedInMember ? '' : linkedinUrl;

            // Connection degree from the card text. LinkedIn renders the
            // badge as "• 1st" / "• 2nd" / "• 3rd+" near the name. We pull
            // it from the full card innerText so both old and new layouts
            // work. LinkedIn Members can't be DM'd anyway → null.
            let connectionDegree = null;
            if (!isLinkedInMember) {
                const cardTxt = card.innerText || '';
                const dm = cardTxt.match(/•\s*(1st|2nd|3rd\+?)\b/);
                if (dm) {
                    if (dm[1] === '1st') connectionDegree = 1;
                    else if (dm[1] === '2nd') connectionDegree = 2;
                    else connectionDegree = 3;
                }
            }

            const info = (card.innerText || '').replace(/\s+\n/g, '\n').trim().substring(0, 1000);

            collectedLeads.set(linkedinUrl, {
                firstName, lastName, jobTitle,
                company: company,
                location: location,
                country: country,
                gender: gender,
                linkedinUrl: storeUrl,
                connectionDegree,
                info,
            });
            added++;
        } catch (e) {
            console.warn('AutoConnect: Error parsing card', e);
        }
    });

    // ============================================================
    // FALLBACK STRATEGY: Legacy selectors (for older LinkedIn UI)
    // ============================================================
    document.querySelectorAll('a[href*="/in/"]').forEach(a => {
        try {
            const href = a.href;
            if (!href || href.includes('/in/ACoA')) return;
            const linkedinUrl = href.split('?')[0].replace(/\/$/, '');
            if (collectedLeads.has(linkedinUrl)) return;

            const nameSpan = a.querySelector('span[aria-hidden="true"]');
            const rawText = (nameSpan ? nameSpan.textContent : a.textContent || '').trim();

            if (!rawText || rawText.length < 2 || rawText.length > 100) return;
            if (rawText.includes('View') && rawText.includes('profile')) return;
            if (rawText.includes('Search') || rawText.includes('Home') || rawText.includes('Messaging')) return;
            if (rawText.includes('followers')) return;

            const parts = rawText.split(/[•·]/).map(p => p.trim());
            let rawName = parts[0]
                .replace(/(1st|2nd|3rd\+?)/g, '')
                .replace(/\s+/g, ' ')
                .trim();
            if (!rawName || rawName.length < 2) return;

            let card = a;
            for (let i = 0; i < 10; i++) {
                if (!card.parentElement) break;
                card = card.parentElement;
                if (card.tagName === 'LI' && card.offsetWidth > 400) break;
                if (card.getAttribute('data-view-name') === 'people-search-result') break;
                if (card.offsetWidth > 600) break;
            }

            const cardText = card.innerText || '';
            const lines = cardText.split('\n').map(l => l.trim()).filter(l => l.length > 0);

            const parsed = parseCardContentLines(lines, rawName);
            let jobTitle = parsed.jobTitle;
            let company = parsed.company;
            let location = parsed.location;

            let firstName, lastName;
            const nameWords = rawName.split(' ');
            firstName = nameWords[0] || '';
            lastName = nameWords.slice(1).join(' ') || '';

            let country = '';
            if (location) {
                const locParts = location.split(',').map(p => p.trim());
                country = locParts[locParts.length - 1];
            }

            const gender = detectGender(firstName);

            // Connection degree from the card text. Same heuristic as the
            // primary path — match "• 1st" / "• 2nd" / "• 3rd+" inside the
            // card's innerText.
            let connectionDegree = null;
            const fbCardTxt = card.innerText || '';
            const fbDm = fbCardTxt.match(/•\s*(1st|2nd|3rd\+?)\b/);
            if (fbDm) {
                if (fbDm[1] === '1st') connectionDegree = 1;
                else if (fbDm[1] === '2nd') connectionDegree = 2;
                else connectionDegree = 3;
            }

            const info = (card.innerText || '').replace(/\s+\n/g, '\n').trim().substring(0, 1000);

            collectedLeads.set(linkedinUrl, {
                firstName, lastName, jobTitle,
                company: company,
                location: location,
                country: country,
                gender: gender,
                linkedinUrl,
                connectionDegree,
                info,
            });
            added++;
        } catch (e) { /* skip individual errors */ }
    });

    if (added > 0) {
        console.log('AutoConnect: DOM scan +' + added + ' (total: ' + collectedLeads.size + ')');
    }
}

// --- Auto-pagination helpers ---
// LinkedIn's new UI uses data-testid attributes for pagination buttons
function getNextPageButton() {
    // New LinkedIn UI
    const btn = document.querySelector('[data-testid="pagination-controls-next-button-visible"]') ||
        // Fallback: old LinkedIn UI
        document.querySelector('button[aria-label="Next"]') ||
        document.querySelector('.artdeco-pagination__button--next') ||
        document.querySelector('[aria-label="Next"]');
    if (btn && !btn.disabled) return btn;
    return null;
}

function getCurrentPageNumber() {
    // Try to extract from URL first (most reliable)
    const urlParams = new URLSearchParams(window.location.search);
    const pageParam = urlParams.get('page');
    if (pageParam) return parseInt(pageParam) || 1;

    // Fallback: check pagination UI
    const active = document.querySelector('.artdeco-pagination__indicator--number.active button') ||
        document.querySelector('[aria-current="true"]');
    return active ? parseInt(active.textContent.trim()) : 1;
}

async function scrollToLoadAll() {
    // Scroll incrementally to trigger lazy loading of all results
    const totalHeight = document.body.scrollHeight;
    const steps = 5;
    for (let i = 0; i <= steps; i++) {
        window.scrollTo(0, (totalHeight / steps) * i);
        await new Promise(r => setTimeout(r, 600));
    }
    // Scroll back to top
    window.scrollTo(0, 0);
    await new Promise(r => setTimeout(r, 500));
}

async function goToNextPage() {
    const btn = getNextPageButton();
    if (!btn) return false;

    btn.scrollIntoView({ behavior: 'smooth', block: 'center' });
    await new Promise(r => setTimeout(r, 500));
    btn.click();

    // Wait for navigation and new content to load
    await new Promise(r => setTimeout(r, 4000));

    // Scroll through the page to trigger lazy loading
    await scrollToLoadAll();

    // Wait for any API responses to arrive
    await new Promise(r => setTimeout(r, 2000));

    return true;
}

// --- Periodic scanning ---
let initialScanDone = false;

function startScanning() {
    // Initial full-page scroll to trigger lazy loading
    scrollToLoadAll().then(() => {
        scanDOM();
        initialScanDone = true;
        console.log('AutoConnect: Initial scan complete. Found', collectedLeads.size, 'leads');
    });

    // Re-scan periodically
    setInterval(scanDOM, 3000);

    // Also scan on DOM mutations
    if (document.body) {
        let scanTimer = null;
        const obs = new MutationObserver(() => {
            if (scanTimer) clearTimeout(scanTimer);
            scanTimer = setTimeout(scanDOM, 800);
        });
        obs.observe(document.body, { childList: true, subtree: true });
    }
}

// Wait for body to exist (we load at document_start)
if (document.body) {
    setTimeout(startScanning, 2000);
} else {
    const bodyObs = new MutationObserver((_, observer) => {
        if (document.body) {
            observer.disconnect();
            setTimeout(startScanning, 2000);
        }
    });
    bodyObs.observe(document.documentElement, { childList: true });
}

// --- Build next page URL ---
function getNextPageUrl() {
    const url = new URL(window.location.href);
    const currentPage = parseInt(url.searchParams.get('page')) || 1;
    url.searchParams.set('page', (currentPage + 1).toString());
    return url.toString();
}

// --- Message Listener for Popup / Side Panel ---
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'POPUP_SCRAPE_REQUEST') {
        // DO NOT scroll here — startScanning() already handles scrolling.
        // Concurrent scrolls cause LinkedIn to re-render and lose all data.
        (async () => {
            try {
                // Wait for the initial scan to complete (max 12s)
                let waited = 0;
                while (!initialScanDone && waited < 12000) {
                    await new Promise(r => setTimeout(r, 500));
                    waited += 500;
                }

                // Do a few extra scans to catch anything new
                scanDOM();
                await new Promise(r => setTimeout(r, 500));
                scanDOM();

                // If still 0 leads and initialScan never ran, try scrolling as last resort
                if (collectedLeads.size === 0 && !initialScanDone) {
                    console.log('AutoConnect: Initial scan never ran, scrolling manually...');
                    await scrollToLoadAll();
                    scanDOM();
                    await new Promise(r => setTimeout(r, 1000));
                    scanDOM();
                }

                const leads = Array.from(collectedLeads.values());
                const hasNext = !!getNextPageButton();
                const currentPage = getCurrentPageNumber();
                const nextPageUrl = hasNext ? getNextPageUrl() : null;

                console.log('AutoConnect: Sending', leads.length, 'leads | page:', currentPage, '| hasNext:', hasNext);
                sendResponse({
                    success: true,
                    leads: leads,
                    hasNextPage: hasNext,
                    currentPage: currentPage,
                    nextPageUrl: nextPageUrl
                });
            } catch (e) {
                console.error('AutoConnect: Scrape error:', e);
                sendResponse({ success: false, error: e.message });
            }
        })();
        return true; // async
    }

    if (message.type === 'POPUP_NEXT_PAGE') {
        (async () => {
            try {
                const success = await goToNextPage();
                if (success) {
                    // Scroll and scan
                    await scrollToLoadAll();
                    scanDOM();
                    await new Promise(r => setTimeout(r, 1500));
                    scanDOM();
                    await new Promise(r => setTimeout(r, 1500));
                    scanDOM();

                    const leads = Array.from(collectedLeads.values());
                    const hasNext = !!getNextPageButton();
                    const currentPage = getCurrentPageNumber();
                    const nextPageUrl = hasNext ? getNextPageUrl() : null;

                    sendResponse({
                        success: true,
                        leads: leads,
                        hasNextPage: hasNext,
                        currentPage: currentPage,
                        nextPageUrl: nextPageUrl
                    });
                } else {
                    sendResponse({ success: false, error: 'No next page available' });
                }
            } catch (e) {
                console.error('AutoConnect: Next page error:', e);
                sendResponse({ success: false, error: e.message });
            }
        })();
        return true;
    }

    if (message.type === 'POPUP_GET_COUNT') {
        sendResponse({ count: collectedLeads.size });
        return false;
    }
});

// --- Reply Detection for CRM Sync ---
function watchForMessageReplies() {
    // Only monitor on messaging pages
    if (!window.location.href.includes('linkedin.com/messaging')) return;

    // Find the messaging thread container
    const threadContainer = document.querySelector('.msg-thread, .msg-s-message-list-container, [data-view-name="messaging-thread-chat-view"]');
    if (!threadContainer) return;

    // Find the participant's profile link in the active thread header
    const profileLinkEl = document.querySelector(
        '.msg-entity-lockup__link, ' +
        '.msg-thread a[href*="/in/"], ' +
        '[data-view-name="messaging-thread-chat-view"] a[href*="/in/"], ' +
        '.msg-conversation-thread__profile-link'
    );
    if (!profileLinkEl) return;

    const rawUrl = profileLinkEl.href || '';
    if (!rawUrl.includes('/in/')) return;
    const cleanUrl = rawUrl.split('?')[0].replace(/\/$/, '');

    // Get all message events in the list
    const messageEvents = document.querySelectorAll(
        '.msg-s-message-list__event, ' +
        'li.msg-s-message-list__event, ' +
        '.msg-s-event-listitem'
    );
    if (messageEvents.length === 0) return;

    // Get the last message event
    const lastMessage = messageEvents[messageEvents.length - 1];

    // Check if the last message has a text body (is an actual message, not a system event)
    const bodyNode = lastMessage.querySelector('.msg-s-event-listitem__body, .msg-s-event__content, .msg-s-event-listitem__message-bubble');
    if (!bodyNode) return;

    // Check if the last message was sent by us (outgoing)
    const isOutgoing = lastMessage.querySelector('.msg-s-event-with-indicator__sending-indicator') || 
                       lastMessage.classList.contains('msg-s-event-listitem--message-bubble-outgoing') ||
                       lastMessage.querySelector('[aria-label*="Options for your message"]');

    if (!isOutgoing) {
        // Last message was sent by the prospect -> they replied!
        console.log(`AutoConnect Reply Detector: Detected reply from ${cleanUrl}`);
        chrome.runtime.sendMessage({
            type: 'DETECTED_REPLY',
            linkedinUrl: cleanUrl,
            newStatus: 'REPLIED'
        });
    }
}

// Start reply watcher
setInterval(watchForMessageReplies, 5000);
