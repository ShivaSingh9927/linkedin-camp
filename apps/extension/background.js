// background.js — Service worker that relays requests through offscreen document

// Ensure offscreen document exists
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
                        const URLS = ['http://localhost:3001', 'http://127.0.0.1:3001'];
                        let lastErr = null;

                        for (const base of URLS) {
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
                const URLS = ['http://localhost:3001', 'http://127.0.0.1:3001'];
                let lastErr = null;

                for (const base of URLS) {
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

    // Ignore messages meant for offscreen.js
    if (message.type === 'OFFSCREEN_FETCH') {
        return false;
    }
});
