// apps/extension/inject.js
(function () {
    function parseEntityResult(item) {
        if (!item.title || !item.title.text) return null;
        if (!item.entityUrn || !item.entityUrn.includes('fsd_profile:')) return null;

        const linkedinUrl = item.navigationUrl || `https://www.linkedin.com/in/${item.publicIdentifier}`;
        if (!linkedinUrl.includes('/in/')) return null;

        const rawName = item.title.text;
        const jobTitle = item.primarySubtitle?.text || '';
        const secondary = item.secondarySubtitle?.text || '';

        const cleanName = rawName.replace(/View.*?profile/ig, '').replace(/(1st|2nd|3rd\+?)/g, '').split('\n')[0].trim();
        const names = cleanName.split(' ');
        const firstName = names[0] || '';
        const lastName = names.slice(1).join(' ') || '';

        let company = secondary;
        if (secondary.toLowerCase().includes(' at ')) {
            company = secondary.substring(secondary.toLowerCase().indexOf(' at ') + 4).trim();
        }

        return {
            firstName,
            lastName,
            jobTitle,
            company,
            linkedinUrl: linkedinUrl.split('?')[0]
        };
    }

    const parseSearchResponse = (responseText) => {
        try {
            const data = JSON.parse(responseText);
            let leads = [];

            // Traverse the data object for search results
            const searchResults = [];

            function traverse(obj) {
                if (!obj || typeof obj !== 'object') return;

                // Classic Search results pattern
                if (obj.included) {
                    obj.included.forEach(item => {
                        if (item.$type && item.$type.includes('search.SearchProfile')) {
                            searchResults.push(item);
                        } else if (item.entityUrn && item.entityUrn.includes('fsd_profile:')) {
                            searchResults.push(item);
                        }
                    });
                }

                // Recursively traverse
                for (let key in obj) {
                    if (obj.hasOwnProperty(key)) {
                        if (typeof obj[key] === 'object') traverse(obj[key]);
                    }
                }
            }

            traverse(data);

            searchResults.forEach(item => {
                const lead = parseEntityResult(item);
                if (lead) {
                    leads.push(lead);
                }
            });

            // De-duplicate leads
            const uniqueLeads = [];
            const urls = new Set();
            leads.forEach(lead => {
                if (!urls.has(lead.linkedinUrl)) {
                    urls.add(lead.linkedinUrl);
                    uniqueLeads.push(lead);
                }
            });

            if (uniqueLeads.length > 0) {
                window.postMessage({ type: 'AUTOCONNECT_VOYAGER_DATA', leads: uniqueLeads }, '*');
            }
        } catch (e) { }
    };

    const originalXHRSend = XMLHttpRequest.prototype.send;
    XMLHttpRequest.prototype.send = function () {
        this.addEventListener('load', function () {
            try {
                if (this.responseURL && this.responseURL.includes('voyager/api/')) {
                    parseSearchResponse(this.responseText);
                }
            } catch (e) { }
        });
        originalXHRSend.apply(this, arguments);
    };

    const originalFetch = window.fetch;
    window.fetch = async function (...args) {
        const response = await originalFetch.apply(this, args);
        try {
            const url = args[0] && typeof args[0] === 'string' ? args[0] : (args[0] && args[0].url ? args[0].url : '');
            if (url.includes('voyager/api/')) {
                const clone = response.clone();
                clone.text().then(parseSearchResponse).catch(() => { });
            }
        } catch (e) { }
        return response;
    };
})();
