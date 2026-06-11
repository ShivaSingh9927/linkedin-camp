const { spawn, execSync } = require('child_process');
const http = require('http');
const https = require('https');
require('dotenv').config();

const LIGHTPANDA_PATH = '/home/shiva/lightpanda/lightpanda';
const PROXY_PORT = 9876;
const PROXY_HOST = '127.0.0.1';

// --- Proxy management ---

let proxyProcess = null;

function startProxy() {
  return new Promise((resolve) => {
    proxyProcess = spawn('node', ['/home/shiva/Documents/linkedin-camp/proxy-server.js', String(PROXY_PORT)], {
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    proxyProcess.stdout.on('data', (d) => {
      if (d.toString().includes('listening')) resolve();
    });
    proxyProcess.stderr.on('data', () => {});
    setTimeout(resolve, 2000); // fallback timeout
  });
}

function stopProxy() {
  if (proxyProcess) { proxyProcess.kill(); proxyProcess = null; }
}

// --- Generic request through proxy ---

async function requestViaProxy(method, hostname, path, headers = {}, body = null, timeoutMs = 15000) {
  return new Promise((resolve) => {
    const opts = {
      hostname: PROXY_HOST,
      port: PROXY_PORT,
      method: 'CONNECT',
      path: hostname + ':443',
      timeout: timeoutMs,
    };
    const req = http.request(opts);
    req.on('connect', (res, socket) => {
      const client = https.request({ hostname, socket, path, method, headers }, (response) => {
        let data = '';
        response.on('data', chunk => data += chunk);
        response.on('end', () => resolve({ status: response.statusCode, data }));
      });
      client.on('error', (e) => resolve({ error: e.message }));
      client.setTimeout(timeoutMs, () => { client.destroy(); resolve({ error: 'timeout' }); });
      if (body) client.write(body);
      client.end();
    });
    req.on('error', (e) => resolve({ error: e.message }));
    req.on('timeout', () => { req.destroy(); resolve({ error: 'timeout' }); });
    req.end();
  });
}

// --- Search: Serper API ---

async function searchSerper(query, maxResults = 8) {
  const apiKey = process.env.SERPER_API_KEY;
  if (!apiKey) return [];

  const body = JSON.stringify({ q: query });
  const result = await requestViaProxy('POST', 'google.serper.dev', '/search',
    { 'Content-Type': 'application/json', 'X-API-KEY': apiKey, 'Content-Length': body.length },
    body
  );

  if (result.error || !result.data) return [];
  try {
    const json = JSON.parse(result.data);
    return (json.organic || []).slice(0, maxResults).map(r => ({
      title: r.title || '',
      url: r.link || '',
      snippet: r.snippet || '',
      source: r.source || r.domain || '',
    }));
  } catch { return []; }
}

// --- Search: DuckDuckGo HTML fallback ---

async function searchDuckDuckGo(query, maxResults = 8) {
  const result = await requestViaProxy('GET', 'html.duckduckgo.com', '/html/?q=' + encodeURIComponent(query),
    { 'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36' }
  );
  if (result.error || !result.data) return [];

  // Parse DDG HTML results
  const results = [];
  const regex = /<h2 class="result__title">\s*<a[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/g;
  let match;
  while ((match = regex.exec(result.data)) !== null && results.length < maxResults) {
    const url = match[1].replace(/\/\/duckduckgo\.com\/l\/\?uddg=/, ''); // decode redirected URL
    const title = match[2].replace(/<[^>]+>/g, '').trim();
    results.push({ title, url: decodeURIComponent(url), snippet: '', source: '' });
  }
  return results;
}

// --- Search: Yahoo via Lightpanda (Completely Free) ---

async function searchYahoo(query, maxResults = 8) {
  try {
    const searchUrl = `https://search.yahoo.com/search?p=${encodeURIComponent(query)}`;
    // Run lightpanda to dump search results markdown, using proxy for custom DNS
    const cmd = `${LIGHTPANDA_PATH} fetch "${searchUrl}" --dump markdown 2>/dev/null`;
    const markdown = execSync(cmd, { encoding: 'utf8', timeout: 30000 });
    
    const results = [];
    const searchResultsStart = markdown.indexOf('## Search Results');
    const mainContent = searchResultsStart !== -1 ? markdown.substring(searchResultsStart) : markdown;
    const lines = mainContent.split(/\r?\n/);
    
    let currentResult = null;
    let linesSinceTitle = -1;
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      
      if (/^\d+\.$/.test(line)) {
        if (currentResult && currentResult.title && currentResult.url) {
          results.push(currentResult);
        }
        currentResult = { title: '', url: '', snippet: '', source: '' };
        linesSinceTitle = -1;
        continue;
      }
      
      if (line.startsWith('### ') && currentResult) {
        const headingText = line.substring(4).trim();
        if (headingText !== '[Videos]' && !headingText.startsWith('People also search') && !headingText.startsWith('Searches related to')) {
          currentResult.title = headingText
            .replace(/\\-/g, '-')
            .replace(/\\\|/g, '|')
            .replace(/\\\*/g, '*')
            .replace(/\\\!/g, '!')
            .replace(/\\\(/g, '(')
            .replace(/\\\)/g, ')')
            .replace(/\*\*/g, '')
            .trim();
          linesSinceTitle = 0;
        } else {
          currentResult = null;
        }
        continue;
      }
      
      if (currentResult && linesSinceTitle >= 0) {
        linesSinceTitle++;
        
        const linkMatch = line.match(/^\[([^\]]+)\]\((https?:\/\/[^\)]+)\)$/);
        if (linkMatch) {
          currentResult.url = linkMatch[2];
          try {
            const u = new URL(currentResult.url);
            currentResult.source = u.hostname.replace('www.', '');
          } catch {
            currentResult.source = '';
          }
          continue;
        }
        
        if (currentResult.url && line && !line.startsWith('!') && !line.startsWith('-') && !line.startsWith('|')) {
          if (line.startsWith('##') || line.startsWith('People also') || line.startsWith('Searches related')) {
            continue;
          }
          const cleanedLine = line.replace(/\*\*/g, '').replace(/\\\*/g, '*');
          if (currentResult.snippet) {
            currentResult.snippet += ' ' + cleanedLine;
          } else {
            currentResult.snippet = cleanedLine;
          }
        }
      }
    }
    
    if (currentResult && currentResult.title && currentResult.url) {
      results.push(currentResult);
    }
    
    const filtered = results.filter(r => r.url && r.title && !r.url.includes('yahoo.com/'));
    return filtered.slice(0, maxResults);
  } catch (e) {
    console.error('Yahoo Search error:', e.message);
    return [];
  }
}

