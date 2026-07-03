// Competitor comparison pages — /vs/[competitor]. Targets high-intent
// "qampi vs X" and "X alternative" queries. Following the competitors skill:
// be genuinely useful to an evaluator, describe rivals fairly (category-level,
// no volatile pricing claims), and position Qampi honestly on its real edge —
// deeper AI personalization, account-safety posture, and LinkedIn+email in one
// AI sequence. Rendered by app/vs/[competitor]/page.tsx.

export interface ComparisonRow {
  feature: string;
  qampi: string;
  them: string;
}

export interface CompetitorFAQ {
  question: string;
  answer: string;
}

export interface Competitor {
  slug: string; // /vs/<slug>
  name: string;
  category: string;
  metaTitle: string;
  metaDescription: string;
  h1: string;
  subhead: string;
  theirStrengths: string; // honest — what they genuinely do well
  qampiEdge: string[]; // where Qampi differs, honestly framed
  comparison: ComparisonRow[];
  bestForThem: string;
  bestForQampi: string;
  faqs: CompetitorFAQ[];
}

// Shared category-level rows reused where the positioning is the same, so we
// state Qampi's side consistently and describe each rival fairly per page.
const QAMPI = {
  personalization: 'Reads each prospect’s profile + recent posts and writes a unique message',
  channels: 'LinkedIn + cold email in one AI-written, sequence-aware cadence',
  safety: 'Dedicated proxies, human-like pacing, working-hours windows, auto limit-monitoring',
  voice: 'Learns your voice from your own writing samples',
  crm: 'Native HubSpot, Pipedrive, Notion',
};

