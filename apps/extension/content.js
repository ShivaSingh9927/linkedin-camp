console.log('AutoConnect Extension Loaded');

// --- Inject Voyager API Man-In-The-Middle Script ---
const scriptWrapper = document.createElement('script');
scriptWrapper.src = chrome.runtime.getURL('inject.js');
scriptWrapper.onload = function () {
    this.remove(); // Clean up so LinkedIn doesn't notice the script tag
};
(document.head || document.documentElement).appendChild(scriptWrapper);

// Store the leads we intercept from the network
window.voyagerLeads = [];
window.addEventListener('message', (event) => {
    // Make sure we only accept messages sent by our inject.js
    if (event.source !== window || !event.data || event.data.type !== 'AUTOCONNECT_VOYAGER_DATA') {
        return;
    }
    const incomingLeads = event.data.leads || [];
    // Merge new leads with existing leads secretly
    const existingUrls = window.voyagerLeads.map(l => l.linkedinUrl);
    incomingLeads.forEach(lead => {
        if (!existingUrls.includes(lead.linkedinUrl)) {
            window.voyagerLeads.push(lead);
        }
    });
});

// --- Helper Functions ---
const sleep = (ms) => new Promise(res => setTimeout(res, ms));

const scrollToBottom = async () => {
    const distance = 100;
    const delay = 50;
    while (document.scrollingElement.scrollTop + window.innerHeight < document.scrollingElement.scrollHeight) {
        window.scrollBy(0, distance);
        await sleep(delay);
    }
    // Wait for any lazy loads
    await sleep(1000);
};

const scrapeLeads = () => {
    // 1. FIRST PRIORITY: API interception
    if (window.voyagerLeads && window.voyagerLeads.length > 0) {
        return [...window.voyagerLeads];
    }

    // 2. FALLBACK: Brute-force DOM scraping
    const leads = [];
    const urlMap = new Map();

    // Grab all links that point to a profile
    const allProfileLinks = Array.from(document.querySelectorAll('a'))
        .filter(a => a.href && a.href.includes('/in/') && !a.href.includes('/in/ACoA') && a.textContent.trim().length > 0);

    allProfileLinks.forEach(linkEl => {
        const linkedinUrl = linkEl.href.split('?')[0];

        // Skip if we already parsed this exact person
        if (urlMap.has(linkedinUrl)) return;
        urlMap.set(linkedinUrl, true);

        // Get Name
        let rawName = linkEl.textContent;
        const cleanName = rawName
            .replace(/View.*?profile/ig, '')
            .split('\n')[0]
            .replace(/•.*/, '')
            .replace(/(1st|2nd|3rd\+?)/g, '')
            .trim();

        // Build Job Title & Company by looking up the DOM tree to any container
        const card = linkEl.closest('li, div[data-chameleon-result-urn], .entity-result, .search-entity, .reusable-search__result-container');
        let jobTitle = '';
        let company = '';

        if (card) {
            const primarySubtitle = card.querySelector('.entity-result__primary-subtitle, .linked-area');
            const secondarySubtitle = card.querySelector('.entity-result__secondary-subtitle');

            jobTitle = primarySubtitle ? primarySubtitle.textContent.trim().split('\n')[0] : '';

            if (secondarySubtitle) {
                company = secondarySubtitle.textContent.trim().replace(/^at\s+/i, '');
            } else if (jobTitle.includes(' at ')) {
                company = jobTitle.split(' at ')[1].trim();
            }
        }

        if (linkedinUrl && cleanName && cleanName !== 'LinkedIn') {
            const names = cleanName.split(' ');
            const firstName = names[0] || '';
            const lastName = names.slice(1).join(' ') || '';

            leads.push({ firstName, lastName, jobTitle, company, linkedinUrl });
            console.log("Scraped fallback lead:", cleanName, linkedinUrl);
        }
    });

    return leads;
};

// --- UI Injection ---
let isSidebarOpen = false;

