/**
 * Voyager API Client — Pure Node.js HTTP client for LinkedIn's internal Voyager API.
 * Modelled after the Python linkedin-api library (nsandman/tomquirk).
 */

const https = require('https');
const http = require('http');
const querystring = require('querystring');
const fs = require('fs');
const path = require('path');

const COOKIES_PATH = path.join(__dirname, 'cookies.json');
const API_HOST = 'www.linkedin.com';
const API_BASE = '/voyager/api';

const DEFAULT_HEADERS = {
    'accept': 'application/vnd.linkedin.normalized+json+2.1',
    'accept-language': 'en-US,en;q=0.9',
    'x-li-lang': 'en_US',
    'x-restli-protocol-version': '2.0.0',
    'user-agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36',
};

function loadCookies() {
    if (!fs.existsSync(COOKIES_PATH)) {
        throw new Error(`Cookies file not found: ${COOKIES_PATH}`);
    }
    return JSON.parse(fs.readFileSync(COOKIES_PATH, 'utf8'));
}

function buildCookieString(cookies) {
    return cookies
        .filter(c => c.domain && c.domain.includes('linkedin'))
        .map(c => c.name + '=' + c.value)
        .join('; ');
}

function extractCsrf(cookies) {
    const jsId = cookies.find(c => c.name === 'JSESSIONID');
    if (!jsId) throw new Error('JSESSIONID cookie not found');
    return jsId.value.replace(/"/g, '');
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function randomDelay() {
    const ms = Math.floor(Math.random() * 3000) + 2000;
    return sleep(ms);
}

function buildUrl(path, params) {
    const fullPath = API_BASE + path;
    if (params && Object.keys(params).length > 0) {
        return fullPath + '?' + querystring.stringify(params);
    }
    return fullPath;
}

function request(method, path, body, extraHeaders, proxyUrl) {
    return new Promise((resolve, reject) => {
        const cookies = loadCookies();
        const cookieStr = buildCookieString(cookies);
        const csrf = extractCsrf(cookies);

        const headers = {
            ...DEFAULT_HEADERS,
            'csrf-token': csrf,
            'cookie': cookieStr,
            'Content-Type': 'application/json',
            ...(extraHeaders || {}),
        };

        const url = buildUrl(path, body && method === 'GET' ? body : undefined);
        const postData = method !== 'GET' && body ? JSON.stringify(body) : null;

        if (postData) {
            headers['Content-Length'] = Buffer.byteLength(postData);
        }

        const options = {
            hostname: API_HOST,
            path: url,
            method: method,
            headers: headers,
        };

        let transport;
        if (proxyUrl) {
            const url = new URL(proxyUrl);
            const agentModule = url.protocol === 'https:' ? require('https') : require('http');
            if (url.protocol.startsWith('socks')) {
                const { SocksProxyAgent } = require('socks-proxy-agent');
                const agent = new SocksProxyAgent(proxyUrl);
                options.agent = agent;
                transport = agentModule;
            } else if (url.protocol.startsWith('http')) {
                const { HttpsProxyAgent } = require('https-proxy-agent');
                options.agent = new HttpsProxyAgent(proxyUrl);
                transport = agentModule;
            }
        }
        if (!transport) transport = https;

        const req = transport.request(options, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                let parsed = data;
                try { parsed = JSON.parse(data); } catch (e) {}
                resolve({ status: res.statusCode, headers: res.headers, data: parsed });
            });
        });

        req.on('error', reject);
        req.setTimeout(30000, () => { req.destroy(); reject(new Error('Request timeout')); });

        if (postData) req.write(postData);
        req.end();
    });
}

async function voyagerGet(path, params, extraHeaders, proxyUrl) {
    await randomDelay();
    console.log(`  GET ${path}${params ? '?' + querystring.stringify(params) : ''}`);
    return request('GET', path, params, extraHeaders, proxyUrl);
}

async function voyagerPost(path, body, params, extraHeaders, proxyUrl) {
    await randomDelay();
    console.log(`  POST ${path}${params ? '?' + querystring.stringify(params) : ''}`);
    let fullPath = path;
    if (params && Object.keys(params).length > 0) {
        fullPath = path + '?' + querystring.stringify(params);
    }
    return request('POST', fullPath, body, extraHeaders, proxyUrl);
}

function logResult(label, result) {
    const body = typeof result.data === 'string'
        ? result.data.substring(0, 200)
        : JSON.stringify(result.data).substring(0, 400);
    console.log(`  ${label} → ${result.status}`);
    if (result.status < 400) {
        console.log(`  Response: ${body}`);
    } else {
        console.log(`  ❌ Body: ${body}`);
    }
}

module.exports = { voyagerGet, voyagerPost, logResult, loadCookies, buildCookieString, extractCsrf, COOKIES_PATH };
