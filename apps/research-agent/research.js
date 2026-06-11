// Competitive-landscape research pipeline:
//   1. Scrape the user's own website via Lightpanda -> markdown.
//   2. Synthesize {positioning, productCategory, keywords[], competitorSearchQueries[]}
//      with DeepSeek via the same Cloudflare AI Gateway the strategy agents use.
//   3. Run those queries against Yahoo (rendered via Lightpanda — works without an
//      API key) and Serper as a fallback.
//   4. Scrape each candidate competitor's homepage and synthesize a short
//      {name, url, positioning, weaknesses} per competitor.
//   5. Cache the whole result in Redis keyed on the normalized URL.
//
// Every shell call uses spawnSync(argv) — never a templated shell string — so a
// hostile lead URL can't inject extra commands.

const { spawnSync } = require('child_process');
const { URL } = require('url');

const LIGHTPANDA_PATH = process.env.LIGHTPANDA_PATH || '/usr/local/bin/lightpanda';
const LIGHTPANDA_TIMEOUT_MS = parseInt(process.env.LIGHTPANDA_TIMEOUT_MS || '45000', 10);
const SEARCH_TIMEOUT_MS = parseInt(process.env.SEARCH_TIMEOUT_MS || '60000', 10);
const MAX_COMPETITORS = parseInt(process.env.RESEARCH_MAX_COMPETITORS || '4', 10);
// Default: effectively run-once-per-website. The user's positioning + the
// competitor landscape don't shift week-to-week, and re-running burns
// Lightpanda + LLM budget for ~no signal change. An explicit refresh comes
// through the `force` flag (mapped from strategy/generate?force_regenerate).
const CACHE_TTL_SECONDS = parseInt(process.env.RESEARCH_CACHE_TTL_SECONDS || String(365 * 24 * 60 * 60), 10);
const EMAIL_FORMAT_CACHE_TTL_SECONDS = parseInt(process.env.EMAIL_FORMAT_CACHE_TTL_SECONDS || String(30 * 24 * 60 * 60), 10);

const CF_GATEWAY_URL = process.env.CLOUDFLARE_AI_GATEWAY_URL || '';
const CF_AIG_TOKEN = process.env.CF_AIG_TOKEN || '';
const CF_BYOK_ALIAS_DEEPSEEK = process.env.CF_BYOK_ALIAS_DEEPSEEK || 'qampi-deepseek-v4-flash';
const DEEPSEEK_MODEL = 'deepseek/deepseek-chat';

// ---------- Lightpanda ----------

function fetchMarkdown(url, { stripUi = true, timeoutMs } = {}) {
  const args = ['fetch', url, '--dump', 'markdown'];
  if (stripUi) args.push('--strip-mode', 'ui,js');
  const r = spawnSync(LIGHTPANDA_PATH, args, {
    encoding: 'utf8',
    timeout: timeoutMs || LIGHTPANDA_TIMEOUT_MS,
    maxBuffer: 16 * 1024 * 1024,
  });
  if (r.error) return '';
  // Lightpanda dumps result to stdout even when it logs warnings to stderr.
  return (r.stdout || '').trim();
}

// ---------- DeepSeek via CF gateway ----------

