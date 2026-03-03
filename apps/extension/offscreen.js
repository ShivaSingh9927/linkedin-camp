// offscreen.js — Runs in extension's own origin, can fetch localhost freely
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'OFFSCREEN_FETCH') {
        const { url, options } = message;

        fetch(url, options)
            .then(async res => {
                const contentType = res.headers.get('content-type');
                const isJson = contentType && contentType.includes('application/json');
                const data = isJson ? await res.json() : await res.text();

                if (!res.ok) {
                    sendResponse({ success: false, error: `Backend ${res.status}: ${typeof data === 'string' ? data : JSON.stringify(data)}` });
                } else {
                    sendResponse({ success: true, data });
                }
            })
            .catch(err => {
                sendResponse({ success: false, error: err.message });
            });

        return true; // keep message channel open for async response
    }
});