const injectUI = () => {
    if (document.getElementById('autoconnect-root')) return;

    // 1. Create the Root Container
    const root = document.createElement('div');
    root.id = 'autoconnect-root';
    document.body.appendChild(root);

    // 2. Attach Shadow DOM (to prevent LinkedIn's CSS from breaking our design)
    const shadow = root.attachShadow({ mode: 'open' });

    // 3. Inject CSS
    const style = document.createElement('style');
    style.textContent = `
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');

        :host {
            --primary: #4f46e5;
            --primary-hover: #4338ca;
            --text-main: #1e293b;
            --text-muted: #64748b;
            --border: #e2e8f0;
            font-family: 'Inter', -apple-system, sans-serif;
            z-index: 2147483647; /* Max z-index */
            position: fixed;
        }

        /* --- Toggle Button --- */
        #ac-toggle {
            position: fixed;
            top: 50%;
            right: 0;
            transform: translateY(-50%);
            background: var(--primary);
            color: white;
            border: none;
            padding: 12px 10px;
            border-radius: 8px 0 0 8px;
            cursor: pointer;
            box-shadow: -2px 0 10px rgba(0,0,0,0.1);
            transition: right 0.3s cubic-bezier(0.4, 0, 0.2, 1);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 2147483647;
        }
        #ac-toggle:hover {
            background: var(--primary-hover);
            padding-right: 15px;
        }
        #ac-toggle.hidden {
            right: -50px;
        }

        /* --- Sidebar Drawer --- */
        #ac-sidebar {
            position: fixed;
            top: 0;
            right: -400px;
            width: 380px;
            height: 100vh;
            background: white;
            box-shadow: -5px 0 25px rgba(0,0,0,0.1);
            transition: right 0.3s cubic-bezier(0.4, 0, 0.2, 1);
            z-index: 2147483647;
            display: flex;
            flex-direction: column;
        }
        #ac-sidebar.open {
            right: 0;
        }

        /* --- Header --- */
        .header {
            display: flex;
            align-items: center;
            justify-content: space-between;
            padding: 16px 24px;
            border-bottom: 1px solid var(--border);
        }
        .header-left {
            display: flex;
            align-items: center;
            gap: 10px;
        }
        .logo {
            width: 24px;
            height: 24px;
            background: linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%);
            border-radius: 6px;
            color: white;
            display: flex;
            align-items: center;
            justify-content: center;
            font-weight: 800;
            font-size: 14px;
        }
        .brand {
            font-weight: 700;
            color: var(--primary);
            font-size: 16px;
            letter-spacing: -0.5px;
        }
        .header-actions {
            display: flex;
            gap: 12px;
            color: var(--text-muted);
        }
        .icon-btn {
            background: transparent;
            border: none;
            cursor: pointer;
            color: inherit;
            padding: 4px;
            border-radius: 4px;
            display: flex;
            align-items: center;
            justify-content: center;
            transition: background 0.2s;
        }
        .icon-btn:hover {
            background: #f1f5f9;
            color: var(--text-main);
        }

        /* --- Content Area --- */
        .content {
            padding: 32px 24px;
            flex-grow: 1;
        }
        h2 {
            margin: 0 0 24px 0;
            font-size: 22px;
            font-weight: 600;
            color: var(--text-main);
            line-height: 1.3;
        }

        /* --- Status States --- */
        .status-area {
            display: flex;
            flex-direction: column;
            gap: 16px;
        }
        .success-box {
            display: flex;
            align-items: center;
            gap: 12px;
            padding: 12px 16px;
            background: #f0fdf4;
            border-radius: 8px;
            color: #16a34a;
            font-weight: 500;
            font-size: 14px;
            border: 1px solid #bbf7d0;
        }

        .error-box {
            display: flex;
            align-items: flex-start;
            gap: 12px;
            padding: 12px 16px;
            background: #fef2f2;
            border-radius: 8px;
            color: #dc2626;
            font-weight: 500;
            font-size: 14px;
            border: 1px solid #fecaca;
            overflow-wrap: break-word;
            word-break: break-word;
        }

        /* --- Inputs --- */
        .form-group {
            margin-bottom: 20px;
        }
        .form-group label {
            display: block;
            margin-bottom: 8px;
            font-size: 14px;
            font-weight: 600;
            color: var(--text-main);
        }
        .form-group input {
            width: 100%;
            padding: 12px;
            border: 1px solid var(--border);
            border-radius: 8px;
            font-size: 14px;
            font-family: inherit;
            box-sizing: border-box;
        }
        .form-group input:focus {
            outline: none;
            border-color: var(--primary);
            box-shadow: 0 0 0 3px rgba(79, 70, 229, 0.1);
        }
        .warning-text {
            color: #d97706;
            font-size: 13px;
            text-align: center;
            margin-top: 12px;
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 6px;
        }

        .primary-btn {
            width: 100%;
            padding: 14px 8px; /* Slightly less side padding to prevent overflow */
            background: #2563eb;
            color: white;
            border: none;
            border-radius: 8px;
            font-size: 14px;
            font-weight: 600;
            cursor: pointer;
            transition: background 0.2s;
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 8px;
            white-space: nowrap; /* Forces text to stay on one line safely */
            box-sizing: border-box; /* Ensures padding respects 100% width */
        }
        .primary-btn:hover {
            background: #1d4ed8;
        }
        .primary-btn:disabled {
            background: #94a3b8;
            cursor: not-allowed;
        }

        .secondary-link {
            display: block;
            text-align: center;
            color: #2563eb;
            text-decoration: none;
            font-size: 14px;
            font-weight: 600;
            margin-top: 16px;
        }
        .secondary-link:hover {
            text-decoration: underline;
        }

        /* Spinner */
        .spinner {
            width: 16px;
            height: 16px;
            border: 2px solid rgba(255,255,255,0.3);
            border-radius: 50%;
            border-top-color: #fff;
            animation: spin 1s ease-in-out infinite;
            flex-shrink: 0; /* Prevents spinner from squishing */
        }
        @keyframes spin {
            to { transform: rotate(360deg); }
        }
    `;
    shadow.appendChild(style);

    // 4. Build the DOM
    const toggleBtn = document.createElement('button');
    toggleBtn.id = 'ac-toggle';
    toggleBtn.innerHTML = `
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
    `;

    const sidebar = document.createElement('div');
    sidebar.id = 'ac-sidebar';
    sidebar.innerHTML = `
        <div class="header">
            <div class="header-left">
                <div class="logo">A</div>
                <div class="brand">AUTOCONNECT</div>
            </div>
            <div class="header-actions">
                <a href="https://linkedin-camp-web.vercel.app/inbox" target="_blank" class="icon-btn" title="Dashboard">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path><polyline points="15 3 21 3 21 9"></polyline><line x1="10" y1="14" x2="21" y2="3"></line></svg>
                </a>
                <button id="ac-close" class="icon-btn" title="Close">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                </button>
            </div>
        <div class="content">
            <h2>Import prospects from this search</h2>
            <div id="ac-form-area" class="form-group">
                <label for="ac-list-name">List Name / Tag (Optional)</label>
                <input type="text" id="ac-list-name" placeholder="e.g. 'CEOs in New York'">
            </div>
            <div class="status-area" id="ac-status-area">
                <button id="ac-start-btn" class="primary-btn">Start a new import</button>
                <a href="https://linkedin-camp-web.vercel.app/leads" target="_blank" class="secondary-link">View imported prospects &rarr;</a>
            </div>
        </div>
    `;

    shadow.appendChild(toggleBtn);
    shadow.appendChild(sidebar);

    // 5. Interaction Logic
    const closeBtn = shadow.getElementById('ac-close');
    const startBtn = shadow.getElementById('ac-start-btn');
    const statusArea = shadow.getElementById('ac-status-area');

    const toggleSidebar = () => {
        isSidebarOpen = !isSidebarOpen;
        if (isSidebarOpen) {
            sidebar.classList.add('open');
            toggleBtn.classList.add('hidden');
        } else {
            sidebar.classList.remove('open');
            toggleBtn.classList.remove('hidden');
            // reset state on close
            resetStatusArea();
        }
    };

    const resetStatusArea = () => {
        statusArea.innerHTML = `
            <button id="ac-start-btn" class="primary-btn">Start a new import</button>
            <a href="https://linkedin-camp-web.vercel.app/leads" target="_blank" class="secondary-link">View imported prospects &rarr;</a>
        `;
        // Re-attach listener 
        shadow.getElementById('ac-start-btn').addEventListener('click', handleImport);
    };

    let isImporting = false;

    const handleImport = async () => {
        if (isImporting) return; // Prevention for double-clicks / parallel runs in same sidebar

        if (!navigator.onLine) {
            alert("No internet connection. Please check your network.");
            return;
        }

        isImporting = true;

        const listNameInput = shadow.getElementById('ac-list-name');
        const listName = listNameInput ? listNameInput.value.trim() : '';

        const btn = shadow.getElementById('ac-start-btn');
        btn.innerHTML = `<div class="spinner"></div> Scrolling & Scraping...`;
        btn.disabled = true;

        const warningMsg = document.createElement('div');
        warningMsg.className = 'warning-text';
        warningMsg.innerHTML = `⚠️ Do not close or refresh this tab while importing`;
        statusArea.appendChild(warningMsg);

        try {
            await scrollToBottom();
            const rawLeads = scrapeLeads();

            // Attach Tags
            const leads = rawLeads.map(lead => ({
                ...lead,
                tags: listName ? [listName] : []
            }));

            if (leads.length > 0) {
                btn.innerHTML = `<div class="spinner"></div> Importing ${leads.length} leads...`;

                chrome.runtime.sendMessage({ type: 'IMPORT_LEADS', leads }, (response) => {
                    isImporting = false;
                    if (response && response.success) {
                        statusArea.innerHTML = `
                            <div class="success-box">
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>
                                ${leads.length} imported prospects
                            </div>
                            <button id="ac-start-btn" class="primary-btn" style="margin-top: 8px;">Start another import</button>
                            <a href="https://linkedin-camp-web.vercel.app/leads" target="_blank" class="secondary-link">View imported prospects &rarr;</a>
                        `;
                        if (listNameInput) listNameInput.value = '';
                        shadow.getElementById('ac-start-btn').addEventListener('click', handleImport);
                    } else {
                        console.error("AutoConnect import error:", response ? response.error : 'No response');
                        statusArea.innerHTML = `
                            <div class="error-box">
                                <svg style="min-width: 20px; flex-shrink: 0; margin-top: 2px;" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>
                                <div style="flex: 1; min-width: 0;">
                                    <strong>Import failed.</strong>
                                    <span style="font-size: 13px; margin-top: 4px; display: block; overflow-wrap: break-word;">${response && response.error ? response.error : 'Unknown error.'}</span>
                                </div>
                            </div>
                            <button id="ac-start-btn" class="primary-btn" style="margin-top: 8px;">Try Again</button>
                            <a href="https://linkedin-camp-web.vercel.app/leads" target="_blank" class="secondary-link">Go to Dashboard &rarr;</a>
                        `;
                        shadow.getElementById('ac-start-btn').addEventListener('click', handleImport);
                    }
                });
            } else {
                isImporting = false;
                alert('No leads found on this page.');
                resetStatusArea();
            }
        } catch (error) {
            isImporting = false;
            console.error("Scraping error:", error);
            statusArea.innerHTML = `
                <div class="error-box">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>
                    Error scraping page. Please refresh and try again.
                </div>
                <button id="ac-start-btn" class="primary-btn" style="margin-top: 8px;">Try Again</button>
            `;
            shadow.getElementById('ac-start-btn').addEventListener('click', handleImport);
        }
    };

    // Attach base listeners
    toggleBtn.addEventListener('click', toggleSidebar);
    closeBtn.addEventListener('click', toggleSidebar);
    startBtn.addEventListener('click', handleImport);
};

// Only inject on relevant pages
const checkPage = () => {
    const isSearchPage = window.location.href.includes('/search/') || window.location.href.includes('/sales/search/');
    if (isSearchPage) {
        injectUI();
    }
};

const observer = new MutationObserver(checkPage);
observer.observe(document.body, { childList: true, subtree: true });
checkPage();

