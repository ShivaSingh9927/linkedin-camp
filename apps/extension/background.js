// background.js — Service worker for Aulead Extension
// Manages session synchronization and side panel behavior

chrome.sidePanel.setOptions({
    enabled: true
}).catch(() => {});

const BACKEND_URLS = [
    'http://204.168.167.198:3001',
    'http://localhost:3001'
];

let syncTabId = null;

// ─── Utility: Network Fetch ──────────────────────────────────
async function directFetch(url, options) {
    try {
        const response = await fetch(url, options);
        if (!response.ok) {
            const body = await response.json().catch(() => ({}));
            return { success: false, error: body.error || `HTTP ${response.status}`, status: response.status };
        }
        return await response.json();
    } catch (e) {
        console.error('[Network Error] Connection failed:', url, e);
        return { success: false, error: e.message };
    }
}

// ─── Logic: Session Extraction ───────────────────────────────
async function getSessionData() {
    let localStorageData = {};
    let fingerPrint = {
        userAgent: navigator.userAgent,
        platform: navigator.platform,
        language: navigator.language,
        screen: { width: 1920, height: 1080 } 
    };

    try {
        // 1. Find all LinkedIn tabs
        const allLinkedInTabs = await new Promise(res => 
            chrome.tabs.query({ url: "*://*.linkedin.com/*" }, res)
        );

        if (allLinkedInTabs && allLinkedInTabs.length > 0) {
            // 2. Prioritize the active (focused) tab, fallback to the first one
            const targetTab = allLinkedInTabs.find(t => t.active) || allLinkedInTabs[0];
            
            console.log(`[Sync] Extracting data from Tab ID: ${targetTab.id}`);

            const scriptResults = await chrome.scripting.executeScript({
                target: { tabId: targetTab.id },
                func: () => {
                    // Safety check: only scrape if logged in
                    if (!document.cookie.includes('li_at')) return null;

                    const lsData = {};
                    for (let i = 0; i < window.localStorage.length; i++) {
                        const key = window.localStorage.key(i);
                        if (key) lsData[key] = window.localStorage.getItem(key);
                    }
                    return {
                        localStorage: lsData,
                        userAgent: navigator.userAgent,
                        platform: navigator.platform,
                        language: navigator.language,
                        screen: {
                            width: window.screen.width,
                            height: window.screen.height,
                            availWidth: window.screen.availWidth,
                            availHeight: window.screen.availHeight
                        }
                    };
                }
            });
            
            const res = scriptResults[0]?.result;
            if (res) {
                localStorageData = res.localStorage;
                fingerPrint = {
                    userAgent: res.userAgent,
                    platform: res.platform,
                    language: res.language,
                    screen: res.screen
                };
            }
        }
    } catch (e) {
        console.warn("[Sync] Scrape failed, using background defaults:", e.message);
    }

    // 3. Capture & Normalize Cookies for Playwright
    const cookies = await new Promise(res => chrome.cookies.getAll({ domain: "linkedin.com" }, res));
    
    const playwrightCookies = cookies.map(c => ({
        name: c.name,
        value: c.value,
        domain: c.domain,
        path: c.path,
        secure: c.secure,
        httpOnly: c.httpOnly,
        // Critical: Mapping sameSite for Server-side Playwright compatibility
        sameSite: c.sameSite === 'no_restriction' ? 'None' : (c.sameSite === 'unspecified' ? 'Lax' : c.sameSite),
        expires: c.expirationDate || Math.round(Date.now() / 1000) + (86400 * 30) 
    }));

    return {
        cookies: playwrightCookies,
        fingerprint: fingerPrint,
        localStorage: localStorageData
    };
}

// ─── Action: Auto Sync to Backend ──────────────────────────────
async function autoSyncSession() {
    return new Promise((resolve) => {
        chrome.storage.local.get(['token'], async (result) => {
            const token = result.token;
            if (!token) return resolve({ success: false, error: 'Extension not authenticated.' });

            const session = await getSessionData();
            
            // Validate we actually have a session to sync
            if (!session.cookies.find(c => c.name === 'li_at')) {
                return resolve({ success: false, error: 'Not logged into LinkedIn.' });
            }

            let lastErr = null;
            // Loop through backends (Cloud vs Local)
            for (const base of BACKEND_URLS) {
                try {
                    const resp = await directFetch(`${base}/api/v1/auth/sync-extension`, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${token}`
                        },
                        body: JSON.stringify({ 
                            linkedinCookie: JSON.stringify(session.cookies),
                            linkedinLocalStorage: JSON.stringify(session.localStorage),
                            fingerprint: session.fingerprint 
                        })
                    });
                    
                    if (resp && resp.success) {
                        console.log(`[Sync] Successfully synced to ${base}`);
                        return resolve(resp);
                    }
                    lastErr = resp ? (resp.error || `Error ${resp.status}`) : 'Backend unreachable';
                } catch (e) {
                    lastErr = e.message;
                }
            }
            resolve({ success: false, error: lastErr });
        });
    });
}

// ─── Event Listeners ──────────────────────────────────────────

// Watch for login success
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    if (tabId === syncTabId) {
        const urlToCheck = (changeInfo.url || tab.url || "").toLowerCase();
        const isLinkedInSuccess = ['/feed', '/mynetwork', '/messaging'].some(path => urlToCheck.includes(path));

        if (isLinkedInSuccess && (changeInfo.status === 'complete' || changeInfo.url)) {
            setTimeout(() => {
                autoSyncSession().then(res => {
                    if (res.success) syncTabId = null;
                });
            }, 2000);
        }
    }
});

// Handle incoming messages
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'SAVE_TOKEN') {
        chrome.storage.local.set({ token: message.token }, () => {
            if (message.token) autoSyncSession();
        });
    }

    if (message.type === 'FORCE_LOGIN_SYNC') {
        chrome.tabs.create({ url: 'https://www.linkedin.com/login' }, (tab) => {
            syncTabId = tab.id;
        });
    }

    if (message.type === 'SYNC_COOKIE') {
        autoSyncSession().then(res => sendResponse(res));
        return true; // Keep channel open for async response
    }

    if (message.type === 'OPEN_SIDE_PANEL') {
        chrome.sidePanel.open({ windowId: message.windowId }).catch(e => console.warn(e));
    }
});

// Hourly background sync
chrome.alarms.create('hourly-cookie-sync', { periodInMinutes: 60 });
chrome.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name === 'hourly-cookie-sync') autoSyncSession();
});