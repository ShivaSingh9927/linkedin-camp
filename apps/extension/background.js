// background.js — Service worker that relays requests through offscreen document
// Also manages side panel behavior

// ─── Side Panel Setup ───────────────────────────────────────
// Enable the side panel to appear when the user right-clicks the extension icon
// The popup is still the default click action
chrome.sidePanel.setOptions({
    enabled: true
}).catch(() => { /* sidePanel API might not be available in older Chrome */ });

// Helper: Direct fetch from the background agent
async function directFetch(url, options) {
    try {
        const response = await fetch(url, options);
        // Check if status is ok
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

// ─── Backend URLs ───────────────────────────────────────────
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
            
            // Wait slightly for cookies to settle
            setTimeout(async () => {
                // Try to sync with retries
                for (let i = 0; i < 3; i++) {
                    console.log(`[Sync] Sync attempt ${i + 1}/3...`);
                    const result = await autoSyncSession();
                    if (result.success) {
                        console.log('[Sync] Success! Closing protected window.');
                        chrome.tabs.remove(tabId);
                        syncTabId = null;
                        return;
                    }
                    console.warn(`[Sync] Attempt ${i + 1} failed:`, result.error);
                    await new Promise(r => setTimeout(r, 2000)); // Wait before retry
                }
                console.error('[Sync] All sync attempts failed. Tab remains open for manual check.');
            }, 1500);
        }
    }
});

// ─── Messages ────────────────────────────────────────────────
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    // Ignore messages meant for offscreen.js
    if (message.type === 'OFFSCREEN_FETCH') {
        return false;
    }

    if (message.type === 'SAVE_TOKEN') {
        chrome.storage.local.set({ token: message.token }, () => {
            console.log('[Auth] Token updated from dashboard');
            if (message.token) autoSyncSession();
        });
        return;
    }

    if (message.type === 'FORCE_LOGIN_SYNC') {
        console.log('[Sync] Force login protocol initiated...');
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
        chrome.sidePanel.open({ windowId: message.windowId }).catch(e => {
            console.warn('AutoConnect: Could not open side panel:', e);
        });
        return;
    }

    if (message.type === 'IMPORT_LEADS') {
        chrome.storage.local.get(['token'], async (result) => {
            if (!result.token) return sendResponse({ success: false, error: 'Authorization missing' });
            
            // Cloud Kill Switch check
            const status = await checkCloudStatus(result.token);
            if (status.hasCloudWorkersRunning) {
                return sendResponse({ success: false, error: 'CLOUD_ACTIVE', message: 'The backend Cloud Worker is active. Background extension tasks are paused to protect your account.' });
            }

            let lastErr = null;
            for (const base of BACKEND_URLS) {
                const resp = await directFetch(`${base}/api/v1/leads/import`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${result.token}`
                    },
                    body: JSON.stringify({ leads: message.leads })
                });
                if (resp && resp.success) return sendResponse(resp);
                lastErr = resp ? (resp.error || `Error ${resp.status}`) : 'Network Error';
            }
            sendResponse({ success: false, error: lastErr });
        });
        return true;
    }
});

// ─── Waalaxy-Style Automatic Session Sync ─────────────────────
// Listen for changes to the critical LinkedIn session cookies
chrome.cookies.onChanged.addListener((changeInfo) => {
    if (changeInfo.cookie.domain.includes('linkedin.com')) {
        if (changeInfo.cookie.name === 'li_at' || changeInfo.cookie.name === 'JSESSIONID') {
            if (!changeInfo.removed) {
                console.log(`[Session Sync] Detected change in ${changeInfo.cookie.name}. Auto-syncing...`);
                autoSyncSession();
            }
        }
    }
});

// 1 Hour interval fallback sync
chrome.alarms.create('hourly-cookie-sync', { periodInMinutes: 60 });
chrome.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name === 'hourly-cookie-sync') {
        autoSyncSession();
    }
});

async function autoSyncSession() {
    return new Promise((resolve) => {
        chrome.storage.local.get(['token'], async (result) => {
            const token = result.token;
            if (!token) return resolve({ success: false, error: 'Extension not authenticated. Please reload your dashboard.' });

            // Grab all linkedin cookies
            chrome.cookies.getAll({ domain: "linkedin.com" }, async (cookies) => {
                const liAt = cookies.find(c => c.name === 'li_at');
                if (!liAt) {
                    return resolve({ success: false, error: 'li_at cookie not found' });
                }

                // Format exactly as Playwright expects
                const playwrightCookies = cookies.map(c => ({
                    name: c.name,
                    value: c.value,
                    domain: c.domain,
                    path: c.path,
                    secure: c.secure,
                    httpOnly: c.httpOnly,
                    sameSite: c.sameSite === 'no_restriction' ? 'None' : (c.sameSite === 'unspecified' ? 'Lax' : c.sameSite)
                }));

                const cookieJsonStr = JSON.stringify(playwrightCookies);

                let lastErr = null;
                for (const base of BACKEND_URLS) {
                    try {
                        const resp = await directFetch(`${base}/api/v1/auth/extension-sync`, {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json',
                                'Authorization': `Bearer ${token}`
                            },
                            body: JSON.stringify({ linkedinCookie: cookieJsonStr })
                        });
                        if (resp && resp.success) {
                            console.log('[Session Sync] Successfully synced full session to cloud!');
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
    });
}
