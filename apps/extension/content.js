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

function scanDOM() {
    let added = 0;
    const currentPage = getCurrentPageNumber();

    // ============================================================
    // PRIMARY STRATEGY: Use data-view-name="people-search-result"
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

            let jobTitle = '';
            let company = '';
            let location = '';

            // Strategy 1: Parse using the structured sections
            // Headline is the first <p> sibling after the name paragraph
            const allParagraphs = card.querySelectorAll('p');
            const textLines = [];
            allParagraphs.forEach(p => {
                const text = p.textContent.trim();
                if (text.length > 2) textLines.push(text);
            });

            // Get text from card for line-by-line analysis
            const allText = card.innerText || '';
            const lines = allText.split('\n')
                .map(l => l.trim())
                .filter(l => l.length > 0);

            for (const line of lines) {
                // Skip the name itself, buttons, degree indicators
                if (line === rawName || line === 'LinkedIn Member') continue;
                if (/^(Connect|Follow|Message|Send|Pending|More|Dismiss)$/i.test(line)) continue;
                if (/^\d+(st|nd|rd|th)$/i.test(line)) continue;
                if (/^• \d+(st|nd|rd|th)/i.test(line)) continue;
                if (line.length < 3) continue;

                // "Current: Role at Company"
                if (/^Current:/i.test(line)) {
                    const after = line.replace(/^Current:\s*/i, '').trim();
                    if (after.includes(' at ')) {
                        const parts = after.split(' at ');
                        if (!jobTitle) jobTitle = parts[0].trim();
                        company = parts.slice(1).join(' at ').trim();
                    } else if (!jobTitle) {
                        jobTitle = after;
                    }
                    continue;
                }

                // Skip metadata
                if (/^(Past|Education|Skills|Certifications|Summary):/i.test(line)) continue;
                if (/followers$/i.test(line)) continue;
                if (/^Visit my/i.test(line)) continue;
                if (/mutual connection/i.test(line)) continue;

                // Location detection (be more specific to avoid catching company names)
                if (!location && (
                    line.match(/,\s*(India|United States|UK|USA|Canada|Australia|Germany|France|Singapore|Dubai|Netherlands|Pakistan|China|Japan|Brazil|Mexico|Spain|Italy|Indonesia|Philippines|Malaysia|Bangladesh|Nepal|Sri Lanka|Thailand|Vietnam|South Korea|Russia|Turkey|Saudi Arabia|UAE|Ireland|Sweden|Norway|Denmark|Finland|Switzerland|Belgium|Austria|Czech Republic|Poland|Romania|Ukraine|Argentina|Chile|Colombia|Peru|Egypt|Nigeria|Kenya|South Africa|Ghana|Ethiopia|Tanzania)\s*$/i) ||
                    line.match(/^(Mumbai|New Delhi|Delhi|Bangalore|Bengaluru|Hyderabad|Chennai|Kolkata|Pune|Noida|Gurugram|Gurgaon|Faridabad|Agra|Nashik|Lucknow|Jaipur|Ahmedabad|Indore|Bhopal|Chandigarh|Coimbatore|Kochi|Thiruvananthapuram|Visakhapatnam|Nagpur|Patna|Ranchi|Dehradun|New York|London|San Francisco|Bay Area|Los Angeles|Seattle|Chicago|Toronto|Vancouver|Sydney|Melbourne|Singapore|Dubai|Berlin|Munich|Paris|Amsterdam|Lahore|Canton|Mandya)\b/i)
                )) {
                    location = line;
                    continue;
                }

                // First meaningful text line is the headline/job title
                if (!jobTitle && line !== rawName && line.length > 5 &&
                    !/^(Connect|Follow|Message|mutual|connection|Promoted)/i.test(line)) {
                    jobTitle = line;
                }
            }

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

            collectedLeads.set(linkedinUrl, {
                firstName, lastName, jobTitle,
                company: company,
                location: location,
                country: country,
                gender: gender,
                linkedinUrl: storeUrl
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

            let jobTitle = '';
            let company = '';
            let location = '';

            for (const line of lines) {
                if (line === rawName) continue;
                if (/^(Connect|Follow|Message|Send|Pending|More|Dismiss)$/i.test(line)) continue;
                if (/^\d+(st|nd|rd|th)$/i.test(line)) continue;
                if (line.length < 3) continue;

                if (/^Current:/i.test(line)) {
                    const after = line.replace(/^Current:\s*/i, '').trim();
                    if (after.includes(' at ')) {
                        const atParts = after.split(' at ');
                        if (!jobTitle) jobTitle = atParts[0].trim();
                        company = atParts.slice(1).join(' at ').trim();
                    } else if (!jobTitle) {
                        jobTitle = after;
                    }
                    continue;
                }
                if (/^(Past|Education|Skills|Certifications|Summary):/i.test(line)) continue;
                if (/followers$/i.test(line)) continue;

                if (!location && (
                    line.match(/,\s*(India|United States|UK|USA|Canada|Australia|Germany|France|Singapore|Dubai|Netherlands|Pakistan)\s*$/i) ||
                    line.match(/^(Mumbai|Delhi|Bangalore|Bengaluru|Hyderabad|Chennai|Kolkata|Pune|Noida|Gurugram|Gurgaon|New York|London|San Francisco|Bay Area)\b/i)
                )) {
                    location = line;
                    continue;
                }

                if (!jobTitle && line !== rawName && line.length > 5 &&
                    !/^(Connect|Follow|Message|mutual|connection)/i.test(line)) {
                    jobTitle = line;
                }
            }

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

            collectedLeads.set(linkedinUrl, {
                firstName, lastName, jobTitle,
                company: company,
                location: location,
                country: country,
                gender: gender,
                linkedinUrl
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
