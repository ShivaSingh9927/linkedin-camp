// popup.js — Unified popup for auth + import

const DASHBOARD_URLS = [
    'https://app.qampi.com',
    'http://localhost:3000'
];

// ─── Auth Status ────────────────────────────────────────────
const updateAuthStatus = () => {
    chrome.storage.local.get(['token'], (result) => {
        const badge = document.getElementById('auth-badge');
        if (result.token) {
            badge.innerText = 'Connected';
            badge.className = 'auth-badge connected';
        } else {
            badge.innerText = 'Disconnected';
            badge.className = 'auth-badge disconnected';
        }
    });
};

// ─── Dashboard Tab Finder ──────────────────────────────────
async function findDashboardTab() {
    const allTabs = await chrome.tabs.query({});
    for (const tab of allTabs) {
        if (!tab.url) continue;
        for (const dashUrl of DASHBOARD_URLS) {
            if (tab.url.startsWith(dashUrl)) {
                return tab;
            }
        }
        // Also check Vercel preview/branch deployments
        try {
            const tabHost = new URL(tab.url).hostname;
            if (tabHost === 'app.qampi.com') {
                return tab;
            }
        } catch (e) { /* ignore */ }
    }
    return null;
}

async function grabTokenFromTab(tabId) {
    try {
        const results = await chrome.scripting.executeScript({
            target: { tabId: tabId },
            func: () => localStorage.getItem('token')
        });
        if (results && results[0] && results[0].result) {
            await chrome.storage.local.set({ token: results[0].result });
            return results[0].result;
        }
    } catch (e) {
        console.error('AutoConnect: Script injection failed:', e);
    }
    return null;
}

// ─── Check if current tab is LinkedIn search ───────────────
async function getCurrentTab() {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    return tab;
}

function isLinkedInSearchUrl(url) {
    if (!url) return false;
    return (url.includes('linkedin.com/search/') || url.includes('linkedin.com/sales/search/'));
}

// ─── Import Logic ──────────────────────────────────────────
let isImporting = false;

