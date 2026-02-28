chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'SAVE_TOKEN') {
        chrome.storage.local.set({ token: message.token });
        console.log('Token saved from dashboard');
        return;
    }

    if (message.type === 'SYNC_COOKIE') {
        chrome.cookies.get({ url: "https://www.linkedin.com", name: "li_at" }, (cookie) => {
            if (cookie) {
                chrome.storage.local.get(['token'], (result) => {
                    if (result.token) {
                        fetch('http://localhost:3001/api/v1/auth/extension-sync', {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json',
                                'Authorization': `Bearer ${result.token}`
                            },
                            body: JSON.stringify({ linkedinCookie: cookie.value })
                        })
                            .then(res => res.json())
                            .then(data => sendResponse({ success: true, data }))
                            .catch(err => sendResponse({ success: false, error: err.message }));
                    } else {
                        sendResponse({ success: false, error: 'User not authenticated. Please log in to the dashboard.' });
                    }
                });
            } else {
                sendResponse({ success: false, error: 'LinkedIn cookie (li_at) not found. Are you logged into LinkedIn?' });
            }
        });
        return true;
    }

    if (message.type === 'IMPORT_LEADS') {
        chrome.storage.local.get(['token'], (result) => {
            if (result.token) {
                fetch('http://localhost:3001/api/v1/leads/import', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${result.token}`
                    },
                    body: JSON.stringify({ leads: message.leads })
                })
                    .then(res => res.json())
                    .then(data => sendResponse({ success: true, data }))
                    .catch(err => sendResponse({ success: false, error: err.message }));
            } else {
                sendResponse({ success: false, error: 'Not authenticated' });
            }
        });
        return true;
    }
});
