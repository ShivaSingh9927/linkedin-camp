console.log('LinkedIn Outreach Content Script Loaded');

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
    const leads = [];
    const leadElements = document.querySelectorAll('.reusable-search__result-container, .search-results__result-item, .artdeco-entity-lockup');

    leadElements.forEach(el => {
        const nameEl = el.querySelector('.entity-result__title-text a, .artdeco-entity-lockup__title a, [data-test-app-search-card-title] a');
        const secondarySubtitleEl = el.querySelector('.entity-result__primary-subtitle, .artdeco-entity-lockup__subtitle');
        const tertiarySubtitleEl = el.querySelector('.entity-result__secondary-subtitle, .t-14.t-black.t-normal');

        const linkedinUrl = nameEl ? nameEl.href.split('?')[0] : null;
        const fullName = nameEl ? nameEl.innerText.trim() : '';
        const jobTitle = secondarySubtitleEl ? secondarySubtitleEl.innerText.trim() : '';

        // Attempt to find company - often in the secondary subtitle or a specific meta list
        let company = '';
        if (tertiarySubtitleEl) {
            company = tertiarySubtitleEl.innerText.trim().replace(/^at\s+/i, '');
        } else if (jobTitle.includes(' at ')) {
            company = jobTitle.split(' at ')[1];
        }

        if (linkedinUrl && fullName) {
            const names = fullName.split(' ');
            const firstName = names[0] || '';
            const lastName = names.slice(1).join(' ') || '';
            leads.push({ firstName, lastName, jobTitle, company, linkedinUrl });
        }
    });

    return leads;
};

const injectImportButton = () => {
    if (document.getElementById('autoconnect-import-btn')) return;

    const container = document.createElement('div');
    container.id = 'autoconnect-import-container';
    container.style.cssText = `
        position: fixed;
        bottom: 30px;
        right: 30px;
        z-index: 999999;
        display: flex;
        flex-direction: column;
        align-items: flex-end;
        gap: 12px;
    `;

    const btn = document.createElement('button');
    btn.id = 'autoconnect-import-btn';
    btn.innerHTML = `
        <div style="display:flex; align-items:center; gap:10px;">
            <div style="background:rgba(255,255,255,0.2); padding:6px; border-radius:8px; display:flex;">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
            </div>
            <span style="letter-spacing:-0.01em">Import Leads</span>
        </div>
    `;

    btn.style.cssText = `
        padding: 10px 20px 10px 12px;
        background: linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%);
        color: white;
        border: none;
        border-radius: 16px;
        cursor: pointer;
        font-family: -apple-system, system-ui, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
        font-weight: 800;
        font-size: 15px;
        box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
        transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        border: 1px solid rgba(255,255,255,0.1);
    `;

    btn.onmouseover = () => {
        btn.style.transform = 'translateY(-4px) scale(1.02)';
        btn.style.boxShadow = '0 25px 30px -5px rgba(79, 70, 229, 0.3)';
    };
    btn.onmouseout = () => {
        btn.style.transform = 'translateY(0) scale(1)';
        btn.style.boxShadow = '0 20px 25px -5px rgba(0, 0, 0, 0.1)';
    };

    btn.onclick = async () => {
        btn.innerHTML = 'Scanning Page...';
        btn.disabled = true;

        await scrollToBottom();

        const leads = scrapeLeads();
        if (leads.length > 0) {
            btn.innerHTML = `Importing ${leads.length} leads...`;
            chrome.runtime.sendMessage({ type: 'IMPORT_LEADS', leads }, (response) => {
                btn.innerHTML = 'Import Leads';
                btn.disabled = false;
                if (response && response.success) {
                    const notify = document.createElement('div');
                    notify.innerText = `🚀 ${leads.length} leads added to CRM!`;
                    notify.style.cssText = `
                        background: #10b981;
                        color: white;
                        padding: 12px 20px;
                        border-radius: 12px;
                        font-weight: 700;
                        font-size: 13px;
                        animation: slideIn 0.3s ease-out;
                    `;
                    container.insertBefore(notify, btn);
                    setTimeout(() => notify.remove(), 4000);
                } else {
                    alert('❌ Import failed. Check your dashboard connection.');
                }
            });
        } else {
            btn.innerHTML = 'Import Leads';
            btn.disabled = false;
            alert('🧐 No leads found. Try scrolling manually or refreshing.');
        }
    };

    const style = document.createElement('style');
    style.textContent = `
        @keyframes slideIn {
            from { opacity: 0; transform: translateY(10px); }
            to { opacity: 1; transform: translateY(0); }
        }
    `;
    document.head.appendChild(style);

    container.appendChild(btn);
    document.body.appendChild(container);
};

const checkPage = () => {
    const isSearchPage = window.location.href.includes('/search/') || window.location.href.includes('/sales/search/');
    if (isSearchPage) {
        injectImportButton();
    }
};

const observer = new MutationObserver(checkPage);
observer.observe(document.body, { childList: true, subtree: true });
checkPage();
