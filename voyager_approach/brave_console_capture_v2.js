/**
 * Waalaxy capture — paste into Brave DevTools Console
 * 1. Patches fetch + XHR + Response
 * 2. Logs to console AND to a global array
 * 3. Auto-saves to localStorage every 5s
 * 4. Use window.__dump() to print all logs
 */
(function() {
    if (window.__waalaxyPatchV2) return console.log('Already patched. Run __dump()');
    window.__waalaxyPatchV2 = true;
    window.__wl = [];
    
    const isRel = u => u && (u.includes('stargate') || u.includes('otto') || 
        u.includes('linkedin.com') || u.includes('app.waalaxy.com/api'));
    
    // fetch
    const of = window.fetch;
    window.fetch = function(input, init) {
        const u = typeof input === 'string' ? input : input.url;
        const m = (init && init.method) || 'GET';
        const b = init && init.body ? (init.body.toString ? init.body.toString() : init.body) : null;
        if (isRel(u)) {
            const id = window.__wl.length;
            window.__wl.push({i:id, k:'F', t:Date.now(), m, u:u.substring(0,200), h:init?.headers, b:b?.substring(0,1000)});
            console.log(`%c[${id}] FETCH ${m}`, 'color:cyan', u);
            return of.apply(this, arguments).then(r => {
                const entry = window.__wl.find(x=>x.i===id);
                if (entry) { entry.s = r.status; r.clone().text().then(t=>{entry.rb=t.substring(0,2000); trySave();}).catch(()=>{}); }
                return r;
            });
        }
        return of.apply(this, arguments);
    };
    
    // XHR
    const X = window.XMLHttpRequest;
    window.XMLHttpRequest = class extends X {
        open(m, u) { this.__m = m; this.__u = u; return super.open(m, u); }
        send(b) {
            if (isRel(this.__u)) {
                const id = window.__wl.length;
                window.__wl.push({i:id, k:'X', t:Date.now(), m:this.__m, u:this.__u.substring(0,200), b:b?.toString()?.substring(0,1000)});
                console.log(`%c[${id}] XHR ${this.__m}`, 'color:orange', this.__u);
                this.addEventListener('loadend', () => {
                    const e = window.__wl.find(x=>x.i===id);
                    if (e) { e.s = this.status; e.rb = this.responseText?.substring(0,2000); trySave(); }
                });
            }
            return super.send(b);
        }
    };
    
    // WebSocket
    const OW = window.WebSocket;
    window.WebSocket = function(url, protocols) {
        const ws = new OW(url, protocols);
        if (isRel(url)) {
            const id = window.__wl.length;
            window.__wl.push({i:id, k:'WS', t:Date.now(), u:url});
            console.log(`%c[${id}] WS OPEN`, 'color:magenta', url);
            ws.addEventListener('message', e => {
                const entry = window.__wl.find(x=>x.i===id);
                if (entry) { entry.msg = (entry.msg || '') + e.data.substring(0,500); trySave(); }
            });
        }
        return ws;
    };
    window.WebSocket.prototype = OW.prototype;
    
    function trySave() {
        try { localStorage.setItem('__wl_log', JSON.stringify(window.__wl).substring(0, 5_000_000)); } catch(e){}
    }
    setInterval(trySave, 3000);
    
    // Load any existing log
    try {
        const saved = localStorage.getItem('__wl_log');
        if (saved) {
            const arr = JSON.parse(saved);
            window.__wl = arr;
            console.log('Loaded', arr.length, 'previous entries');
        }
    } catch(e) {}
    
    window.__dump = function(filter) {
        const data = filter ? window.__wl.filter(x => x.u && x.u.includes(filter)) : window.__wl;
        console.log('=== WAALAXY LOG (' + data.length + ' of ' + window.__wl.length + ' entries) ===');
        console.log(JSON.stringify(data, null, 2));
        return data;
    };
    
    window.__clear = () => { window.__wl = []; trySave(); console.log('Cleared'); };
    
    window.__save = function() {
        const text = JSON.stringify(window.__wl, null, 2);
        const blob = new Blob([text], {type:'application/json'});
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = 'waalaxy_capture_' + Date.now() + '.json';
        a.click();
        return window.__wl.length;
    };
    
    console.log('%c✓ Waalaxy capture ready', 'color:lime;font-weight:bold');
    console.log('  window.__dump()    — print all logs');
    console.log('  window.__dump("stargate") — filter by URL keyword');
    console.log('  window.__save()    — download as JSON file');
    console.log('  window.__clear()   — clear logs');
    console.log('Now click "Link My Account" in the modal.');
})();
