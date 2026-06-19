// background.js — Service worker for AutoConnect extension
//
// Scope (post-Phase-B.0 cleanup): purely a lead-import + side-panel host.
// Session sync is handled server-side by the qampi session-manager — the
// extension no longer captures cookies or pushes them. The old code paths
// (autoSyncSession, getSessionData, SYNC_COOKIE/SAVE_TOKEN/FORCE_LOGIN_SYNC
// message types, hourly-cookie-sync alarm) have all been removed.

chrome.sidePanel.setOptions({
    enabled: true
}).catch(() => {});

// Apollo/Waalaxy-style behaviour: clicking the toolbar logo badge opens the
// persistent side panel directly — no intermediate popup window.
chrome.sidePanel
    .setPanelBehavior({ openPanelOnActionClick: true })
    .catch(() => {});

// Production backend. localhost stays in the list for dev iteration. The
// path "/api/v1/..." is appended at call sites, so the base must NOT
// include /api/v1 itself.
const BACKEND_URLS = [
    'https://api.qampi.com',
    'http://localhost:3001',
];

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

// ─── Message Handlers ────────────────────────────────────────
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'SAVE_TOKEN') {
        chrome.storage.local.set({ token: message.token });
    }

    if (message.type === 'IMPORT_LEADS') {
        chrome.storage.local.get(['token'], async (result) => {
            const token = result.token;
            if (!token) {
                sendResponse({ success: false, error: 'Not authenticated. Open the Qampi dashboard and log in first.' });
                return;
            }

            let lastErr = null;
            for (const base of BACKEND_URLS) {
                try {
                    const resp = await directFetch(`${base}/api/v1/leads/import`, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${token}`,
                        },
                        body: JSON.stringify({ leads: message.leads }),
                    });

                    if (resp && resp.success) {
                        console.log(`[Import] ${message.leads.length} leads imported via ${base}`);
                        sendResponse(resp);
                        return;
                    }
                    lastErr = resp ? (resp.error || `Error ${resp.status}`) : 'Backend unreachable';
                } catch (e) {
                    lastErr = `${base}: ${e.message}`;
                }
            }
            sendResponse({ success: false, error: lastErr });
        });
        return true; // async response
    }

    if (message.type === 'OPEN_SIDE_PANEL') {
        // Triggered by the floating in-page launcher. Open in the sender's
        // tab/window (content scripts don't know their own windowId).
        const tab = sender && sender.tab;
        if (tab) {
            chrome.sidePanel.open({ tabId: tab.id }).catch(() => {
                chrome.sidePanel.open({ windowId: tab.windowId }).catch(e => console.warn(e));
            });
        }
    }

    if (message.type === 'DETECTED_REPLY') {
        // Inbox-reply webhook ping (kept — unrelated to session sync).
        chrome.storage.local.get(['token', 'lastReplySync'], async (result) => {
            const token = result.token;
            if (!token) return;
            const now = Date.now();
            const lastSync = result.lastReplySync || {};
            if (lastSync.url === message.linkedinUrl && now - lastSync.timestamp < 300_000) return;
            chrome.storage.local.set({ lastReplySync: { url: message.linkedinUrl, timestamp: now } });

            for (const base of BACKEND_URLS) {
                try {
                    const resp = await directFetch(`${base}/api/webhooks/linkedin-reply`, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${token}`,
                        },
                        body: JSON.stringify({
                            linkedinUrl: message.linkedinUrl,
                            newStatus: message.newStatus,
                        }),
                    });
                    if (resp && resp.success) break;
                } catch (e) {
                    console.error(`[Webhook] Failed posting to ${base}:`, e.message);
                }
            }
        });
    }
});
