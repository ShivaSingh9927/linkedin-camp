// sidepanel.js — Side panel extraction controller
// Manages the extraction lifecycle: start → scrape → paginate → export

const DASHBOARD_URLS = [
    'https://linkedin-camp-web.vercel.app',
    'http://localhost:3000'
];

// ─── State ──────────────────────────────────────────────────
let extractionState = {
    status: 'idle', // idle | running | paused | complete | error
    leads: [],
    leadsMap: new Map(), // dedup by URL
    currentPage: 0,
    maxPages: 10,
    listName: '',
    autoExport: true,
    linkedinTabId: null,
    exported: false,
    errorMsg: ''
};

// ─── DOM Elements ───────────────────────────────────────────
const els = {};
function initElements() {
    els.authBadge = document.getElementById('auth-badge');
    els.listNameInput = document.getElementById('list-name');
    els.controls = document.getElementById('controls');
    els.maxPages = document.getElementById('max-pages');
    els.autoExport = document.getElementById('auto-export');
    els.statusBanner = document.getElementById('status-banner');
    els.statLeads = document.getElementById('stat-leads');
    els.statPage = document.getElementById('stat-page');
    els.statExported = document.getElementById('stat-exported');
    els.progressSection = document.getElementById('progress-section');
    els.progressFill = document.getElementById('progress-fill');
    els.progressStatus = document.getElementById('progress-status');
    els.progressPercent = document.getElementById('progress-percent');
    els.leadsList = document.getElementById('leads-list');
    els.leadsBadge = document.getElementById('leads-badge');
    els.emptyState = document.getElementById('empty-state');
    els.notSearchSection = document.getElementById('not-search-section');
}

// ─── Auth ───────────────────────────────────────────────────
async function updateAuthStatus() {
    return new Promise(resolve => {
        chrome.storage.local.get(['token'], (result) => {
            if (result.token) {
                els.authBadge.innerText = 'Connected';
                els.authBadge.className = 'auth-badge connected';
            } else {
                els.authBadge.innerText = 'Disconnected';
                els.authBadge.className = 'auth-badge disconnected';
            }
            resolve(!!result.token);
        });
    });
}

async function findDashboardTab() {
    const allTabs = await chrome.tabs.query({});
    for (const tab of allTabs) {
        if (!tab.url) continue;
        for (const dashUrl of DASHBOARD_URLS) {
            if (tab.url.startsWith(dashUrl)) return tab;
        }
        try {
            const tabHost = new URL(tab.url).hostname;
            if (tabHost.startsWith('linkedin-camp-web') && tabHost.endsWith('.vercel.app')) return tab;
        } catch (e) { }
    }
    return null;
}

async function grabTokenFromTab(tabId) {
    try {
        const results = await chrome.scripting.executeScript({
            target: { tabId: tabId },
            func: () => localStorage.getItem('token')
        });
        if (results?.[0]?.result) {
            await chrome.storage.local.set({ token: results[0].result });
            return results[0].result;
        }
    } catch (e) {
        console.error('AutoConnect: Script injection failed:', e);
    }
    return null;
}

async function syncSession() {
    els.authBadge.innerText = 'Syncing...';

    let dashTab = await findDashboardTab();
    if (!dashTab) {
        const newTab = await chrome.tabs.create({ url: DASHBOARD_URLS[0] + '/login', active: true });
        await new Promise((resolve) => {
            let resolved = false;
            const listener = (tabId, info) => {
                if (tabId === newTab.id && info.status === 'complete') {
                    chrome.tabs.onUpdated.removeListener(listener);
                    if (!resolved) { resolved = true; resolve(); }
                }
            };
            chrome.tabs.onUpdated.addListener(listener);
            setTimeout(() => {
                chrome.tabs.onUpdated.removeListener(listener);
                if (!resolved) { resolved = true; resolve(); }
            }, 15000);
        });
        await new Promise(r => setTimeout(r, 2000));
        dashTab = await findDashboardTab();
    }

    if (dashTab) {
        const token = await grabTokenFromTab(dashTab.id);
        if (token) {
            chrome.runtime.sendMessage({ type: 'SYNC_COOKIE' });
            await updateAuthStatus();
            return;
        }
    }

    await updateAuthStatus();
    alert('❌ Could not find a logged-in dashboard.\n\n1. Open the dashboard & login\n2. Come back here');
}

