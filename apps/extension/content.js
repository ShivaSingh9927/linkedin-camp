console.log('LinkedIn Outreach Content Script Loaded');

const scrapeLeads = () => {
    const leads = [];
    // Selective for both normal search and Sales Navigator if possible
    const leadElements = document.querySelectorAll('.reusable-search__result-container, .search-results__result-item');

    leadElements.forEach(el => {
        const nameEl = el.querySelector('.entity-result__title-text a, .artdeco-entity-lockup__title a');
        const titleEl = el.querySelector('.entity-result__primary-subtitle, .artdeco-entity-lockup__subtitle');

        const linkedinUrl = nameEl ? nameEl.href.split('?')[0] : null;
        const fullName = nameEl ? nameEl.innerText.trim() : '';
        const jobTitle = titleEl ? titleEl.innerText.trim() : '';

        // Simple name parsing
        const names = fullName.split(' ');
        const firstName = names[0] || '';
        const lastName = names.slice(1).join(' ') || '';

        if (linkedinUrl && firstName) {
            leads.push({ firstName, lastName, jobTitle, linkedinUrl });
        }
    });

    return leads;
};

const injectImportButton = () => {
    if (document.getElementById('autoconnect-import-btn')) return;

    const btn = document.createElement('button');
    btn.id = 'autoconnect-import-btn';
    btn.innerHTML = `
        <div style="display:flex; align-items:center; gap:8px;">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
            <span>Import Leads</span>
        </div>
    `;

    // Premium style
    btn.style.cssText = `
        position: fixed;
        bottom: 30px;
        right: 30px;
        z-index: 999999;
        padding: 12px 24px;
        background: linear-gradient(135deg, #2563eb 0%, #4f46e5 100%);
        color: white;
        border: none;
        border-radius: 14px;
        cursor: pointer;
        font-family: -apple-system, system-ui, sans-serif;
        font-weight: 700;
        font-size: 14px;
        box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05);
        transition: all 0.2s ease;
    `;

    btn.onmouseover = () => btn.style.transform = 'translateY(-2px) scale(1.02)';
    btn.onmouseout = () => btn.style.transform = 'translateY(0) scale(1)';

    btn.onclick = () => {
        const leads = scrapeLeads();
        if (leads.length > 0) {
            btn.innerHTML = 'Importing...';
            btn.disabled = true;

            chrome.runtime.sendMessage({ type: 'IMPORT_LEADS', leads }, (response) => {
                btn.innerHTML = 'Import Leads';
                btn.disabled = false;
                if (response && response.success) {
                    alert(`🚀 Successfully imported ${leads.length} leads!`);
                } else {
                    alert('❌ Import failed. Make sure you are logged into the extension and dashboard.');
                }
            });
        } else {
            alert('🧐 No leads detected on this page. Make sure you are on a people search result page.');
        }
    };

    document.body.appendChild(btn);
}

// Watch for search page
const checkPage = () => {
    const searchResults = document.querySelectorAll('.reusable-search__result-container, .search-results__result-item, .artdeco-entity-lockup');
    const isSearchPage = window.location.href.includes('/search/') || window.location.href.includes('/sales/search/');

    if (isSearchPage || searchResults.length > 5) {
        injectImportButton();
    } else {
        // Optional: keep button if on a profile page too? No, usually just search.
        const existing = document.getElementById('autoconnect-import-btn');
        // We only remove if it's definitely not a relevant page
        if (existing && !isSearchPage && searchResults.length < 2) {
            existing.remove();
        }
    }
};

const observer = new MutationObserver(checkPage);
observer.observe(document.body, { childList: true, subtree: true });
checkPage();
