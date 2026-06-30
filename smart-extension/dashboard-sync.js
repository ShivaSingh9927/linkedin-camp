// This script runs on our dashboard to capture the JWT token.
// Guard: only run on our own app's URLs (app.qampi.com, or localhost in dev).
const hostname = window.location.hostname;
if (
    hostname !== 'localhost' &&
    hostname !== 'app.qampi.com'
) {
    // Not our app, bail out
    console.log('AutoConnect: Skipping non-matching deployment:', hostname);
} else {

    let lastToken = null;

    const checkAndSyncToken = () => {
        try {
            const token = localStorage.getItem('token');
            if (token && token !== lastToken) {
                chrome.runtime.sendMessage({ type: 'SAVE_TOKEN', token });
                lastToken = token;
                console.log('AutoConnect: Token synced to extension.');
            } else if (!token && lastToken !== null) {
                chrome.runtime.sendMessage({ type: 'SAVE_TOKEN', token: null });
                lastToken = null;
                console.log('AutoConnect: Token cleared (user logged out).');
            }
        } catch (e) {
            // Extension context invalidated (reloaded) — ignore
        }
    };

    // Check immediately
    checkAndSyncToken();

    // Then check frequently (handles SPA navigation and async logins)
    setInterval(checkAndSyncToken, 1000);

    // Also listen for storage events (handles cross-tab login)
    window.addEventListener('storage', (e) => {
        if (e.key === 'token') {
            checkAndSyncToken();
        }
    });

    // Watch for URL changes (SPA navigation from /login to /)
    let lastUrl = location.href;
    const urlObserver = new MutationObserver(() => {
        if (location.href !== lastUrl) {
            lastUrl = location.href;
            // After SPA navigation, re-check the token
            setTimeout(checkAndSyncToken, 500);
            setTimeout(checkAndSyncToken, 1500);
        }
    });
    urlObserver.observe(document.body, { childList: true, subtree: true });

} // end else guard