// --- Fetch page content via Lightpanda ---

async function fetchPageContent(url) {
  try {
    // Run lightpanda using proxy for custom DNS
    const cmd = `${LIGHTPANDA_PATH} fetch "${url}" --dump markdown --strip-mode ui,js 2>/dev/null`;
    const content = execSync(cmd, { encoding: 'utf8', timeout: 60000 });
    let cleaned = content.trim().substring(0, 6000);
    cleaned = cleaned.replace(/\[Jump to content\].*?(?=\n#)/s, '')
                     .replace(/\[edit\].*?(?=\n)/g, '')
                     .replace(/\n{3,}/g, '\n\n');
    return cleaned;
  } catch (e) {
    if (e.stdout) return e.stdout.toString().trim().substring(0, 6000);
    return '';
  }
}

// --- LLM: Groq ---

async function askLLM(query, context) {
  const apiKey = process.env.GROQ_API;
  if (!apiKey) return 'GROQ_API key not configured';

  const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'llama-3.3-70b-versatile',
      messages: [
        { role: 'system', content: 'You are a helpful web search assistant. Answer the user\'s question based STRICTLY on the provided search results. Be concise, accurate, and cite sources with [1], [2], etc.' },
        { role: 'user', content: `Question: ${query}\n\nSearch Results:\n${context}\n\nAnswer the question using ONLY the information above.` },
      ],
      max_tokens: 1000,
      temperature: 0.3,
    }),
  });
  const data = await response.json();
  return data.choices?.[0]?.message?.content || 'No response';
}

// --- Main ---

