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

const DDG_ORIGINS = [
    'https://duckduckgo.com/*',
    'https://html.duckduckgo.com/*',
    'https://api.duckduckgo.com/*',
];
const SEARCH_FALLBACK_ORIGINS = ['https://www.bing.com/*'];
const WEB_SEARCH_ORIGINS = [...DDG_ORIGINS, ...SEARCH_FALLBACK_ORIGINS];
const WEB_SEARCH_CACHE_KEY = 'copilotWebSearchCache';
const WEB_SEARCH_TTL_MS = 24 * 60 * 60 * 1000;
const WEB_SEARCH_MAX_RESULTS = 5;

function cleanSearchText(value, max = 420) {
    return String(value || '')
        .replace(/<[^>]*>/g, ' ')
        .replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#x27;|&#39;/g, "'")
        .replace(/&lt;/g, '<').replace(/&gt;/g, '>')
        .replace(/\s+/g, ' ').trim().slice(0, max);
}

function unwrapDdgUrl(value) {
    try {
        const url = new URL(value, 'https://duckduckgo.com');
        return url.searchParams.get('uddg') || url.href;
    } catch { return value; }
}

// DuckDuckGo has no stable full-search API. Keep the parser deliberately small,
// return only a handful of public snippets, and fail soft if its result markup
// changes. This is a browser-side convenience, never a crawler.
function parseDdgHtml(html) {
    const blocks = html.match(/<div[^>]+class="[^\"]*result__body[^\"]*"[\s\S]*?<\/div>\s*<\/div>/gi) || [];
    const results = [];
    for (const block of blocks) {
        const link = block.match(/<a[^>]+class="[^\"]*result__a[^\"]*"[^>]+href="([^\"]+)"[^>]*>([\s\S]*?)<\/a>/i)
            || block.match(/<a[^>]+href="([^\"]+)"[^>]+class="[^\"]*result__a[^\"]*"[^>]*>([\s\S]*?)<\/a>/i);
        if (!link) continue;
        const snippet = block.match(/class="[^\"]*result__snippet[^\"]*"[^>]*>([\s\S]*?)<\//i);
        const title = cleanSearchText(link[2], 180);
        const url = unwrapDdgUrl(link[1]);
        if (!title || !url || !/^https?:\/\//i.test(url)) continue;
        results.push({ title, url, snippet: cleanSearchText(snippet?.[1] || '', 420) });
        if (results.length >= WEB_SEARCH_MAX_RESULTS) break;
    }

    // DDG occasionally changes the result container nesting (especially for
    // regional/Edge responses). Fall back to the stable result__a anchors so
    // valid public results are not discarded just because wrapper markup moved.
    if (!results.length) {
        const anchors = [...html.matchAll(/<a[^>]+class="[^\"]*result__a[^\"]*"[^>]+href="([^\"]+)"[^>]*>([\s\S]*?)<\/a>/gi)];
        for (const match of anchors) {
            const title = cleanSearchText(match[2], 180);
            const url = unwrapDdgUrl(match[1]);
            if (!title || !url || !/^https?:\/\//i.test(url)) continue;
            const tail = html.slice((match.index || 0) + match[0].length, (match.index || 0) + match[0].length + 3500);
            const snippetMatch = tail.match(/class="[^\"]*result__snippet[^\"]*"[^>]*>([\s\S]*?)<\//i);
            results.push({ title, url, snippet: cleanSearchText(snippetMatch?.[1] || '', 420) });
            if (results.length >= WEB_SEARCH_MAX_RESULTS) break;
        }
    }
    return results;
}

function parseBingRss(xml) {
    const results = [];
    const items = xml.match(/<item>[\s\S]*?<\/item>/gi) || [];
    for (const item of items) {
        const title = item.match(/<title>([\s\S]*?)<\/title>/i)?.[1];
        const url = item.match(/<link>([\s\S]*?)<\/link>/i)?.[1];
        const snippet = item.match(/<description>([\s\S]*?)<\/description>/i)?.[1];
        const cleanUrl = String(url || '').trim();
        if (!title || !/^https?:\/\//i.test(cleanUrl)) continue;
        results.push({ title: cleanSearchText(title, 180), url: cleanUrl, snippet: cleanSearchText(snippet || '', 420) });
        if (results.length >= WEB_SEARCH_MAX_RESULTS) break;
    }
    return results;
}

async function getWebSearchPermissions() {
    const [duckDuckGo, bing] = await Promise.all([
        chrome.permissions.contains({ origins: DDG_ORIGINS }),
        chrome.permissions.contains({ origins: SEARCH_FALLBACK_ORIGINS }),
    ]);
    return { duckDuckGo, bing };
}

async function hasWebSearchPermission() {
    const permissions = await getWebSearchPermissions();
    // Treat the provider pair as one capability. Existing users may already
    // have the former DDG-only grant; returning false here prompts a one-time
    // upgrade for the Bing fallback instead of silently retrying DDG alone.
    return permissions.duckDuckGo && permissions.bing;
}

async function runBrowserWebSearch(rawQuery) {
    const query = cleanSearchText(rawQuery, 160);
    if (!query) return { ok: false, error: 'Enter a search query.' };
    try {
        const permissions = await getWebSearchPermissions();
        if (!permissions.duckDuckGo && !permissions.bing) return { ok: false, permissionNeeded: true, error: 'Allow browser search access to continue.' };

        const now = Date.now();
        const stored = await chrome.storage.local.get(WEB_SEARCH_CACHE_KEY);
        const cache = Array.isArray(stored[WEB_SEARCH_CACHE_KEY]) ? stored[WEB_SEARCH_CACHE_KEY] : [];
        const fresh = cache.filter((entry) => entry && entry.expiresAt > now).slice(0, 20);
        const cached = fresh.find((entry) => entry.query.toLowerCase() === query.toLowerCase());
        if (cached) return { ok: true, query, results: cached.results, cached: true, fetchedAt: cached.fetchedAt };

        let results = [];
        if (permissions.duckDuckGo) {
            const response = await fetch(`https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}&kl=us-en`, {
                headers: { 'Accept': 'text/html,application/xhtml+xml' },
            });
            if (response.ok) results = parseDdgHtml(await response.text());
        }
        if (!results.length && permissions.bing) {
            const fallback = await fetch(`https://www.bing.com/search?format=rss&q=${encodeURIComponent(query)}`, {
                headers: { 'Accept': 'application/rss+xml,application/xml,text/xml' },
            });
            if (fallback.ok) results.push(...parseBingRss(await fallback.text()));
        }
        if (!results.length) return { ok: false, error: 'No web results found. Try a shorter query.' };
        const entry = { query, results, fetchedAt: now, expiresAt: now + WEB_SEARCH_TTL_MS };
        await chrome.storage.local.set({ [WEB_SEARCH_CACHE_KEY]: [entry, ...fresh].slice(0, 20) });
        return { ok: true, query, results, cached: false, fetchedAt: now };
    } catch (error) {
        return { ok: false, error: error?.message || 'Could not reach DuckDuckGo.' };
    }
}

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
    if (message.type === 'COPILOT_WEB_SEARCH_STATUS') {
        hasWebSearchPermission()
            .then((permissionGranted) => sendResponse({ ok: true, installed: true, permissionGranted }))
            .catch((error) => sendResponse({ ok: false, error: error?.message || 'Could not check web-search permission.' }));
        return true;
    }

    if (message.type === 'COPILOT_WEB_SEARCH_PERMISSION') {
        chrome.permissions.request({ origins: WEB_SEARCH_ORIGINS })
            .then((granted) => sendResponse({ ok: true, permissionGranted: granted }))
            .catch((error) => sendResponse({ ok: false, error: error?.message || 'Permission request failed.' }));
        return true;
    }

    if (message.type === 'COPILOT_WEB_SEARCH') {
        runBrowserWebSearch(message.payload?.query)
            .then(sendResponse)
            .catch((error) => sendResponse({ ok: false, error: error?.message || 'Browser web search failed.' }));
        return true;
    }
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