// ─── Find LinkedIn Tab ──────────────────────────────────────
async function findLinkedInSearchTab() {
    const allTabs = await chrome.tabs.query({});
    for (const tab of allTabs) {
        if (tab.url && (tab.url.includes('linkedin.com/search/') || tab.url.includes('linkedin.com/sales/search/'))) {
            return tab;
        }
    }
    return null;
}

// ─── UI Updates ─────────────────────────────────────────────
function updateUI() {
    const s = extractionState;

    // Stats
    els.statLeads.textContent = s.leads.length;
    els.statPage.textContent = s.currentPage || 0;
    els.statExported.textContent = s.exported ? '✓' : '—';
    els.leadsBadge.textContent = s.leads.length;

    // Status banner
    els.statusBanner.className = 'status-banner ' + s.status;
    switch (s.status) {
        case 'idle':
            els.statusBanner.innerHTML = '<span>Ready to extract</span>';
            break;
        case 'running':
            els.statusBanner.innerHTML = `<div class="spinner-small"></div><span>Extracting page ${s.currentPage}...</span>`;
            break;
        case 'paused':
            els.statusBanner.innerHTML = `<div class="pulse-dot"></div><span>Paused — ${s.leads.length} leads collected</span>`;
            break;
        case 'complete':
            els.statusBanner.innerHTML = `<span>✓ Complete — ${s.leads.length} leads from ${s.currentPage} pages</span>`;
            break;
        case 'error':
            els.statusBanner.innerHTML = `<span>⚠ ${s.errorMsg || 'Error occurred'}</span>`;
            break;
    }

    // Progress bar
    if (s.status === 'running' || s.status === 'paused') {
        els.progressSection.style.display = 'block';
        const pct = s.maxPages > 0 ? Math.round((s.currentPage / s.maxPages) * 100) : 0;
        els.progressFill.style.width = pct + '%';
        els.progressStatus.textContent = `Page ${s.currentPage} of ${s.maxPages}`;
        els.progressPercent.textContent = pct + '%';
    } else if (s.status === 'complete') {
        els.progressSection.style.display = 'block';
        els.progressFill.style.width = '100%';
        els.progressStatus.textContent = `Done — ${s.currentPage} pages scanned`;
        els.progressPercent.textContent = '100%';
    } else {
        els.progressSection.style.display = 'none';
    }

    // Buttons — use addEventListener, NOT onclick (CSP blocks inline handlers)
    updateControlButtons();

    // Input states during extraction
    els.listNameInput.disabled = s.status === 'running' || s.status === 'paused';
    els.maxPages.disabled = s.status === 'running' || s.status === 'paused';

    // Lead list
    updateLeadList();

    // Persist state
    persistState();
}

