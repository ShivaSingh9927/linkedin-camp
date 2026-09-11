// Browser bridge for the optional Qampi extension web-search capability. The
// dashboard has no direct DuckDuckGo access; it only exchanges typed messages
// with our content script on app.qampi.com.

export interface BrowserWebResult {
    title: string;
    url: string;
    snippet: string;
}

export type BrowserWebSearchStatus =
    | { installed: false; permissionGranted: false }
    | { installed: true; permissionGranted: boolean };

type ExtensionResponse = {
    ok?: boolean;
    installed?: boolean;
    permissionGranted?: boolean;
    results?: BrowserWebResult[];
    query?: string;
    cached?: boolean;
    permissionNeeded?: boolean;
    error?: string;
};

const TIMEOUT_MS = 1200;

function extensionRequest(type: string, payload?: Record<string, unknown>): Promise<ExtensionResponse> {
    if (typeof window === 'undefined') return Promise.resolve({ ok: false, error: 'Browser extension is unavailable.' });
    const requestId = `qampi_web_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    return new Promise((resolve) => {
        let timeout = 0;
        const onMessage = (event: MessageEvent) => {
            if (event.source !== window || event.origin !== window.location.origin) return;
            const data = event.data;
            if (!data || data.source !== 'qampi-extension' || data.requestId !== requestId || data.type !== `${type}_RESULT`) return;
            finish(data.response || { ok: false, error: 'Extension returned no response.' });
        };
        const finish = (response: ExtensionResponse) => {
            window.clearTimeout(timeout);
            window.removeEventListener('message', onMessage);
            resolve(response);
        };
        window.addEventListener('message', onMessage);
        timeout = window.setTimeout(() => finish({ ok: false, error: 'Extension not detected.' }), TIMEOUT_MS);
        window.postMessage({ source: 'qampi-webapp', requestId, type, payload }, window.location.origin);
    });
}

export async function getBrowserWebSearchStatus(): Promise<BrowserWebSearchStatus> {
    const response = await extensionRequest('COPILOT_WEB_SEARCH_STATUS');
    return response.ok && response.installed
        ? { installed: true, permissionGranted: !!response.permissionGranted }
        : { installed: false, permissionGranted: false };
}

export async function requestBrowserWebSearchPermission(): Promise<boolean> {
    const response = await extensionRequest('COPILOT_WEB_SEARCH_PERMISSION');
    return !!(response.ok && response.permissionGranted);
}

export async function searchFromBrowser(query: string): Promise<{ query: string; results: BrowserWebResult[]; cached: boolean }> {
    const response = await extensionRequest('COPILOT_WEB_SEARCH', { query });
    if (response.permissionNeeded) throw new Error('Browser search access needs permission. Click Enable & search to continue.');
    if (!response.ok || !Array.isArray(response.results)) throw new Error(response.error || 'Web search failed.');
    const results = response.results
        .filter((r): r is BrowserWebResult => !!r && typeof r.title === 'string' && typeof r.url === 'string' && /^https:\/\//i.test(r.url))
        .slice(0, 5)
        .map((r) => ({ title: r.title.slice(0, 180), url: r.url.slice(0, 1000), snippet: typeof r.snippet === 'string' ? r.snippet.slice(0, 500) : '' }));
    if (!results.length) throw new Error('No usable web results found.');
    return { query: response.query || query, results, cached: !!response.cached };
}
