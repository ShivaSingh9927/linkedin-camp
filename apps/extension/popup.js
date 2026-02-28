const updateStatus = () => {
    chrome.storage.local.get(['token'], (result) => {
        const box = document.getElementById('status-box');
        if (result.token) {
            box.innerHTML = 'Status: <span class="connected">Authenticated</span>';
        } else {
            box.innerHTML = 'Status: <span class="disconnected">Not logged in</span><br/><small>Login to the dashboard to start.</small>';
        }
    });
};

document.getElementById('sync-btn').onclick = () => {
    chrome.runtime.sendMessage({ type: 'SYNC_COOKIE' }, (response) => {
        if (response && response.success) {
            alert('LinkedIn session synced successfully!');
        } else {
            alert('Sync failed: ' + (response?.error || 'Unknown error'));
        }
    });
};

updateStatus();
