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
    'http://localhost:3001',
    'http://127.0.0.1:3001',
    'https://linkedin-camp-production.up.railway.app'
];

// ─── Message Handler ────────────────────────────────────────
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'SAVE_TOKEN') {
        chrome.storage.local.set({ token: message.token });
        console.log('AutoConnect: Token saved from dashboard');
        return;
    }

    if (message.type === 'SYNC_COOKIE') {
        chrome.cookies.get({ url: "https://www.linkedin.com", name: "li_at" }, (cookie) => {
            if (cookie) {
                chrome.storage.local.get(['token'], async (result) => {
                    if (result.token) {
                        let lastErr = null;

                        for (const base of BACKEND_URLS) {
                            console.log(`AutoConnect: Trying backend at ${base}`);
                            const resp = await offscreenFetch(`${base}/api/v1/auth/extension-sync`, {
                                method: 'POST',
                                headers: {
                                    'Content-Type': 'application/json',
                                    'Authorization': `Bearer ${result.token}`
                                },
                                body: JSON.stringify({ linkedinCookie: cookie.value })
                            });

                            if (resp && resp.success) {
                                return sendResponse(resp);
                            }
                            lastErr = resp ? resp.error : 'No response';
                        }

                        sendResponse({ success: false, error: lastErr });
                    } else {
                        sendResponse({ success: false, error: 'User not authenticated. Please log in to the dashboard.' });
                    }
                });
            } else {
                sendResponse({ success: false, error: 'LinkedIn cookie (li_at) not found. Are you logged into LinkedIn?' });
            }
        });
        return true;
    }

    if (message.type === 'IMPORT_LEADS') {
        chrome.storage.local.get(['token'], async (result) => {
            if (result.token) {
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
            } else {
                sendResponse({ success: false, error: 'No auth token. Open your Dashboard and log in first.' });
            }
        });
        return true;
    }

    // Open side panel from popup
    if (message.type === 'OPEN_SIDE_PANEL') {
        chrome.sidePanel.open({ windowId: message.windowId }).catch(e => {
            console.warn('AutoConnect: Could not open side panel:', e);
        });
        return;
    }

    // Ignore messages meant for offscreen.js
    if (message.type === 'OFFSCREEN_FETCH') {
        return false;
    }
});
