// This script runs on our dashboard to capture the JWT token
let lastToken = null;

const checkAndSyncToken = () => {
    const token = localStorage.getItem('token');
    if (token && token !== lastToken) {
        chrome.runtime.sendMessage({ type: 'SAVE_TOKEN', token });
        lastToken = token;
        console.log('AutoConnect: Token synced to extension.');
    } else if (!token && lastToken !== null) {
        // User logged out
        chrome.runtime.sendMessage({ type: 'SAVE_TOKEN', token: null });
        lastToken = null;
    }
};

// Check immediately
checkAndSyncToken();

// Then check periodically (handles async logins without needing page refresh)
setInterval(checkAndSyncToken, 2000);