function updateControlButtons() {
    const s = extractionState;

    // Clear existing buttons
    els.controls.innerHTML = '';

    switch (s.status) {
        case 'idle': {
            const btn = document.createElement('button');
            btn.className = 'btn btn-start';
            btn.innerHTML = `
                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>
                Start Extraction
            `;
            btn.addEventListener('click', startExtraction);
            els.controls.appendChild(btn);
            break;
        }
        case 'running': {
            const pauseBtn = document.createElement('button');
            pauseBtn.className = 'btn btn-pause';
            pauseBtn.innerHTML = `
                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16"></rect><rect x="14" y="4" width="4" height="16"></rect></svg>
                Pause
            `;
            pauseBtn.addEventListener('click', pauseExtraction);
            els.controls.appendChild(pauseBtn);

            const stopBtn = document.createElement('button');
            stopBtn.className = 'btn btn-stop';
            stopBtn.title = 'Stop extraction';
            stopBtn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="6" width="12" height="12" rx="1"></rect></svg>`;
            stopBtn.addEventListener('click', stopExtraction);
            els.controls.appendChild(stopBtn);
            break;
        }
        case 'paused': {
            const resumeBtn = document.createElement('button');
            resumeBtn.className = 'btn btn-resume';
            resumeBtn.innerHTML = `
                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>
                Resume
            `;
            resumeBtn.addEventListener('click', resumeExtraction);
            els.controls.appendChild(resumeBtn);

            const stopBtn = document.createElement('button');
            stopBtn.className = 'btn btn-stop';
            stopBtn.title = 'Stop extraction';
            stopBtn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="6" width="12" height="12" rx="1"></rect></svg>`;
            stopBtn.addEventListener('click', stopExtraction);
            els.controls.appendChild(stopBtn);
            break;
        }
        case 'complete':
        case 'error': {
            const exportBtn = document.createElement('button');
            exportBtn.className = 'btn btn-export';
            exportBtn.innerHTML = `
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="17 8 12 3 7 8"></polyline><line x1="12" y1="3" x2="12" y2="15"></line></svg>
                Export to CRM (${s.leads.length})
            `;
            exportBtn.addEventListener('click', exportToBackend);
            els.controls.appendChild(exportBtn);

            const newBtn = document.createElement('button');
            newBtn.className = 'btn btn-start';
            newBtn.style.cssText = 'flex: 0 0 auto; width: 38px;';
            newBtn.title = 'New extraction';
            newBtn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><polyline points="23 4 23 10 17 10"></polyline><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"></path></svg>`;
            newBtn.addEventListener('click', resetExtraction);
            els.controls.appendChild(newBtn);
            break;
        }
    }
}

function updateLeadList() {
    const s = extractionState;

    if (s.leads.length === 0) {
        els.emptyState.style.display = 'block';
        return;
    }

    els.emptyState.style.display = 'none';

    // Only add NEW leads (avoid re-rendering the whole list)
    const existingCards = els.leadsList.querySelectorAll('.lead-card');
    const existingCount = existingCards.length;

    if (existingCount === s.leads.length) return; // no new leads

    // Add new lead cards
    const newLeads = s.leads.slice(existingCount);
    const fragment = document.createDocumentFragment();

    for (const lead of newLeads) {
        const card = createLeadCard(lead);
        fragment.appendChild(card);
    }

    els.leadsList.appendChild(fragment);
}

function createLeadCard(lead) {
    const card = document.createElement('div');
    card.className = 'lead-card lead-card-new';

    const isMember = lead.firstName === 'LinkedIn' && lead.lastName === 'Member';
    const initials = isMember ? 'LM' : ((lead.firstName?.[0] || '') + (lead.lastName?.[0] || '')).toUpperCase();

    // Gender indicator
    const genderIcon = lead.gender === 'female' ? '♀' : lead.gender === 'male' ? '♂' : '';

    card.innerHTML = `
        <div class="lead-avatar ${isMember ? 'member' : ''}">${initials}</div>
        <div class="lead-info">
            <div class="lead-name">${escapeHtml(lead.firstName + ' ' + lead.lastName)} ${genderIcon ? `<span class="gender-icon">${genderIcon}</span>` : ''}</div>
            <div class="lead-title">${escapeHtml(lead.jobTitle || 'No title')}</div>
            ${lead.company ? `<div class="lead-company">🏢 ${escapeHtml(lead.company)}</div>` : ''}
            ${lead.location ? `<div class="lead-location">📍 ${escapeHtml(lead.location)}</div>` : ''}
            ${lead.linkedinUrl ? `<div class="lead-url">${escapeHtml(lead.linkedinUrl.replace('https://www.linkedin.com', ''))}</div>` : ''}
        </div>
    `;

    // Remove animation class after animation completes
    setTimeout(() => card.classList.remove('lead-card-new'), 400);

    return card;
}

function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// ─── State Persistence ──────────────────────────────────────
function persistState() {
    const s = extractionState;
    chrome.storage.local.set({
        extractionState: {
            status: s.status,
            leads: s.leads,
            currentPage: s.currentPage,
            maxPages: s.maxPages,
            listName: s.listName,
            autoExport: s.autoExport,
            linkedinTabId: s.linkedinTabId,
            exported: s.exported
        }
    });
}

