// This script runs on our dashboard to capture the JWT token
const token = localStorage.getItem('token');
if (token) {
    chrome.runtime.sendMessage({ type: 'SAVE_TOKEN', token });
}

// Watch for changes (login/logout)
window.addEventListener('storage', (e) => {
    if (e.key === 'token') {
        chrome.runtime.sendMessage({ type: 'SAVE_TOKEN', token: e.newValue });
    }
});
