const updateStatus = () => {
    chrome.storage.local.get(['token'], (result) => {
        const badge = document.getElementById('auth-status');
        const infoText = document.getElementById('info-text');

        if (result.token) {
            badge.innerText = 'Authenticated';
            badge.className = 'badge badge-success';
            infoText.innerText = 'Your session is active. You can now sync your LinkedIn cookie to the cloud engine.';
        } else {
            badge.innerText = 'Disconnected';
            badge.className = 'badge badge-error';
            infoText.innerText = 'Please log in to the Campaign Dashboard to authenticate the extension.';
        }
    });
};

document.getElementById('sync-btn').onclick = function () {
    const btn = this;
    const originalContent = btn.innerHTML;

    btn.innerHTML = 'Syncing...';
    btn.disabled = true;

    chrome.runtime.sendMessage({ type: 'SYNC_COOKIE' }, (response) => {
        btn.innerHTML = originalContent;
        btn.disabled = false;

        if (response && response.success) {
            alert('🚀 LinkedIn session synced successfully!');
        } else {
            alert('❌ Sync failed: ' + (response?.error || 'Unknown error'));
        }
    });
};

updateStatus();