async function restoreState() {
    return new Promise(resolve => {
        chrome.storage.local.get(['extractionState'], (result) => {
            if (result.extractionState) {
                const saved = result.extractionState;
                extractionState.leads = saved.leads || [];
                extractionState.currentPage = saved.currentPage || 0;
                extractionState.maxPages = saved.maxPages || 10;
                extractionState.listName = saved.listName || '';
                extractionState.autoExport = saved.autoExport !== false;
                extractionState.linkedinTabId = saved.linkedinTabId;
                extractionState.exported = saved.exported || false;

                // Rebuild dedup map
                extractionState.leadsMap = new Map();
                for (const lead of extractionState.leads) {
                    extractionState.leadsMap.set(lead.linkedinUrl, lead);
                }

                // If was running, mark as paused (side panel was closed/reopened)
                if (saved.status === 'running') {
                    extractionState.status = 'paused';
                } else {
                    extractionState.status = saved.status || 'idle';
                }

                // Restore inputs
                if (saved.listName) els.listNameInput.value = saved.listName;
                if (saved.maxPages) els.maxPages.value = saved.maxPages;
                els.autoExport.checked = extractionState.autoExport;
            }
            resolve();
        });
    });
}

// ─── Extraction Engine ──────────────────────────────────────
let extractionAborted = false;

function sendToContentScript(tabId, msg) {
    return new Promise((resolve, reject) => {
        chrome.tabs.sendMessage(tabId, msg, (response) => {
            if (chrome.runtime.lastError) {
                reject(new Error('Could not connect to LinkedIn tab. Please refresh the page.'));
                return;
            }
            resolve(response);
        });
    });
}

// Wait for a tab to finish loading after navigation
function waitForTabLoad(tabId) {
    return new Promise((resolve) => {
        const listener = (changedTabId, changeInfo) => {
            if (changedTabId === tabId && changeInfo.status === 'complete') {
                chrome.tabs.onUpdated.removeListener(listener);
                resolve();
            }
        };
        chrome.tabs.onUpdated.addListener(listener);
        // Safety timeout — don't wait forever
        setTimeout(() => {
            chrome.tabs.onUpdated.removeListener(listener);
            resolve();
        }, 20000);
    });
}

async function startExtraction() {
    const s = extractionState;

    // Validate list name
    const listName = els.listNameInput.value.trim();
    if (!listName) {
        els.listNameInput.style.borderColor = '#ef4444';
        els.listNameInput.style.boxShadow = '0 0 0 3px rgba(239, 68, 68, 0.15)';
        els.listNameInput.focus();
        setTimeout(() => {
            els.listNameInput.style.borderColor = '';
            els.listNameInput.style.boxShadow = '';
        }, 2000);
        return;
    }

    // Check auth
    const hasAuth = await updateAuthStatus();
    if (!hasAuth) {
        alert('❌ Not authenticated.\n\nPlease log in to the Dashboard first, then click the badge to sync.');
        return;
    }

    // Find LinkedIn tab
    const tab = await findLinkedInSearchTab();
    if (!tab) {
        s.status = 'error';
        s.errorMsg = 'No LinkedIn search tab found';
        updateUI();
        return;
    }

    // Reset state for new extraction
    s.status = 'running';
    s.leads = [];
    s.leadsMap = new Map();
    s.currentPage = 0;
    s.maxPages = parseInt(els.maxPages.value) || 10;
    s.listName = listName;
    s.autoExport = els.autoExport.checked;
    s.linkedinTabId = tab.id;
    s.exported = false;
    s.errorMsg = '';
    extractionAborted = false;

    // Clear previous leads from UI
    els.leadsList.innerHTML = '<div class="empty-state" id="empty-state" style="display:none;"><div class="icon">📋</div><p>No leads extracted yet</p></div>';
    els.emptyState = document.getElementById('empty-state');

    updateUI();

    // Start the extraction loop
    await runExtractionLoop();
}