async function callDeepSeek(systemPrompt, userPrompt, { maxTokens = 600, temperature = 0.3, jsonMode = true } = {}) {
  if (!CF_GATEWAY_URL || !CF_AIG_TOKEN) {
    throw new Error('CLOUDFLARE_AI_GATEWAY_URL or CF_AIG_TOKEN not configured');
  }
  // Cloudflare AI Gateway with BYOK: base URL is the gateway, the BYOK
  // alias is a header (`cf-aig-byok-alias`), not a path segment. The model
  // name keeps the `deepseek/` prefix so the gateway knows which provider
  // to route to. Mirrors what the Python ai-service does via the OpenAI
  // SDK; the only difference is we're driving raw fetch here.
  const url = `${CF_GATEWAY_URL.replace(/\/$/, '')}/chat/completions`;
  const body = {
    model: DEEPSEEK_MODEL,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
    max_tokens: maxTokens,
    temperature,
  };
  if (jsonMode) body.response_format = { type: 'json_object' };

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${CF_AIG_TOKEN}`,
      'Content-Type': 'application/json',
      'cf-aig-byok-alias': CF_BYOK_ALIAS_DEEPSEEK,
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const t = await res.text().catch(() => '');
    throw new Error(`DeepSeek ${res.status}: ${t.slice(0, 200)}`);
  }
  const data = await res.json();
  const text = data?.choices?.[0]?.message?.content || '';
  if (!jsonMode) return text;
  try { return JSON.parse(text); }
  catch {
    // Sometimes the model wraps JSON in prose; salvage the first {...} block.
    const m = text.match(/\{[\s\S]*\}/);
    return m ? JSON.parse(m[0]) : null;
  }
}

// ---------- Yahoo search via Lightpanda ----------

function searchYahoo(query, maxResults = 8) {
  const searchUrl = `https://search.yahoo.com/search?p=${encodeURIComponent(query)}`;
  const markdown = fetchMarkdown(searchUrl, { stripUi: false, timeoutMs: 8000 });
  if (!markdown) return [];

  const results = [];
  const lines = markdown.split(/\r?\n/);
  let current = null;
  let linesSinceTitle = -1;

  for (const raw of lines) {
    const line = raw.trim();

    if (/^\d+\.$/.test(line)) {
      if (current && current.title && current.url) results.push(current);
      current = { title: '', url: '', snippet: '', source: '' };
      linesSinceTitle = -1;
      continue;
    }

    if (line.startsWith('### ') && current) {
      const heading = line.slice(4).trim();
      if (heading === '[Videos]' || heading.startsWith('People also') || heading.startsWith('Searches related')) {
        current = null;
      } else {
        current.title = heading
          .replace(/\\([-|*!()])/g, '$1')
          .replace(/\*\*/g, '')
          .trim();
        linesSinceTitle = 0;
      }
      continue;
    }

    if (current && linesSinceTitle >= 0) {
      linesSinceTitle++;
      const linkMatch = line.match(/^\[([^\]]+)\]\((https?:\/\/[^\)]+)\)$/);
      if (linkMatch) {
        current.url = linkMatch[2];
        try { current.source = new URL(current.url).hostname.replace(/^www\./, ''); } catch {}
        continue;
      }
      if (current.url && line && !line.startsWith('!') && !line.startsWith('-') && !line.startsWith('|')) {
        if (line.startsWith('##') || line.startsWith('People also') || line.startsWith('Searches related')) continue;
        const cleaned = line.replace(/\*\*/g, '').replace(/\\\*/g, '*');
        current.snippet = current.snippet ? `${current.snippet} ${cleaned}` : cleaned;
      }
    }
  }
  if (current && current.title && current.url) results.push(current);

  return results
    .filter(r => r.url && r.title && !/yahoo\.com\//i.test(r.url))
    .slice(0, maxResults);
}

// ---------- Serper fallback ----------

async function searchSerper(query, maxResults = 8) {
  const key = process.env.SERPER_API_KEY;
  if (!key) return [];
  const res = await fetch('https://google.serper.dev/search', {
    method: 'POST',
    headers: { 'X-API-KEY': key, 'Content-Type': 'application/json' },
    body: JSON.stringify({ q: query }),
  }).catch(() => null);
  if (!res || !res.ok) return [];
  const json = await res.json().catch(() => null);
  if (!json) return [];
  return (json.organic || []).slice(0, maxResults).map(r => ({
    title: r.title || '',
    url: r.link || '',
    snippet: r.snippet || '',
    source: r.source || r.domain || '',
  }));
}

async function search(query, maxResults = 8) {
  const yahoo = searchYahoo(query, maxResults);
  if (yahoo.length > 0) return yahoo;
  return searchSerper(query, maxResults);
}