function isUrlOrDomain(str) {
  const trimmed = str.trim();
  if (/^https?:\/\//i.test(trimmed)) return true;
  // Matches domain names like name.tld or name.sub.tld with optional paths/queries
  const domainRegex = /^[a-zA-Z0-9][-a-zA-Z0-9]{0,62}\.[a-zA-Z]{2,24}(?:\/[-a-zA-Z0-9()@:%_\+.~#?&//=]*)?$/;
  return domainRegex.test(trimmed);
}

async function run(query) {
  console.log(`\n\x1b[36m\x1b[1m🔍 Query:\x1b[0m ${query}\n`);

  // Start proxy
  console.log('\x1b[33m0. Starting DNS proxy (8.8.8.8)...\x1b[0m');
  await startProxy();
  console.log('   Proxy ready\n');

  let results = [];
  let directResult = null;

  // Check if query is a direct URL or domain
  if (isUrlOrDomain(query)) {
    let targetUrl = query.trim();
    if (!/^https?:\/\//i.test(targetUrl)) {
      targetUrl = 'https://' + targetUrl;
    }
    console.log(`\x1b[33m1. Direct site query detected. Fetching ${targetUrl} directly...\x1b[0m`);
    let directContent = await fetchPageContent(targetUrl);
    
    // HTTP fallback if HTTPS fails
    if (!directContent && targetUrl.startsWith('https://')) {
      const httpUrl = targetUrl.replace(/^https:\/\//i, 'http://');
      console.log(`   HTTPS failed. Trying HTTP fallback: ${httpUrl}...`);
      directContent = await fetchPageContent(httpUrl);
      if (directContent) {
        targetUrl = httpUrl;
      }
    }

    if (directContent) {
      const snippet = directContent.trim().substring(0, 250).replace(/\s+/g, ' ') + '...';
      let hostname = '';
      try { hostname = new URL(targetUrl).hostname.replace('www.', ''); } catch { hostname = targetUrl; }
      directResult = {
        title: `${hostname} (Direct Content)`,
        url: targetUrl,
        snippet: snippet,
        source: hostname,
        directContent: directContent
      };
      results.push(directResult);
      console.log(`   ✓ Successfully fetched direct page content from ${targetUrl}\n`);
    } else {
      console.log(`   Could not fetch direct content from ${targetUrl}. Falling back to standard search...\n`);
    }
  }

  // Perform search to get surrounding context/results
  if (!directResult) {
    console.log('\x1b[33m1. Searching...\x1b[0m');
  } else {
    console.log('\x1b[33m1. Fetching supplementary search results for context...\x1b[0m');
  }

  let searchResults = await searchYahoo(query);
  console.log(`   Yahoo Search (Free via Lightpanda): ${searchResults.length} results`);
  if (searchResults.length === 0) {
    searchResults = await searchSerper(query);
    console.log(`   Serper (backup): ${searchResults.length} results`);
  }
  if (searchResults.length === 0) {
    searchResults = await searchDuckDuckGo(query);
    console.log(`   DuckDuckGo (backup): ${searchResults.length} results`);
  }

  // Merge search results into results array, avoiding duplicate URLs
  for (const r of searchResults) {
    if (!results.some(existing => existing.url.toLowerCase() === r.url.toLowerCase())) {
      results.push(r);
    }
  }

  if (results.length === 0) {
    console.log('   No results found.');
    stopProxy();
    return;
  }

  console.log('');

  // Build initial search result index overview context
  let context = results.map((r, i) =>
    `[${i + 1}] ${r.title}\n   URL: ${r.url}\n   Snippet: ${r.snippet}`
  ).join('\n\n');

  // Fetch top 2 pages full text (caching direct result so we don't fetch it again)
  console.log('\x1b[33m2. Fetching page content...\x1b[0m');
  context += '\n\n--- Full page content ---\n';
  for (let i = 0; i < Math.min(results.length, 2); i++) {
    const r = results[i];
    process.stdout.write(`  ${r.title.substring(0, 50).padEnd(52)} `);
    let content = r.directContent;
    if (content === undefined) {
      content = await fetchPageContent(r.url);
    }
    if (content) {
      context += `\n\n[Source ${i + 1}: ${r.title} (${r.url})]\n${content.substring(0, 3000)}`;
      console.log('\x1b[32m✓\x1b[0m');
    } else {
      console.log('\x1b[33m-\x1b[0m');
    }
  }

  // Ask LLM
  console.log('\n\x1b[33m3. Analyzing with Llama 3.3 70B...\x1b[0m\n');
  const answer = await askLLM(query, context);

  console.log('\x1b[36m\x1b[1m📝 Answer:\x1b[0m');
  console.log(answer + '\n');

  console.log('\x1b[36m📚 Sources:\x1b[0m');
  results.forEach((r, i) => {
    console.log(`  ${i + 1}. ${r.title}\n     ${r.url}`);
  });
  console.log('');

  stopProxy();
}

(async () => {
  const query = process.argv.slice(2).join(' ');
  if (!query) { console.log('Usage: node web-search-agent.js "your query"'); process.exit(1); }
  try {
    await run(query);
  } catch (e) { console.error('\x1b[31mError:\x1b[0m', e.message); stopProxy(); }
})();