async function runExtractionLoop() {
    const s = extractionState;

    try {
        // Scrape current page (page 1)
        s.currentPage = 1;
        updateUI();

        // Give content script time to load if page was just navigated
        await new Promise(r => setTimeout(r, 2000));

        let response = await sendToContentScript(s.linkedinTabId, { type: 'POPUP_SCRAPE_REQUEST' });
        if (!response?.success) {
            throw new Error(response?.error || 'Scraping failed');
        }

        // Add leads from page 1
        addNewLeads(response.leads || []);
        s.currentPage = response.currentPage || 1;
        updateUI();

        let hasNext = response.hasNextPage;
        let nextPageUrl = response.nextPageUrl || null;

        // If no Next button found but we know there should be more pages,
        // try constructing the URL ourselves
        if (!hasNext && !nextPageUrl) {
            const tab = await chrome.tabs.get(s.linkedinTabId);
            const url = new URL(tab.url);
            const currentPage = parseInt(url.searchParams.get('page')) || 1;
            // Only try if there could be more results
            if (currentPage === 1 && (response.leads || []).length >= 8) {
                nextPageUrl = url.toString().includes('page=')
                    ? url.toString().replace(/page=\d+/, 'page=2')
                    : url.toString() + (url.toString().includes('?') ? '&page=2' : '?page=2');
                hasNext = true;
                console.log('AutoConnect sidepanel: Next button not found, but constructing page 2 URL');
            }
        }

        console.log('AutoConnect sidepanel: Page 1 done. Leads:', s.leads.length, '| hasNext:', hasNext);

        // ─── Paginate using direct URL navigation ───
        // This is more reliable than clicking the Next button via content script,
        // because page transitions can destroy the content script context
        while (hasNext && s.currentPage < s.maxPages && !extractionAborted) {
            // Check if paused
            while (s.status === 'paused' && !extractionAborted) {
                await new Promise(r => setTimeout(r, 500));
            }

            if (extractionAborted) break;

            const nextPage = s.currentPage + 1;

            // Build the next page URL
            if (!nextPageUrl) {
                const tab = await chrome.tabs.get(s.linkedinTabId);
                const url = new URL(tab.url);
                url.searchParams.set('page', nextPage.toString());
                nextPageUrl = url.toString();
            }

            console.log('AutoConnect sidepanel: Navigating to page', nextPage);
            s.currentPage = nextPage;
            updateUI();

            // Navigate the LinkedIn tab directly
            await chrome.tabs.update(s.linkedinTabId, { url: nextPageUrl });

            // Wait for the tab to finish loading
            await waitForTabLoad(s.linkedinTabId);

            // Give the content script time to initialize, scroll, and scan
            // Content script needs: ~2s wait for body + 2s delay + ~3.5s scroll + scan = ~8s
            await new Promise(r => setTimeout(r, 8000));

            // Now scrape the freshly loaded page
            let scrapeResponse;
            try {
                scrapeResponse = await sendToContentScript(s.linkedinTabId, { type: 'POPUP_SCRAPE_REQUEST' });
            } catch (e) {
                console.warn('AutoConnect sidepanel: Content script not ready, retrying in 3s...');
                await new Promise(r => setTimeout(r, 3000));
                try {
                    scrapeResponse = await sendToContentScript(s.linkedinTabId, { type: 'POPUP_SCRAPE_REQUEST' });
                } catch (e2) {
                    console.error('AutoConnect sidepanel: Content script still not ready, stopping.');
                    break;
                }
            }

            if (!scrapeResponse?.success) {
                console.log('AutoConnect sidepanel: Scraping page', nextPage, 'failed');
                break;
            }

            addNewLeads(scrapeResponse.leads || []);
            s.currentPage = scrapeResponse.currentPage || nextPage;
            hasNext = scrapeResponse.hasNextPage;
            nextPageUrl = scrapeResponse.nextPageUrl || null;
            updateUI();

            console.log('AutoConnect sidepanel: Page', nextPage, 'done. Total leads:', s.leads.length, '| hasNext:', hasNext);

            // Rate-limiting delay
            await new Promise(r => setTimeout(r, 1000));
        }

        if (!extractionAborted) {
            s.status = 'complete';
            updateUI();

            // Auto-export if enabled
            if (s.autoExport && s.leads.length > 0) {
                await exportToBackend();
            }
        }

    } catch (error) {
        s.status = 'error';
        s.errorMsg = error.message;
        updateUI();
    }
}

