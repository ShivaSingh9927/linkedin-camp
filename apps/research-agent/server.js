const express = require('express');
const Redis = require('ioredis');
const { buildCompetitiveLandscape, searchEmailFormat } = require('./research');

const PORT = parseInt(process.env.PORT || '3010', 10);
const REDIS_URL = process.env.REDIS_URL || '';

const redis = REDIS_URL
  ? new Redis(REDIS_URL, { maxRetriesPerRequest: 1, enableOfflineQueue: false, lazyConnect: true })
  : null;
if (redis) {
  redis.connect().catch(err => console.error(`[RESEARCH-AGENT] redis connect failed: ${err.message}`));
  redis.on('error', err => console.error(`[RESEARCH-AGENT] redis error: ${err.message}`));
}

const app = express();
app.use(express.json({ limit: '2mb' }));

app.use((req, _res, next) => {
  if (req.path !== '/health') console.log(`[RESEARCH-AGENT] ${req.method} ${req.path}`);
  next();
});

app.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    service: 'qampi-research-agent',
    cf_gateway: !!process.env.CLOUDFLARE_AI_GATEWAY_URL,
    redis: redis ? redis.status : 'not configured',
  });
});

app.post('/research/competitive-landscape', async (req, res) => {
  const { website, industry, company, force } = req.body || {};
  if (!website) return res.status(400).json({ error: 'website is required' });

  // Bound the whole pipeline so a stuck Lightpanda or LLM call can't pin the
  // request forever. Strategy gen on the caller side already has its own
  // timeout; we just want a clean failure mode.
  const HARD_DEADLINE_MS = parseInt(process.env.RESEARCH_HARD_DEADLINE_MS || '120000', 10);
  let timer;
  const deadline = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error(`research pipeline exceeded ${HARD_DEADLINE_MS}ms`)), HARD_DEADLINE_MS);
  });

  try {
    const result = await Promise.race([
      buildCompetitiveLandscape({ website, industry, company, force: !!force }, redis),
      deadline,
    ]);
    res.json(result);
  } catch (err) {
    console.error(`[RESEARCH-AGENT] competitive-landscape failed: ${err.message}`);
    res.status(500).json({ error: err.message });
  } finally {
    clearTimeout(timer);
  }
});

app.post('/research/email-format', async (req, res) => {
  const { domain, search_prompt } = req.body || {};
  if (!domain) return res.status(400).json({ error: 'domain is required' });

  const HARD_DEADLINE_MS = parseInt(process.env.RESEARCH_HARD_DEADLINE_MS || '120000', 10);
  let timer;
  const deadline = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error(`email-format research exceeded ${HARD_DEADLINE_MS}ms`)), HARD_DEADLINE_MS);
  });

  try {
    const result = await Promise.race([
      searchEmailFormat({ domain, search_prompt: search_prompt || '' }, redis),
      deadline,
    ]);
    res.json(result);
  } catch (err) {
    console.error(`[RESEARCH-AGENT] email-format failed: ${err.message}`);
    res.status(500).json({ error: err.message });
  } finally {
    clearTimeout(timer);
  }
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`[RESEARCH-AGENT] listening on :${PORT} (cf=${!!process.env.CLOUDFLARE_AI_GATEWAY_URL}, redis=${redis ? 'wired' : 'none'})`);
});