export const competitors: Competitor[] = [
  {
    slug: 'dripify',
    name: 'Dripify',
    category: 'LinkedIn automation',
    metaTitle: 'Qampi vs Dripify — AI Personalization vs Sequences | Qampi',
    metaDescription:
      'Qampi vs Dripify compared honestly: AI that reads profiles and posts to write every message vs template-driven LinkedIn sequences. See which fits your outreach.',
    h1: 'Qampi vs Dripify',
    subhead:
      'Both automate LinkedIn outreach. The real difference is how personal the messages get — Dripify runs template sequences with variables; Qampi reads each prospect and writes the message.',
    theirStrengths:
      'Dripify is a well-established, easy-to-use LinkedIn automation tool with solid drip sequences, a clean dashboard, and team analytics. If you want straightforward template-based cadences, it does that well.',
    qampiEdge: [
      'Qampi writes each message from the prospect’s actual profile and recent posts — not merge-tag templates, so reply rates hold up as you scale.',
      'LinkedIn and cold email run in one AI sequence that never repeats an opener; most LinkedIn-first tools bolt email on separately.',
      'Safety is engineered in: dedicated per-account proxies and adaptive limits, not just fixed daily caps.',
    ],
    comparison: [
      { feature: 'Message personalization', qampi: QAMPI.personalization, them: 'Templates with {variables} / spintax' },
      { feature: 'Channels', qampi: QAMPI.channels, them: 'LinkedIn-focused; email as add-on' },
      { feature: 'Learns your writing voice', qampi: QAMPI.voice, them: 'Not a focus' },
      { feature: 'Account safety', qampi: QAMPI.safety, them: 'Cloud-based with activity limits' },
      { feature: 'CRM sync', qampi: QAMPI.crm, them: 'Integrations via export / Zapier' },
    ],
    bestForThem: 'Teams that want simple, proven template-based LinkedIn drip campaigns.',
    bestForQampi: 'Teams that want every message to read like it was hand-written, across LinkedIn and email.',
    faqs: [
      {
        question: 'Is Qampi a good Dripify alternative?',
        answer:
          'Yes — especially if template reply-rates are fading. Qampi researches each prospect and writes a genuinely personalized message rather than filling variables into a template, while still automating LinkedIn (and email) at scale and keeping your account safe.',
      },
      {
        question: 'What’s the main difference between Qampi and Dripify?',
        answer:
          'Dripify runs template-based LinkedIn sequences; Qampi uses AI to read each prospect’s profile and posts and write the message itself, and runs LinkedIn + email in one sequence-aware cadence.',
      },
      {
        question: 'Does Qampi keep my LinkedIn account safe like Dripify?',
        answer:
          'Qampi is built safety-first: dedicated per-account proxies, randomized human-like delays, working-hours sending, and automatic limit monitoring that pauses before LinkedIn’s thresholds.',
      },
    ],
  },
  {
    slug: 'expandi',
    name: 'Expandi',
    category: 'LinkedIn automation',
    metaTitle: 'Qampi vs Expandi — AI Outreach Compared | Qampi',
    metaDescription:
      'Qampi vs Expandi: cloud LinkedIn automation with smart sequences vs AI that reads each prospect and writes the message. An honest comparison for outreach teams.',
    h1: 'Qampi vs Expandi',
    subhead:
      'Expandi is a capable cloud-based LinkedIn tool with dynamic placeholders and smart sequences. Qampi goes further on the message itself — reading each prospect and writing outreach worth replying to.',
    theirStrengths:
      'Expandi is a mature, cloud-based LinkedIn automation platform known for dynamic personalization placeholders, image/GIF personalization, and robust campaign logic. It’s a strong choice for agencies running many LinkedIn campaigns.',
    qampiEdge: [
      'Qampi’s personalization is generative — it reads the prospect’s posts and experience and writes original copy, beyond placeholder substitution.',
      'One AI sequence spans LinkedIn and email with anti-repetition across steps.',
      'Qampi learns and writes in your voice from your own samples, so scaled outreach still sounds like you.',
    ],
    comparison: [
      { feature: 'Message personalization', qampi: QAMPI.personalization, them: 'Dynamic placeholders + image personalization' },
      { feature: 'Channels', qampi: QAMPI.channels, them: 'LinkedIn-first; email available' },
      { feature: 'Learns your writing voice', qampi: QAMPI.voice, them: 'Not a focus' },
      { feature: 'Account safety', qampi: QAMPI.safety, them: 'Cloud-based, dedicated IP, smart limits' },
      { feature: 'CRM sync', qampi: QAMPI.crm, them: 'Webhooks / integrations' },
    ],
    bestForThem: 'Agencies wanting advanced placeholder-based LinkedIn campaigns at volume.',
    bestForQampi: 'Teams that want AI-written, per-prospect messages across LinkedIn and email.',
    faqs: [
      {
        question: 'Is Qampi a good Expandi alternative?',
        answer:
          'Yes — if you want the message itself to be AI-written per prospect rather than assembled from placeholders. Qampi reads profiles and posts, writes original copy in your voice, and runs LinkedIn + email together.',
      },
      {
        question: 'How is Qampi’s personalization different from Expandi’s placeholders?',
        answer:
          'Placeholders swap in fields like {firstName} or {company}. Qampi reads the prospect’s recent activity and writes a genuinely specific message — the difference between "Hi {Name}" and "Hey Sarah, loved your post on…".',
      },
    ],
  },
  {
    slug: 'waalaxy',
    name: 'Waalaxy',
    category: 'LinkedIn + email outreach',
    metaTitle: 'Qampi vs Waalaxy — AI Messaging Compared | Qampi',
    metaDescription:
      'Qampi vs Waalaxy: freemium LinkedIn + email sequences vs AI that researches each prospect and writes the message. See which fits your outreach goals.',
    h1: 'Qampi vs Waalaxy',
    subhead:
      'Waalaxy is popular for accessible, freemium LinkedIn + email sequences. Qampi focuses on message quality — researching each prospect so outreach earns replies instead of blending into the inbox.',
    theirStrengths:
      'Waalaxy is beginner-friendly with a generous free tier, a browser-extension workflow, and simple LinkedIn + email sequences. It’s a fast way to get started with outreach automation.',
    qampiEdge: [
      'Qampi researches each prospect and writes the message with AI, rather than sending template steps.',
      'Sequence-aware follow-ups add new value each touch and never reuse the opener.',
      'Safety-first architecture — dedicated proxies and adaptive limits — for scaling without spooking LinkedIn.',
    ],
    comparison: [
      { feature: 'Message personalization', qampi: QAMPI.personalization, them: 'Template sequences with variables' },
      { feature: 'Channels', qampi: QAMPI.channels, them: 'LinkedIn + email sequences' },
      { feature: 'Learns your writing voice', qampi: QAMPI.voice, them: 'Not a focus' },
      { feature: 'Account safety', qampi: QAMPI.safety, them: 'Activity limits; extension-based' },
      { feature: 'CRM sync', qampi: QAMPI.crm, them: 'Integrations / export' },
    ],
    bestForThem: 'Individuals and small teams wanting an easy, low-cost way to start outreach.',
    bestForQampi: 'Teams that care most about reply rates and message quality at scale.',
    faqs: [
      {
        question: 'Is Qampi a good Waalaxy alternative?',
        answer:
          'Yes — if you’ve outgrown template sequences and want AI that writes a researched message per prospect across LinkedIn and email, with a stronger account-safety posture for scaling.',
      },
      {
        question: 'Does Qampi have a free option like Waalaxy?',
        answer:
          'Qampi Fast is free and uses an optimized model for profile-based personalization. Qampi Pro adds deep web research with the largest reasoning models. No credit card to start.',
      },
    ],
  },
  {
    slug: 'dux-soup',
    name: 'Dux-Soup',
    category: 'LinkedIn automation',
    metaTitle: 'Qampi vs Dux-Soup — AI Outreach vs Browser Automation | Qampi',
    metaDescription:
      'Qampi vs Dux-Soup: a long-standing LinkedIn browser automation tool vs AI that reads each prospect and writes the message. An honest comparison.',
    h1: 'Qampi vs Dux-Soup',
    subhead:
      'Dux-Soup is a veteran LinkedIn automation tool built around a browser extension. Qampi is AI-native — it researches each prospect and writes the outreach, across LinkedIn and email.',
    theirStrengths:
      'Dux-Soup has been around a long time, with a large user base, flexible browser-based automation, and a lower entry price. It’s familiar and battle-tested for basic LinkedIn actions.',
    qampiEdge: [
      'Qampi writes each message with AI from the prospect’s profile and posts — not scripted actions with template notes.',
      'Cloud-based, safety-engineered sending (dedicated proxies, adaptive limits) vs relying on your local browser session.',
      'LinkedIn + email in one AI cadence, with CRM sync built in.',
    ],
    comparison: [
      { feature: 'Message personalization', qampi: QAMPI.personalization, them: 'Template notes / variables' },
      { feature: 'How it runs', qampi: 'Cloud, safety-engineered sending', them: 'Browser extension on your machine' },
      { feature: 'Channels', qampi: QAMPI.channels, them: 'LinkedIn-focused' },
      { feature: 'Account safety', qampi: QAMPI.safety, them: 'Local browser; user-managed limits' },
      { feature: 'CRM sync', qampi: QAMPI.crm, them: 'Integrations / export' },
    ],
    bestForThem: 'Users wanting a low-cost, familiar browser-based LinkedIn automation tool.',
    bestForQampi: 'Teams that want AI-written, personalized outreach with hands-off, safe sending.',
    faqs: [
      {
        question: 'Is Qampi a good Dux-Soup alternative?',
        answer:
          'Yes — if you want AI-written, per-prospect messages and cloud-based safe sending instead of running a browser extension and writing your own template notes.',
      },
      {
        question: 'Does Qampi run in my browser like Dux-Soup?',
        answer:
          'Qampi sends from the cloud with dedicated per-account proxies and human-like pacing, so you don’t need to keep a browser open — and your account stays safer at scale.',
      },
    ],
  },
];

export function getCompetitor(slug: string): Competitor | undefined {
  return competitors.find((c) => c.slug === slug);
}