function addNewLeads(newLeads) {
    const s = extractionState;
    let added = 0;
    for (const lead of newLeads) {
        // Use linkedinUrl as key for named profiles,
        // or a composite key for LinkedIn Members (who have empty URL)
        const dedupeKey = lead.linkedinUrl ||
            `member-${lead.firstName}-${lead.lastName}-${(lead.jobTitle || '').substring(0, 30)}`;
        if (!s.leadsMap.has(dedupeKey)) {
            s.leadsMap.set(dedupeKey, lead);
            s.leads.push(lead);
            added++;
        }
    }
    if (added > 0) {
        console.log('AutoConnect sidepanel: +' + added + ' leads (total: ' + s.leads.length + ')');
    }
}

function pauseExtraction() {
    extractionState.status = 'paused';
    updateUI();
}

function resumeExtraction() {
    if (extractionState.status !== 'paused') return;
    extractionState.status = 'running';
    updateUI();
    // The loop is still alive, just waiting
}

function stopExtraction() {
    extractionAborted = true;
    extractionState.status = 'complete';
    updateUI();
}

function resetExtraction() {
    extractionState = {
        status: 'idle',
        leads: [],
        leadsMap: new Map(),
        currentPage: 0,
        maxPages: parseInt(els.maxPages.value) || 10,
        listName: '',
        autoExport: els.autoExport.checked,
        linkedinTabId: null,
        exported: false,
        errorMsg: ''
    };
    extractionAborted = false;

    els.listNameInput.value = '';
    els.listNameInput.disabled = false;
    els.maxPages.disabled = false;

    // Clear lead list
    els.leadsList.innerHTML = '<div class="empty-state" id="empty-state"><div class="icon">📋</div><p>No leads extracted yet</p><p class="hint">Enter a list name and click Start Extraction</p></div>';
    els.emptyState = document.getElementById('empty-state');

    updateUI();
}

// ─── Export ─────────────────────────────────────────────────
async function exportToBackend() {
    const s = extractionState;

    if (s.leads.length === 0) {
        alert('No leads to export.');
        return;
    }

    // Tag leads with list name
    const taggedLeads = s.leads.map(lead => ({
        ...lead,
        tags: s.listName ? [s.listName] : []
    }));

    // Update UI to show exporting
    const prevStatus = s.status;
    s.status = 'running';
    els.statusBanner.className = 'status-banner running';
    els.statusBanner.innerHTML = '<div class="spinner-small"></div><span>Exporting ' + taggedLeads.length + ' leads to CRM...</span>';

    return new Promise(resolve => {
        chrome.runtime.sendMessage({ type: 'IMPORT_LEADS', leads: taggedLeads }, (response) => {
            if (response?.success) {
                s.exported = true;
                s.status = 'complete';
                els.statExported.textContent = '✓';
                els.statusBanner.className = 'status-banner complete';
                els.statusBanner.innerHTML = `<span>✓ ${taggedLeads.length} leads exported to "${escapeHtml(s.listName)}"</span>`;
            } else {
                s.status = prevStatus;
                s.errorMsg = response?.error || 'Export failed';
                els.statusBanner.className = 'status-banner error';
                els.statusBanner.innerHTML = `<span>⚠ Export failed: ${escapeHtml(s.errorMsg)}</span>`;
            }
            updateControlButtons();
            persistState();
            resolve();
        });
    });
}

// ─── Initialize ─────────────────────────────────────────────
(async () => {
    initElements();

    // Auth badge click → sync
    els.authBadge.addEventListener('click', syncSession);

    // Auto-grab token if dashboard is open
    const dashTab = await findDashboardTab();
    if (dashTab) await grabTokenFromTab(dashTab.id);
    await updateAuthStatus();

    // Restore saved state
    await restoreState();
    updateUI();

    // Check if there's a LinkedIn search tab
    const linkedinTab = await findLinkedInSearchTab();
    if (!linkedinTab) {
        els.notSearchSection.style.display = 'block';
    }
})();