async function handleImport() {
    if (isImporting) return;
    isImporting = true;

    const statusArea = document.getElementById('status-area');
    const listNameInput = document.getElementById('list-name');
    const listName = listNameInput ? listNameInput.value.trim() : '';
    const btn = document.getElementById('start-btn');

    // Check auth first
    const authData = await chrome.storage.local.get(['token']);
    if (!authData.token) {
        isImporting = false;
        alert('❌ Not authenticated.\n\nPlease log in to the Dashboard first, then click "Sync Session".');
        return;
    }

    // Check we're on a LinkedIn search page
    const tab = await getCurrentTab();
    if (!isLinkedInSearchUrl(tab?.url)) {
        isImporting = false;
        alert('❌ Not on a LinkedIn search page.\n\nNavigate to a LinkedIn search results page first.');
        return;
    }

    btn.innerHTML = '<div class="spinner"></div> Scanning page 1...';
    btn.disabled = true;

    try {
        // Helper to send message to content script
        const sendToContent = (msg) => new Promise((resolve, reject) => {
            chrome.tabs.sendMessage(tab.id, msg, (response) => {
                if (chrome.runtime.lastError) {
                    reject(new Error('Could not connect to LinkedIn tab. Please refresh the page.'));
                    return;
                }
                resolve(response);
            });
        });

        // --- Scrape page 1 ---
        let response = await sendToContent({ type: 'POPUP_SCRAPE_REQUEST' });
        if (!response?.success) throw new Error(response?.error || 'Scraping failed');

        let allLeads = response.leads || [];
        let hasNext = response.hasNextPage;
        let currentPage = response.currentPage || 1;
        const maxPages = 10; // safety cap

        btn.innerHTML = `<div class="spinner"></div> Page ${currentPage}... ${allLeads.length} leads`;

        // --- Auto-paginate through remaining pages ---
        while (hasNext && currentPage < maxPages) {
            // Update status
            btn.innerHTML = `<div class="spinner"></div> Moving to page ${currentPage + 1}...`;

            // Go to next page (content.js clicks the Next button)
            const nextResponse = await sendToContent({ type: 'POPUP_NEXT_PAGE' });

            if (!nextResponse?.success) break;

            allLeads = nextResponse.leads || allLeads;
            hasNext = nextResponse.hasNextPage;
            currentPage = nextResponse.currentPage || (currentPage + 1);

            btn.innerHTML = `<div class="spinner"></div> Page ${currentPage}... ${allLeads.length} leads`;

            // Small delay to be respectful
            await new Promise(r => setTimeout(r, 1000));
        }

        if (allLeads.length === 0) {
            isImporting = false;
            statusArea.innerHTML = `
                <div class="error-box">
                    <span>⚠️</span>
                    <span>No leads found. Scroll through the search results first, then try again.</span>
                </div>
                <button id="start-btn" class="primary-btn">Try Again</button>
            `;
            document.getElementById('start-btn').addEventListener('click', handleImport);
            return;
        }

        // Attach tags
        const taggedLeads = allLeads.map(lead => ({
            ...lead,
            tags: listName ? [listName] : []
        }));

        btn.innerHTML = `<div class="spinner"></div> Importing ${taggedLeads.length} leads...`;

        // Send to backend via background.js
        chrome.runtime.sendMessage({ type: 'IMPORT_LEADS', leads: taggedLeads }, (response) => {
            isImporting = false;
            if (response && response.success) {
                statusArea.innerHTML = `
                    <div class="success-box">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>
                        ${taggedLeads.length} prospects imported (${currentPage} pages)
                    </div>
                    <button id="start-btn" class="primary-btn">Start another import</button>
                `;
                if (listNameInput) listNameInput.value = '';
                document.getElementById('start-btn').addEventListener('click', handleImport);
            } else {
                const errorMsg = response?.message || response?.error || 'Unknown error';
                const errorTitle = response?.error === 'CLOUD_ACTIVE' ? 'Cloud Worker Active' : 'Import failed.';
                statusArea.innerHTML = `
                    <div class="error-box">
                        <span>❌</span>
                        <div>
                            <strong>${errorTitle}</strong><br>
                            <span style="font-size: 12px;">${errorMsg}</span>
                        </div>
                    </div>
                    <button id="start-btn" class="primary-btn">Try Again</button>
                `;
                document.getElementById('start-btn').addEventListener('click', handleImport);
            }
        });

    } catch (error) {
        isImporting = false;
        statusArea.innerHTML = `
            <div class="error-box">
                <span>❌</span>
                <div>${error.message}</div>
            </div>
            <button id="start-btn" class="primary-btn">Try Again</button>
        `;
        document.getElementById('start-btn').addEventListener('click', handleImport);
    }
}

// Session sync was removed in Phase B.0 — login is handled server-side
// by the qampi session-manager, not by the extension scraping cookies.
// The "Sync Session" button no longer exists; we keep this file lean.

// ─── Initialization ────────────────────────────────────────
(async () => {
    // Auto-grab token if dashboard is open
    const dashTab = await findDashboardTab();
    if (dashTab) {
        await grabTokenFromTab(dashTab.id);
    }
    updateAuthStatus();

    // Check if current tab is a LinkedIn search page
    const currentTab = await getCurrentTab();
    if (isLinkedInSearchUrl(currentTab?.url)) {
        document.getElementById('import-section').style.display = 'block';
        document.getElementById('not-search-section').style.display = 'none';
    } else {
        document.getElementById('import-section').style.display = 'none';
        document.getElementById('not-search-section').style.display = 'block';
    }

    // Attach import button listener
    document.getElementById('start-btn')?.addEventListener('click', handleImport);

    // Open Side Panel button
    document.getElementById('open-panel-btn')?.addEventListener('click', async () => {
        try {
            const currentWindow = await chrome.windows.getCurrent();
            await chrome.sidePanel.open({ windowId: currentWindow.id });
            window.close(); // Close the popup
        } catch (e) {
            console.error('AutoConnect: Error opening side panel:', e);
            alert('Side panel could not be opened. Please right-click the extension icon → "Open side panel".');
        }
    });

    // Batch processor link
    document.getElementById('batch-link')?.addEventListener('click', async (e) => {
        e.preventDefault();
        await chrome.tabs.create({ url: chrome.runtime.getURL('batch-process.html') });
    });
})();
