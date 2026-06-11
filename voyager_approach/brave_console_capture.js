/**
 * Paste this entire script into Brave DevTools Console WHILE Waalaxy is open
 * AND you've clicked "Link My Account" / "Sync your LinkedIn account".
 * 
 * It patches fetch + XMLHttpRequest + WebSocket to log all calls to stargate/otto/linkedin
 * to a global window.__waalaxyLog. Then run window.__waalaxyDump() in console to print/save.
 */
(function() {
    if (window.__waalaxyPatched) {
        console.log('Already patched. Run window.__waalaxyDump() to see log.');
        return;
    }
    window.__waalaxyPatched = true;
    window.__waalaxyLog = [];
    
    const origFetch = window.fetch;
    window.fetch = async function(input, init) {
        const url = typeof input === 'string' ? input : input.url;
        const method = (init && init.method) || 'GET';
        const isRelevant = url.includes('stargate') || url.includes('otto') || 
                           url.includes('linkedin.com') || url.includes('app.waalaxy.com/api');
        if (isRelevant) {
            window.__waalaxyLog.push({ 
                kind: 'fetch', ts: Date.now(), method, url, 
                headers: init?.headers, body: init?.body?.toString()?.substring(0, 500) 
            });
            console.log('FETCH', method, url.substring(0, 120));
        }
        return origFetch.apply(this, arguments);
    };
    
    const OrigXHR = window.XMLHttpRequest;
    window.XMLHttpRequest = class extends OrigXHR {
        open(method, url) {
            this.__url = url;
            this.__method = method;
            return super.open(method, url);
        }
        send(body) {
            if (this.__url && (this.__url.includes('stargate') || this.__url.includes('otto') || 
                this.__url.includes('linkedin.com') || this.__url.includes('app.waalaxy.com/api'))) {
                window.__waalaxyLog.push({ 
                    kind: 'xhr', ts: Date.now(), method: this.__method, url: this.__url, 
                    body: body?.toString()?.substring(0, 500) 
                });
                console.log('XHR', this.__method, this.__url.substring(0, 120));
            }
            return super.send(body);
        }
    };
    
    // Capture responses by overriding response.json() too
    const origJson = Response.prototype.json;
    Response.prototype.json = async function() {
        const url = this.url;
        const isRelevant = url && (url.includes('stargate') || url.includes('otto') ||
            url.includes('linkedin.com/voyager') || url.includes('linkedin.com/oauth') ||
            url.includes('app.waalaxy.com/api'));
        const result = await origJson.call(this);
        if (isRelevant) {
            // Find matching log entry and append response
            const entry = [...window.__waalaxyLog].reverse().find(e => e.url === url && !e.response);
            if (entry) {
                entry.response = JSON.stringify(result).substring(0, 2000);
                entry.status = this.status;
            }
        }
        return result;
    };
    
    window.__waalaxyDump = function() {
        console.log('=== Waalaxy Capture ===');
        console.log(JSON.stringify(window.__waalaxyLog, null, 2));
        return window.__waalaxyLog;
    };
    
    window.__waalaxyClear = function() {
        window.__waalaxyLog = [];
        console.log('Cleared.');
    };
    
    window.__waalaxyCopy = function() {
        const text = JSON.stringify(window.__waalaxyLog, null, 2);
        navigator.clipboard.writeText(text).then(() => {
            console.log('Copied', window.__waalaxyLog.length, 'entries to clipboard.');
        });
    };
    
    console.log('✓ Patched fetch + XHR + Response. Now click "Link My Account".');
    console.log('Commands:');
    console.log('  window.__waalaxyDump()  — show log');
    console.log('  window.__waalaxyCopy()  — copy to clipboard');
    console.log('  window.__waalaxyClear() — clear log');
})();
