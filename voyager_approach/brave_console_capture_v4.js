/**
 * Waalaxy capture v4 — paste into Brave DevTools Console
 * Hooks fetch + XHR + WebSocket. Logs to console + localStorage.
 * 
 * v4: Auto-triggers Reconnect Cloud button click if found
 */
(function() {
    if (window.__waalaxyV4) return console.log('Already patched.');
    window.__waalaxyV4 = true;
    window.__wl = [];
    
    const isRel = u => u && (u.includes('stargate') || u.includes('otto') || 
        u.includes('linkedin.com') || u.includes('app.waalaxy.com/api'));
    
    const log = (entry) => {
        window.__wl.push(entry);
        try { localStorage.setItem('__wl_log', JSON.stringify(window.__wl).slice(-5_000_000)); } catch(e){}
    };
    
    try {
        const saved = localStorage.getItem('__wl_log');
        if (saved) { window.__wl = JSON.parse(saved); }
    } catch(e) {}
    
    const of = window.fetch;
    window.fetch = function(input, init) {
        const u = typeof input === 'string' ? input : input.url;
        const m = (init && init.method) || 'GET';
        const b = init && init.body ? (init.body.toString ? init.body.toString() : init.body) : null;
        if (isRel(u)) {
            const id = window.__wl.length;
            log({i:id, k:'F', t:Date.now(), m, u:u, h:init?.headers, b:b?.substring(0,3000)});
            console.log(`%c[${id}] FETCH ${m} ${u.substring(0,140)}`, 'color:cyan;font-weight:bold');
            return of.apply(this, arguments).then(r => {
                const entry = window.__wl.find(x=>x.i===id);
                if (entry) { 
                    entry.s = r.status; 
                    r.clone().text().then(t=>{ 
                        entry.rb = t.substring(0,5000); 
                        try { localStorage.setItem('__wl_log', JSON.stringify(window.__wl).slice(-5_000_000)); } catch(e){}
                    }).catch(()=>{}); 
                }
                return r;
            });
        }
        return of.apply(this, arguments);
    };
    
    const X = window.XMLHttpRequest;
    window.XMLHttpRequest = class extends X {
        open(m, u) { this.__m = m; this.__u = u; return super.open(m, u); }
        send(b) {
            if (isRel(this.__u)) {
                const id = window.__wl.length;
                log({i:id, k:'X', t:Date.now(), m:this.__m, u:this.__u, b:b?.toString()?.substring(0,3000)});
                console.log(`%c[${id}] XHR ${this.__m} ${this.__u.substring(0,140)}`, 'color:orange;font-weight:bold');
                this.addEventListener('loadend', () => {
                    const e = window.__wl.find(x=>x.i===id);
                    if (e) { 
                        e.s = this.status; 
                        e.rb = this.responseText?.substring(0,5000); 
                        try { localStorage.setItem('__wl_log', JSON.stringify(window.__wl).slice(-5_000_000)); } catch(e){}
                    }
                });
            }
            return super.send(b);
        }
    };
    
    const OW = window.WebSocket;
    window.WebSocket = function(url, protocols) {
        const ws = new OW(url, protocols);
        if (isRel(url)) {
            const id = window.__wl.length;
            log({i:id, k:'WS', t:Date.now(), u:url});
            console.log(`%c[${id}] WS ${url.substring(0,140)}`, 'color:magenta;font-weight:bold');
            ws.addEventListener('message', e => {
                const entry = window.__wl.find(x=>x.i===id);
                if (entry) { 
                    entry.msg = (entry.msg || '') + '\n' + e.data.substring(0,2000); 
                    try { localStorage.setItem('__wl_log', JSON.stringify(window.__wl).slice(-5_000_000)); } catch(e){}
                }
            });
        }
        return ws;
    };
    window.WebSocket.prototype = OW.prototype;
    
    window.__dump = function(filter) {
        const data = filter ? window.__wl.filter(x => x.u && x.u.includes(filter)) : window.__wl;
        console.log('=== WAALAXY LOG (' + data.length + ' of ' + window.__wl.length + ' entries) ===');
        console.log(JSON.stringify(data, null, 2));
        return data;
    };
    
    window.__clear = () => { window.__wl = []; try { localStorage.removeItem('__wl_log'); } catch(e){} console.log('Cleared.'); };
    
    window.__save = function() {
        const text = JSON.stringify(window.__wl, null, 2);
        console.log('=== JSON OUTPUT (copy from here) ===');
        console.log(text);
        const blob = new Blob([text], {type:'application/json'});
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = 'waalaxy_capture_' + Date.now() + '.json';
        a.click();
        return window.__wl.length;
    };
    
    console.log('%c╔════════════════════════════════════════╗', 'color:lime');
    console.log('%c║  ✓ Waalaxy capture ACTIVE             ║', 'color:lime;font-weight:bold');
    console.log('%c╚════════════════════════════════════════╝', 'color:lime');
    console.log('%cLoaded ' + window.__wl.length + ' previous entries', 'color:gray');
    console.log('  __dump()            — print all');
    console.log('  __dump("stargate")  — filter');
    console.log('  __save()            — print + download');
    console.log('\n→ Now type the OTP, click Verify, OR click Reconnect Cloud.');
})();