// ---------- Pipeline ----------

function normalizeUrl(input) {
  let u = String(input || '').trim();
  if (!u) return '';
  if (!/^https?:\/\//i.test(u)) u = `https://${u}`;
  try {
    const parsed = new URL(u);
    return `${parsed.protocol}//${parsed.hostname.replace(/^www\./, '')}${parsed.pathname.replace(/\/$/, '')}`;
  } catch { return u; }
}

function isCompetitorCandidate(url, ownHostname) {
  try {
    const h = new URL(url).hostname.replace(/^www\./, '');
    if (!h || h === ownHostname) return false;
    // Filter obvious aggregators / non-product sites.
    if (/^(en\.)?wikipedia\.org$/.test(h)) return false;
    if (/^(www\.)?(quora|reddit|medium|substack|youtube|linkedin|twitter|x|facebook)\.com$/.test(h)) return false;
    if (/^(g2|capterra|trustpilot|crunchbase|gartner)\.com$/.test(h)) return false;
    return true;
  } catch { return false; }
}

async function analyzeOwnSite(websiteUrl) {
  const md = fetchMarkdown(websiteUrl);
  if (!md) return { positioning: '', productCategory: '', mainKeywords: [], competitorSearchQueries: [] };

  const system = 'You analyze a company website and return STRICT JSON. No prose.';
  const user = `Read this homepage and extract:
- positioning: 1-sentence elevator pitch in their voice
- productCategory: 2-4 words naming the product category (e.g. "LinkedIn outreach automation", "SOC2 compliance platform")
- mainKeywords: 3-5 short keywords competitors would also rank for
- competitorSearchQueries: 2-3 search queries that would surface direct competitors (e.g. "<productCategory> alternatives", "best <productCategory>", "<mainKeyword> tools")

Return JSON with exactly those keys. mainKeywords and competitorSearchQueries are arrays.

--- HOMEPAGE MARKDOWN (truncated) ---
${md.slice(0, 8000)}`;
  const json = await callDeepSeek(system, user, { maxTokens: 600, temperature: 0.2 });
  return {
    positioning: json?.positioning || '',
    productCategory: json?.productCategory || '',
    mainKeywords: Array.isArray(json?.mainKeywords) ? json.mainKeywords.slice(0, 5) : [],
    competitorSearchQueries: Array.isArray(json?.competitorSearchQueries) ? json.competitorSearchQueries.slice(0, 3) : [],
    rawMarkdownLength: md.length,
  };
}

async function summarizeCompetitor(url, ownPositioning) {
  const md = fetchMarkdown(url);
  if (!md) return null;
  const system = 'You analyze a competitor company website and return STRICT JSON. No prose.';
  const user = `The user company's positioning is: "${ownPositioning}"

Read this competitor homepage and extract:
- name: company name
- positioning: 1-sentence elevator pitch in their voice
- strengths: 2-3 bullets of what they emphasize
- weaknesses: 2-3 bullets of likely gaps vs the user's positioning (be specific, not generic)

Return JSON with exactly those keys. strengths and weaknesses are arrays of short strings.

--- COMPETITOR HOMEPAGE MARKDOWN (truncated) ---
${md.slice(0, 6000)}`;
  const json = await callDeepSeek(system, user, { maxTokens: 500, temperature: 0.3 });
  if (!json?.name) return null;
  return {
    name: json.name,
    url,
    positioning: json.positioning || '',
    strengths: Array.isArray(json.strengths) ? json.strengths.slice(0, 4) : [],
    weaknesses: Array.isArray(json.weaknesses) ? json.weaknesses.slice(0, 4) : [],
  };
}

async function buildCompetitiveLandscape({ website, industry, company, force = false }, redis) {
  const startedAt = Date.now();
  const normalizedUrl = normalizeUrl(website);
  if (!normalizedUrl) {
    return { error: 'website is required', generatedAt: new Date().toISOString() };
  }

  const cacheKey = `research:landscape:${normalizedUrl}`;
  if (redis && !force) {
    const cached = await redis.get(cacheKey).catch(() => null);
    if (cached) {
      try { return { ...JSON.parse(cached), fromCache: true }; } catch {}
    }
  }

  const ownHostname = (() => {
    try { return new URL(normalizedUrl).hostname.replace(/^www\./, ''); } catch { return ''; }
  })();

  // 1 + 2: own-site scrape + synthesis
  const ownSite = await analyzeOwnSite(normalizedUrl);

  // 3: search for competitor candidates
  const queries = ownSite.competitorSearchQueries.length
    ? ownSite.competitorSearchQueries
    : [
      `${ownSite.productCategory || industry || company} competitors`,
      `${ownSite.productCategory || industry || company} alternatives`,
    ].filter(Boolean);

  const candidateUrls = [];
  for (const q of queries) {
    const hits = await search(q, 8);
    for (const h of hits) {
      if (!isCompetitorCandidate(h.url, ownHostname)) continue;
      if (candidateUrls.find(c => c.url === h.url)) continue;
      candidateUrls.push({ url: h.url, title: h.title, source: h.source, snippet: h.snippet });
      if (candidateUrls.length >= MAX_COMPETITORS * 2) break;
    }
    if (candidateUrls.length >= MAX_COMPETITORS * 2) break;
  }

  // 4 + 5: scrape + summarize each (concurrent, capped)
  const summaries = await Promise.all(
    candidateUrls.slice(0, MAX_COMPETITORS).map(c =>
      summarizeCompetitor(c.url, ownSite.positioning).catch(() => null)
    )
  );
  const competitors = summaries.filter(Boolean);

  const result = {
    ownSite: {
      url: normalizedUrl,
      positioning: ownSite.positioning,
      productCategory: ownSite.productCategory,
      mainKeywords: ownSite.mainKeywords,
    },
    searchQueries: queries,
    competitors,
    stats: {
      candidatesFound: candidateUrls.length,
      competitorsSummarized: competitors.length,
      elapsedMs: Date.now() - startedAt,
    },
    generatedAt: new Date().toISOString(),
  };

  if (redis) {
    await redis.set(cacheKey, JSON.stringify(result), 'EX', CACHE_TTL_SECONDS).catch(() => {});
  }
  return result;
}

// ---------- Email format finder ----------
//
// Used as a fallback when SMTP verification can't distinguish real vs fake
// addresses (e.g. catch-all domains, security gateways like Proofpoint /
// TrendMicro / Mimecast that block probing). Pipeline:
//
//   1. Search Yahoo for the actual email format used by the company.
//   2. If a RocketReach/Hunter-style aggregator page comes back, scrape it
//      with Lightpanda and ask DeepSeek to extract the dominant pattern.
//   3. Otherwise scrape the company's own /team or /contact-us page and
//      look for visible email addresses — their format is usually a strong
//      signal of the corporate convention.
//   4. Return the patterns found (or sample emails) so the caller can plug
//      them into the name and SMTP-verify the resulting candidates.

async function searchEmailFormat({ domain, search_prompt }, redis) {
  const startedAt = Date.now();
  const cacheKey = `research:email-format:${domain}`;
  if (redis) {
    const cached = await redis.get(cacheKey).catch(() => null);
    if (cached) {
      try { return { ...JSON.parse(cached), fromCache: true }; } catch {}
    }
  }

  const ownHostname = domain.toLowerCase();

  // Strategy (in order, fastest/cheapest first):
  //  1. Scrape the company's own /team, /about, /contact, / pages. These are
  //     usually static HTML, fast on Lightpanda, and contain real employee
  //     emails directly (or "info@…" which we then ignore).
  //  2. If we still don't have ≥2 personal-name samples, fall back to a
  //     single Yahoo search. We cap the SERP-derived fetches to 4.
  // Hard cap on total Lightpanda fetches: 6 + 1 (Yahoo) = 7. This keeps
  // the request wall-time under ~30s even on slow networks.
  const SERP_HOSTS = /(^|\.)(search\.yahoo\.com|google\.[a-z.]+|bing\.com|duckduckgo\.com|search\.brave\.com|startpage\.com|yandex\.[a-z.]+|baidu\.com|sogou\.com)$/i;
  const ROLE_PREFIXES = /^(info|contact|hello|hi|support|sales|admin|office|help|customerservice|cs|press|media|marketing|noreply|no-reply|hr|careers|jobs|team|general|enquiries|enquiry|feedback|abuse|postmaster|root|webmaster)@/i;
  const PERSONAL_EMAIL_RE = /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/gi;
  const PUBLIC_PROVIDER_RE = /@(gmail|yahoo|outlook|hotmail|protonmail|icloud|aol)\./i;

  const isRelevant = (e) => {
    if (PUBLIC_PROVIDER_RE.test(e)) return false;
    if (ROLE_PREFIXES.test(e)) return false;
    return e.endsWith(`@${ownHostname}`) || e.endsWith(`.${ownHostname}`);
  };

  const sampleEmails = [];
  const MAX_SAMPLES = 8;
  const DEADLINE_MS = 25000;
  const PAGE_TIMEOUT_MS = 6000;
  const deadlineReached = () => Date.now() - startedAt > DEADLINE_MS;

  const collectFrom = (url) => {
    if (sampleEmails.length >= MAX_SAMPLES || deadlineReached()) return;
    let host = '';
    try { host = new URL(url).hostname.toLowerCase(); } catch {}
    if (SERP_HOSTS.test(host)) return;
    const md = fetchMarkdown(url, { stripUi: true, timeoutMs: PAGE_TIMEOUT_MS });
    if (!md) return;
    const found = md.match(PERSONAL_EMAIL_RE) || [];
    for (const raw of found) {
      const e = raw.toLowerCase();
      if (!isRelevant(e)) continue;
      if (sampleEmails.length < MAX_SAMPLES && !sampleEmails.includes(e)) {
        sampleEmails.push(e);
      }
    }
  };

  // ---- Step 1: own-website scrape (fast, high-signal) ----
  const ownPages = [
    `https://${domain}/team`,
    `https://${domain}/about`,
    `https://${domain}/contact`,
    `https://${domain}/contact-us`,
    `https://${domain}/team.html`,
    `https://${domain}/people`,
    `https://${domain}/leadership`,
    `https://${domain}/`,
  ];
  for (const page of ownPages) {
    if (deadlineReached()) break;
    collectFrom(page);
    if (sampleEmails.length >= 2) break; // good enough, skip web search
  }

  // ---- Step 2: web search fallback (only if own-site was barren) ----
  let webSearchUsed = false;
  if (sampleEmails.length < 2) {
    const query = search_prompt || `${domain} employee email format`;
    const hits = await search(query, 6);
    webSearchUsed = true;
    for (const hit of hits) {
      collectFrom(hit.url);
      if (sampleEmails.length >= MAX_SAMPLES) break;
    }
  }

  const totalElapsedMs = Date.now() - startedAt;

  // Detect domain provider for fallback heuristic when no samples are found.
  // Microsoft 365 / Google Workspace / Zoho / small custom — each has a
  // typical default pattern. We use Node's built-in dns.resolveMx (system
  // resolver — no extra packages needed) and inspect the MX host strings.
  let mxProvider = null;
  let mxHosts = [];
  try {
    const dns = require('dns').promises;
    const records = await dns.resolveMx(domain).catch(() => []);
    mxHosts = records.sort((a, b) => a.priority - b.priority).map((r) => r.exchange.toLowerCase());
    const joined = mxHosts.join(' ');
    if (joined.includes('outlook.com') || joined.includes('protection.outlook.com') || joined.includes('mail.protection.outlook')) mxProvider = 'microsoft365';
    else if (joined.includes('google.com') || joined.includes('googlemail.com')) mxProvider = 'google';
    else if (joined.includes('zoho.')) mxProvider = 'zoho';
    else if (joined.includes('protonmail')) mxProvider = 'proton';
    else if (joined.includes('pphosted.com')) mxProvider = 'proofpoint';
    else if (joined.includes('mimecast')) mxProvider = 'mimecast';
    else if (joined.includes('barracuda') || joined.includes('barracudanetworks')) mxProvider = 'barracuda';
    else if (joined.includes('messaging.microsoft') || joined.includes('mail.global.frontbridge')) mxProvider = 'microsoft365-legacy';
  } catch {}

  let aggregatorPatterns = [];
  if (sampleEmails.length > 0) {
    const system = 'You analyze sample email addresses and return STRICT JSON. No prose.';
    const user = `Given these sample employee emails from the same company (domain ${domain}):
${sampleEmails.map((e, i) => `${i + 1}. ${e}`).join('\n')}

Infer the corporate email pattern using placeholders:
- {{first}} = first name
- {{last}} = last name
- {{f}} = first initial
- {{l}} = last initial

Return JSON: { "patterns": ["{{first}}.{{last}}", "{{f}}{{last}}"], "format_notes": "short sentence" }
patterns should list the top 1-3 most likely formats, ordered by frequency in the samples.`;
    try {
      const parsed = await callDeepSeek(system, user, { maxTokens: 200, temperature: 0.2 });
      if (parsed && Array.isArray(parsed.patterns)) {
        aggregatorPatterns.push(...parsed.patterns.slice(0, 3));
      }
    } catch {}
  }

  // No samples found — fall back to provider-specific defaults. First.Last
  // is by far the most common Microsoft 365 / Google Workspace default; we
  // surface both it and a couple of alternates so the LLM ranker in the
  // email-finder has options. Security-gateway fronted domains
  // (Proofpoint/Mimecast) usually use simpler patterns like first@.
  let fallbackPatterns = [];
  if (aggregatorPatterns.length === 0) {
    if (mxProvider === 'microsoft365' || mxProvider === 'google' || mxProvider === 'microsoft365-legacy') {
      fallbackPatterns = ['{{first}}.{{last}}', '{{first}}{{last}}', '{{f}}{{last}}'];
    } else if (mxProvider === 'proofpoint' || mxProvider === 'mimecast' || mxProvider === 'barracuda') {
      // Security gateway in front — often simple patterns, but First.Last
      // is still the most common corporate default overall.
      fallbackPatterns = ['{{first}}.{{last}}', '{{first}}', '{{f}}{{last}}'];
    } else if (mxProvider === 'zoho' || mxProvider === 'proton') {
      fallbackPatterns = ['{{first}}.{{last}}', '{{first}}.{{l}}', '{{f}}{{last}}'];
    } else {
      // Custom / unknown — use generic top-3 industry defaults.
      fallbackPatterns = ['{{first}}.{{last}}', '{{first}}', '{{f}}{{last}}'];
    }
  }

  const result = {
    domain,
    query: search_prompt || `${domain} employee email format`,
    sampleEmails,
    patterns: aggregatorPatterns.length > 0 ? aggregatorPatterns : fallbackPatterns,
    fallbackUsed: aggregatorPatterns.length === 0,
    webSearchUsed,
    mxProvider,
    mxHosts,
    sources: [],
    stats: {
      searchHits: webSearchUsed ? 1 : 0,
      queriesTried: webSearchUsed ? 1 : 0,
      sampleEmailsFound: sampleEmails.length,
      patternsInferred: aggregatorPatterns.length,
      fallbackPatternsUsed: fallbackPatterns.length,
      elapsedMs: Date.now() - startedAt,
    },
    generatedAt: new Date().toISOString(),
  };

  if (redis) {
    await redis.set(cacheKey, JSON.stringify(result), 'EX', EMAIL_FORMAT_CACHE_TTL_SECONDS).catch(() => {});
  }
  return result;
}

module.exports = { buildCompetitiveLandscape, searchEmailFormat, normalizeUrl };
