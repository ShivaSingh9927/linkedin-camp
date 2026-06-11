// early-inject.js — Runs at document_start to intercept LinkedIn API calls
// This MUST run before LinkedIn's own scripts to catch search result API responses
(function () {
    const script = document.createElement('script');
    script.src = chrome.runtime.getURL('inject.js');
    script.onload = function () { this.remove(); };
    // At document_start, document.documentElement exists but head might not
    (document.head || document.documentElement).appendChild(script);
})();
