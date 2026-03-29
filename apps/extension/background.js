// background.js — Service worker that relays requests through offscreen document
// Also manages side panel behavior

chrome.sidePanel.setOptions({
    enabled: true
}).catch(() => {});

async function directFetch(url, options) {
    try {
        const response = await fetch(url, options);
        if (!response.ok) {
            const body = await response.json().catch(() => ({}));
            return { success: false, error: body.error || `HTTP ${response.status}`, status: response.status };
        }
        return await response.json();
    } catch (e) {
        console.error('[Network Error] Connection failed to:', url, e);
        return { success: false, error: e.message };
    }
}

const BACKEND_URLS = [
    'http://204.168.167.198:3001',
    'http://localhost:3001'
];

let syncTabId = null;

async function checkCloudStatus(token) {
    for (const base of BACKEND_URLS) {
        try {
            const resp = await directFetch(`${base}/api/v1/auth/cloud-status`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (resp && resp.success) return resp;
        } catch (e) {
            console.error(`Status check failed for ${base}:`, e);
        }
    }
    return { hasCloudWorkersRunning: false };
}

// Watch for the login tab reaching the feed
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    if (tabId === syncTabId) {
        const urlToCheck = (changeInfo.url || tab.url || "").toLowerCase();
        const isLinkedInSuccess = urlToCheck.includes('linkedin.com/feed') || 
                                 urlToCheck.includes('linkedin.com/mynetwork') ||
                                 urlToCheck.includes('linkedin.com/messaging');

        if (isLinkedInSuccess && (changeInfo.status === 'complete' || changeInfo.url)) {
            console.log('[Sync] Success page detected. Initializing capture sequence...');
            setTimeout(async () => {
                for (let i = 0; i < 3; i++) {
                    const result = await autoSyncSession();
                    if (result.success) {
                        console.log('[Sync] Success! Session sent to backend.');
                        syncTabId = null; 
                        return;
                    }
                    await new Promise(r => setTimeout(r, 2000));
                }
            }, 1500);
        }
    }
});

// ─── Messages ────────────────────────────────────────────────
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'OFFSCREEN_FETCH') return false;

    if (message.type === 'SAVE_TOKEN') {
        chrome.storage.local.set({ token: message.token }, () => {
            if (message.token) autoSyncSession();
        });
        return;
    }

    if (message.type === 'FORCE_LOGIN_SYNC') {
        chrome.tabs.create({ url: 'https://www.linkedin.com/login' }, (tab) => {
            syncTabId = tab.id;
        });
        return;
    }

    if (message.type === 'SYNC_COOKIE') {
        autoSyncSession().then(res => sendResponse(res));
        return true;
    }

    if (message.type === 'OPEN_SIDE_PANEL') {
        chrome.sidePanel.open({ windowId: message.windowId }).catch(e => console.warn(e));
        return;
    }

    if (message.type === 'IMPORT_LEADS') {
        // ... your existing import leads logic ...
        return true;
    }
});

chrome.alarms.create('hourly-cookie-sync', { periodInMinutes: 60 });
chrome.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name === 'hourly-cookie-sync') autoSyncSession();
});

// ─── Core Extraction & Playwright Formatting ───────────────────
async function getSessionData() {
    let localStorageData = {};
    let fingerPrint = {
        userAgent: navigator.userAgent,
        platform: navigator.platform,
        language: navigator.language,
        screen: { width: 1920, height: 1080 } 
    };

    try {
        const tabs = await new Promise(res => chrome.tabs.query({ url: "*://*.linkedin.com/*" }, res));
        if (tabs && tabs.length > 0) {
            const scriptResults = await chrome.scripting.executeScript({
                target: { tabId: tabs[0].id },
                func: () => {
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
        console.warn("[Session Sync] No active LinkedIn tab found. Using defaults.");
    }

    const cookies = await new Promise(res => chrome.cookies.getAll({ domain: "linkedin.com" }, res));
    
    // Format perfectly for Playwright injection on the server
    const playwrightCookies = cookies.map(c => ({
        name: c.name,
        value: c.value,
        domain: c.domain,
        path: c.path,
        secure: c.secure,
        httpOnly: c.httpOnly,
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
            
            if (!session.cookies.find(c => c.name === 'li_at')) {
                return resolve({ success: false, error: 'li_at cookie not found. Not logged into LinkedIn.' });
            }

            let lastErr = null;
            for (const base of BACKEND_URLS) {
                try {
                    console.log(`[Session Sync] Transmitting formatted session to ${base}...`);
                    const resp = await directFetch(`${base}/api/v1/auth/sync-extension`, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${token}`
                        },
                        body: JSON.stringify({ 
                            // The backend expects these as stringified JSON objects
                            linkedinCookie: JSON.stringify(session.cookies),
                            linkedinLocalStorage: JSON.stringify(session.localStorage),
                            fingerprint: session.fingerprint 
                        })
                    });
                    
                    if (resp && resp.success) {
                        console.log('[Session Sync] Payload successfully accepted by backend!');
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