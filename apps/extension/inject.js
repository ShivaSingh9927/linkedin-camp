// inject.js — MAIN world script
// 1. Extracts embedded SSR data from LinkedIn's <code> elements (legacy) or __como_rehydration__ (new)
// 2. Intercepts XHR/fetch for subsequent page navigations
(function () {
    'use strict';

    // Prevent double-initialization
    if (window.__AUTOCONNECT_INJECT_LOADED__) return;
    window.__AUTOCONNECT_INJECT_LOADED__ = true;

    const SENT_URLS = new Set();

    // --- Parse a profile item from LinkedIn's data format ---
    function parseProfileItem(item) {
        if (!item || typeof item !== 'object') return null;

        // Get name from various possible fields
        const name = item.title?.text || item.name?.text ||
            (item.firstName && item.lastName ? item.firstName + ' ' + item.lastName : '') ||
            item.firstName || '';
        if (!name) return null;

        // Build LinkedIn URL
        let linkedinUrl = '';
        if (item.navigationUrl && item.navigationUrl.includes('/in/')) {
            linkedinUrl = item.navigationUrl;
        } else if (item.publicIdentifier) {
            linkedinUrl = 'https://www.linkedin.com/in/' + item.publicIdentifier;
        } else if (item.navigationUrl && item.navigationUrl.includes('linkedin.com')) {
            linkedinUrl = item.navigationUrl;
        } else if (item.entityUrn) {
            const parts = item.entityUrn.split(':');
            const id = parts[parts.length - 1];
            if (id && id !== 'undefined' && !id.includes(',')) {
                linkedinUrl = 'https://www.linkedin.com/in/' + id;
            }
        }

        if (!linkedinUrl) return null;
        linkedinUrl = linkedinUrl.split('?')[0].replace(/\/$/, '');

        // Skip if already sent
        if (SENT_URLS.has(linkedinUrl)) return null;

        // Clean name
        const cleanName = name
            .replace(/View.*?profile/ig, '')
            .replace(/(1st|2nd|3rd\+?)/g, '')
            .split('\n')[0]
            .trim();
        if (!cleanName) return null;

        const names = cleanName.split(' ');
        const firstName = names[0] || '';
        const lastName = names.slice(1).join(' ') || '';

        // Job title
        const jobTitle = item.primarySubtitle?.text || item.headline?.text ||
            item.occupation || '';

        // Secondary info (location or company)
        const secondary = item.secondarySubtitle?.text || item.subline?.text ||
            item.locationName || '';

        let company = '';
        if (jobTitle.includes(' at ')) {
            company = jobTitle.split(' at ').slice(1).join(' at ').trim();
        } else if (secondary.includes(' at ')) {
            company = secondary.split(' at ').slice(1).join(' at ').trim();
        } else {
            company = secondary;
        }

        return { firstName, lastName, jobTitle, company, linkedinUrl };
    }

    // --- Extract leads from a parsed JSON object ---
    function extractLeadsFromData(data) {
        const leads = [];
        if (!data || typeof data !== 'object') return leads;

        // Strategy 1: Check "included" array (LinkedIn's standard format)
        if (Array.isArray(data.included)) {
            for (const item of data.included) {
                if (!item || typeof item !== 'object') continue;
                const type = item.$type || '';
                const urn = item.entityUrn || '';

                const isProfile = type.includes('Profile') || type.includes('profile') ||
                    type.includes('MiniProfile') || type.includes('SearchResult') ||
                    urn.includes('fsd_profile') || urn.includes('fs_miniProfile') ||
                    urn.includes('member');

                if (isProfile && (item.title?.text || item.name?.text || item.firstName || item.publicIdentifier)) {
                    const lead = parseProfileItem(item);
                    if (lead) leads.push(lead);
                }
            }
        }

        // Strategy 2: Check "elements" array
        if (Array.isArray(data.elements)) {
            for (const item of data.elements) {
                if (item?.title?.text) {
                    const lead = parseProfileItem(item);
                    if (lead) leads.push(lead);
                }
            }
        }

        // Strategy 3: Recurse into nested objects (max depth 4)
        function recurse(obj, depth) {
            if (!obj || typeof obj !== 'object' || depth > 4) return;
            if (Array.isArray(obj)) {
                for (const el of obj) recurse(el, depth + 1);
                return;
            }
            for (const key of Object.keys(obj)) {
                if (key === 'included' || key === 'elements') continue;
                const val = obj[key];
                if (val && typeof val === 'object') {
                    if (Array.isArray(val.included)) {
                        for (const item of val.included) {
                            if (item?.title?.text || item?.firstName || item?.publicIdentifier) {
                                const lead = parseProfileItem(item);
                                if (lead) leads.push(lead);
                            }
                        }
                    }
                    recurse(val, depth + 1);
                }
            }
        }
        recurse(data, 0);

        return leads;
    }

    // --- Deduplicate and send leads ---
    function sendLeads(leads, source) {
        const unique = [];
        for (const lead of leads) {
            if (!SENT_URLS.has(lead.linkedinUrl)) {
                SENT_URLS.add(lead.linkedinUrl);
                unique.push(lead);
            }
        }
        if (unique.length > 0) {
            console.log('AutoConnect inject.js: [' + source + '] Found', unique.length, 'leads');
            unique.forEach(l => console.log('  →', l.firstName, l.lastName, '|', l.jobTitle, '|', l.linkedinUrl));
            window.postMessage({ type: 'AUTOCONNECT_VOYAGER_DATA', leads: unique }, '*');
        }
    }

    // ==========================================
    // STRATEGY A: Extract SSR data from <code> elements (legacy LinkedIn)
    // ==========================================
    function extractFromCodeTags() {
        const codeTags = document.querySelectorAll('code');
        let totalLeads = [];

        for (const code of codeTags) {
            try {
                const text = code.textContent || code.innerText || '';
                if (!text || text.length < 100) continue;
                if (!text.includes('"included"') && !text.includes('"elements"') &&
                    !text.includes('fsd_profile') && !text.includes('fs_miniProfile')) continue;

                const data = JSON.parse(text);
                const leads = extractLeadsFromData(data);
                if (leads.length > 0) {
                    totalLeads = totalLeads.concat(leads);
                }
            } catch (e) { }
        }

        return totalLeads;
    }

    // ==========================================
    // STRATEGY B: Extract from __como_rehydration__ (new LinkedIn React RSC)
    // The rehydration data is RSC wire format, not JSON.
    // We try to extract /in/ URLs and profile info from the raw text.
    // ==========================================
    function extractFromRehydrationData() {
        const leads = [];

        try {
            const rehydrationData = window.__como_rehydration__;
            if (!rehydrationData) return leads;

            // __como_rehydration__ is an array of strings in RSC wire format
            // We scan for /in/ URLs and profile data patterns
            const rawText = Array.isArray(rehydrationData)
                ? rehydrationData.join('')
                : (typeof rehydrationData === 'string' ? rehydrationData : JSON.stringify(rehydrationData));

            // Find all /in/<username>/ patterns
            const inUrlPattern = /linkedin\.com\/in\/([a-zA-Z0-9\-]+)/g;
            let match;
            const foundUrls = new Set();
            while ((match = inUrlPattern.exec(rawText)) !== null) {
                const username = match[1];
                // Skip common non-profile URLs
                if (['ACoA', 'settings', 'privacy', 'help'].some(skip => username.startsWith(skip))) continue;
                const url = 'https://www.linkedin.com/in/' + username;
                if (!SENT_URLS.has(url)) {
                    foundUrls.add(url);
                }
            }

            // For each URL found, we'll let content.js handle the full data extraction
            // via DOM scraping. inject.js just ensures we know about these profile URLs.
            // Content.js has richer DOM context to extract names, titles, etc.

        } catch (e) {
            console.warn('AutoConnect inject.js: Error reading __como_rehydration__', e);
        }

        return leads;
    }

    // ==========================================
    // STRATEGY C: Extract profile URLs from script tags
    // ==========================================
    function extractFromScriptTags() {
        const leads = [];

        try {
            // Look for JSON-LD or embedded data in script tags
            const scripts = document.querySelectorAll('script[type="application/ld+json"], script#rehydrate-data');
            for (const script of scripts) {
                try {
                    const text = script.textContent || '';
                    if (!text || text.length < 50) continue;

                    // Try parsing as JSON
                    const data = JSON.parse(text);
                    const extracted = extractLeadsFromData(data);
                    if (extracted.length > 0) {
                        leads.push(...extracted);
                    }
                } catch (e) { }
            }
        } catch (e) { }

        return leads;
    }

    // Combined extraction function
    function extractEmbeddedData() {
        let totalLeads = [];

        // Try all strategies
        const codeLeads = extractFromCodeTags();
        const rehydrationLeads = extractFromRehydrationData();
        const scriptLeads = extractFromScriptTags();

        totalLeads = [...codeLeads, ...rehydrationLeads, ...scriptLeads];

        if (totalLeads.length > 0) {
            sendLeads(totalLeads, 'SSR-embedded');
        }

        return totalLeads.length;
    }

    // Run SSR extraction when DOM is ready
    function waitAndExtract() {
        if (document.readyState === 'complete' || document.readyState === 'interactive') {
            setTimeout(() => {
                const count = extractEmbeddedData();
                if (count === 0) {
                    setTimeout(extractEmbeddedData, 3000);
                    setTimeout(extractEmbeddedData, 6000);
                }
            }, 2000);
        } else {
            document.addEventListener('DOMContentLoaded', () => {
                setTimeout(() => {
                    const count = extractEmbeddedData();
                    if (count === 0) {
                        setTimeout(extractEmbeddedData, 3000);
                        setTimeout(extractEmbeddedData, 6000);
                    }
                }, 2000);
            });
        }
    }

    // Re-extract when URL changes (SPA navigation)
    let lastUrl = location.href;
    setInterval(() => {
        if (location.href !== lastUrl) {
            lastUrl = location.href;
            console.log('AutoConnect inject.js: URL changed, re-scanning...');
            setTimeout(extractEmbeddedData, 3000);
            setTimeout(extractEmbeddedData, 6000);
        }
    }, 1000);

    waitAndExtract();

    // ==========================================
    // STRATEGY D: Intercept XHR/fetch for pages 2+
    // This still works since LinkedIn makes API calls for navigation
    // ==========================================
    const parseResponse = (responseText, url) => {
        try {
            const data = JSON.parse(responseText);
            const leads = extractLeadsFromData(data);
            if (leads.length > 0) {
                sendLeads(leads, 'API-' + (url || '').substring(0, 80));
            }
        } catch (e) { /* not JSON */ }
    };

    // Intercept XMLHttpRequest
    const origXHROpen = XMLHttpRequest.prototype.open;
    const origXHRSend = XMLHttpRequest.prototype.send;

    XMLHttpRequest.prototype.open = function (method, url) {
        this._acUrl = url;
        origXHROpen.apply(this, arguments);
    };

    XMLHttpRequest.prototype.send = function () {
        this.addEventListener('load', function () {
            try {
                const url = this._acUrl || this.responseURL || '';
                if (url.includes('voyager/api/') || url.includes('/graphql')) {
                    parseResponse(this.responseText, url);
                }
            } catch (e) { }
        });
        origXHRSend.apply(this, arguments);
    };

    // Intercept fetch
    const origFetch = window.fetch;
    window.fetch = async function (...args) {
        const response = await origFetch.apply(this, args);
        try {
            const url = args[0] && typeof args[0] === 'string' ? args[0] : (args[0]?.url || '');
            if (url.includes('voyager/api/') || url.includes('/graphql')) {
                const clone = response.clone();
                clone.text().then(text => parseResponse(text, url)).catch(() => { });
            }
        } catch (e) { }
        return response;
    };

    console.log('AutoConnect inject.js: Voyager API interception active (single instance)');
})();
