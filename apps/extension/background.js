// background.js — Service worker that relays requests through offscreen document
// Also manages side panel behavior

// ─── Side Panel Setup ───────────────────────────────────────
// Enable the side panel to appear when the user right-clicks the extension icon
// The popup is still the default click action
chrome.sidePanel.setOptions({
    enabled: true
}).catch(() => { /* sidePanel API might not be available in older Chrome */ });

// ─── Offscreen Document ─────────────────────────────────────
let creatingOffscreen;
async function ensureOffscreen() {
    const existingContexts = await chrome.runtime.getContexts({
        contextTypes: ['OFFSCREEN_DOCUMENT'],
        documentUrls: [chrome.runtime.getURL('offscreen.html')]
    });
    if (existingContexts.length > 0) return;

    if (creatingOffscreen) {
        await creatingOffscreen;
    } else {
        creatingOffscreen = chrome.offscreen.createDocument({
            url: 'offscreen.html',
            reasons: ['DOM_SCRAPING'],
            justification: 'Making API calls to localhost backend'
        });
        await creatingOffscreen;
        creatingOffscreen = null;
    }
}

// Helper: send fetch request through the offscreen document
async function offscreenFetch(url, options) {
    await ensureOffscreen();

    return new Promise((resolve) => {
        chrome.runtime.sendMessage({
            type: 'OFFSCREEN_FETCH',
            url,
            options
        }, (response) => {
            resolve(response);
        });
    });
}

// ─── Backend URLs ───────────────────────────────────────────
const BACKEND_URLS = [
    'http://204.168.167.198:3001',
    'http://localhost:3001',
    'http://127.0.0.1:3001',
    'https://linkedin-camp-production.up.railway.app'
];

let syncTabId = null;

async function checkCloudStatus(token) {
    for (const base of BACKEND_URLS) {
        try {
            const resp = await offscreenFetch(`${base}/api/v1/auth/cloud-status`, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
            if (resp && resp.success) {
                return resp; // { success: true, hasCloudWorkersRunning: boolean, ... }
            }
        } catch (e) {
            console.error(`Status check failed for ${base}`, e);
        }
    }
    return { hasCloudWorkersRunning: false };
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    // Ignore messages meant for offscreen.js
    if (message.type === 'OFFSCREEN_FETCH') {
        return false;
    }

    if (message.type === 'SAVE_TOKEN') {
        chrome.storage.local.set({ token: message.token });
        console.log('AutoConnect: Token saved from dashboard');
        autoSyncSession(); // Trigger a sync right away
        return;
    }

    if (message.type === 'FORCE_LOGIN_SYNC') {
        console.log('[Sync] Force login requested. Opening LinkedIn...');
        chrome.tabs.create({ url: 'https://www.linkedin.com/login' }, (tab) => {
            syncTabId = tab.id;
        });
        return;
    }

    if (message.type === 'SYNC_COOKIE') {
        autoSyncSession().then(result => sendResponse(result));
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
            if (!result.token) {
                return sendResponse({ success: false, error: 'No auth token. Open your Dashboard and log in first.' });
            }

            // Cloud Kill Switch check
            const status = await checkCloudStatus(result.token);
            if (status.hasCloudWorkersRunning) {
                return sendResponse({ success: false, error: 'CLOUD_ACTIVE', message: 'The backend Cloud Worker is active. Background extension tasks are paused to protect your account.' });
            }

            let lastErr = null;
            for (const base of BACKEND_URLS) {
                console.log(`AutoConnect: Trying backend for import at ${base}`);
                const resp = await offscreenFetch(`${base}/api/v1/leads/import`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${result.token}`
                    },
                    body: JSON.stringify({ leads: message.leads })
                });

                if (resp && resp.success) {
                    return sendResponse(resp);
                }
                lastErr = resp ? resp.error : 'No response from offscreen';
            }

            sendResponse({ success: false, error: lastErr });
        });
        return true;
    }
});

// Watch for the login tab reaching the feed
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    if (tabId === syncTabId && changeInfo.url && (changeInfo.url.includes('/feed') || changeInfo.url.includes('linkedin.com/mynetwork'))) {
        console.log('[Sync] User logged in. Triggering session sync...');
        
        // Give LinkedIn a moment to settle cookies
        setTimeout(() => {
            autoSyncSession().then(result => {
                if (result.success) {
                    console.log('[Sync] Session captured successfully. Closing tab.');
                    chrome.tabs.remove(tabId);
                    syncTabId = null;
                }
            });
        }, 3000);
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
            if (!result.token) {
                return resolve({ success: false, error: 'Not authenticated' });
            }

            // Grab all linkedin cookies
            chrome.cookies.getAll({ domain: "linkedin.com" }, async (cookies) => {
                const liAt = cookies.find(c => c.name === 'li_at');
                if (!liAt) {
                    return resolve({ success: false, error: 'Not logged into LinkedIn' });
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
                    const resp = await offscreenFetch(`${base}/api/v1/auth/extension-sync`, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${result.token}`
                        },
                        body: JSON.stringify({ linkedinCookie: cookieJsonStr })
                    });
                    if (resp && resp.success) {
                        console.log('[Session Sync] Successfully synced full session to cloud!');
                        return resolve(resp);
                    }
                    lastErr = resp ? resp.error : 'No response';
                }
                resolve({ success: false, error: lastErr });
            });
        });
    });
}
