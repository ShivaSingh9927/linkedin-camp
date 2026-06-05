"use client";

import React, { useRef } from "react";
import { motion, useScroll, useTransform } from "framer-motion";

/* ═══════════════════════════════════════════════════════════
   MESSY SCRIBBLE — Organic overlapping loops behind the header
   Like tangled threads representing chaotic cold outreach
   ═══════════════════════════════════════════════════════════ */
const MessyScribble = () => {
  /* Large open petal loops — like the reference green lines.
     Spread across the right side of the text, big and airy. */
  const loops = [
    // Big sweeping petal — upper right, goes off-edge
    "M500,250 C600,50 900,50 880,300 C860,550 600,500 500,350 C400,200 420,150 500,250",
    // Tall petal — top, reaching upward
    "M550,300 C580,80 750,20 780,200 C810,380 650,480 550,380 C450,280 500,180 550,300",
    // Wide right petal — extends far right
    "M480,320 C620,200 920,250 880,420 C840,590 580,550 480,420 C380,290 400,250 480,320",
    // Lower-right petal
    "M520,380 C620,280 820,320 790,480 C760,640 560,600 520,470 C480,340 490,310 520,380",
    // Small inner loop — center accent
    "M560,300 C610,200 730,220 710,330 C690,440 590,450 560,360 C530,270 540,230 560,300",
    // Upper-left sweep — balances composition
    "M420,200 C460,60 650,80 640,230 C630,380 470,390 420,280 C370,170 380,120 420,200",
    // Bottom curl — grounds the cluster
    "M500,420 C560,340 700,360 680,460 C660,560 530,560 500,480 C470,400 480,370 500,420",
    // Tail connecting seamlessly to the scroll line
    "M500,420 C520,470 750,550 750,700",
  ];

  return (
    <svg viewBox="0 0 1000 700" className="w-full h-full" fill="none" preserveAspectRatio="none">
      {loops.map((d, i) => (
        <React.Fragment key={i}>
          {/* Soft glow layer */}
          <path
            d={d}
            stroke="#8b5cf6"
            strokeWidth={36}
            strokeLinecap="round"
            fill="none"
            opacity={0.07}
          />
          {/* Main visible stroke */}
          <path
            d={d}
            stroke="#8b5cf6"
            strokeWidth={12}
            strokeLinecap="round"
            fill="none"
            opacity={0.28}
          />
        </React.Fragment>
      ))}
    </svg>
  );
};

/* ═══════════════════════════════════════════════════════════
   FLOWING SCROLL LINE — Single line that traces through 4 steps
   Starts from the scribble cluster, flows down in organic S-curves
   ═══════════════════════════════════════════════════════════ */
const FlowingScrollLine = ({ scrollYProgress }: { scrollYProgress: any }) => {
  const pathLength = useTransform(scrollYProgress, [0.05, 0.92], [0, 1]);

  /* This path starts near the scribble (top-right area) and meanders
     down in wide organic S-curves, passing through where each step sits */
  const flowPath =
    "M750,0 " +
    "C750,150 650,160 600,280 " +     // smooth continuation from the tail, then curve left
    "C540,420 700,500 680,650 " +     // curve toward step 1
    "C660,800 350,850 320,1000 " +    // S-curve to step 2 (left)
    "C290,1150 600,1200 620,1350 " +  // swing back right to step 3
    "C640,1500 300,1550 280,1700 " +  // S-curve to step 4 (left)
    "C260,1850 550,1900 500,2050 " +  // flowing exit
    "C450,2200 600,2350 550,2500 " +  // gentle fade out
    "C500,2650 650,2750 600,2900 " +
    "C550,3050 400,3100 450,3250 " +
    "C500,3400 600,3500 550,3600";

  return (
    <svg
      viewBox="0 0 1000 3600"
      fill="none"
      className="w-full h-full"
      preserveAspectRatio="none"
    >
      {/* Soft wide glow behind the line */}
      <motion.path
        d={flowPath}
        stroke="url(#purpleGlow)"
        strokeWidth="28"
        strokeLinecap="round"
        fill="none"
        opacity="0.08"
        style={{ pathLength }}
      />
      {/* Medium glow */}
      <motion.path
        d={flowPath}
        stroke="url(#purpleGrad)"
        strokeWidth="10"
        strokeLinecap="round"
        fill="none"
        opacity="0.15"
        style={{ pathLength }}
      />
      {/* Main crisp line */}
      <motion.path
        d={flowPath}
        stroke="url(#purpleGrad)"
        strokeWidth="3.5"
        strokeLinecap="round"
        fill="none"
        opacity="0.6"
        style={{ pathLength }}
      />
      {/* Bright center highlight */}
      <motion.path
        d={flowPath}
        stroke="#c4b5fd"
        strokeWidth="1.5"
        strokeLinecap="round"
        fill="none"
        opacity="0.4"
        style={{ pathLength }}
      />
      <defs>
        <linearGradient id="purpleGrad" x1="500" y1="0" x2="500" y2="3600" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#8b5cf6" />
          <stop offset="30%" stopColor="#a855f7" />
          <stop offset="60%" stopColor="#7c3aed" />
          <stop offset="100%" stopColor="#6366f1" />
        </linearGradient>
        <linearGradient id="purpleGlow" x1="500" y1="0" x2="500" y2="3600" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#a78bfa" />
          <stop offset="50%" stopColor="#8b5cf6" />
          <stop offset="100%" stopColor="#7c3aed" />
        </linearGradient>
      </defs>
    </svg>
  );
};


/* ═══════════════════════════════════════════════════════════
   WINDOW CHROME — Reusable browser frame for all mockups
   ═══════════════════════════════════════════════════════════ */
const WindowChrome = ({ url, children }: { url: string; children: React.ReactNode }) => (
  <div className="bg-white rounded-2xl border border-slate-200/60 shadow-[0_8px_40px_-12px_rgba(0,0,0,0.12)] overflow-hidden">
    <div className="flex items-center gap-2 bg-slate-50/80 px-4 py-2.5 border-b border-slate-200/40">
      <div className="flex gap-1.5">
        <span className="w-[9px] h-[9px] rounded-full bg-[#FF5F57]" />
        <span className="w-[9px] h-[9px] rounded-full bg-[#FEBC2E]" />
        <span className="w-[9px] h-[9px] rounded-full bg-[#28C840]" />
      </div>
      <div className="flex-1 mx-6">
        <div className="bg-white/80 rounded-md px-3 py-1 text-[11px] text-slate-400 text-center border border-slate-200/40 max-w-[220px] mx-auto font-mono">
          {url}
        </div>
      </div>
    </div>
    {children}
  </div>
);

/* ═══════════════════════════════════════════════════════════
   MOCKUP 1 — Prospect Discovery
   ═══════════════════════════════════════════════════════════ */
const ProspectMockup = () => {
  const prospects = [
    { initials: "SJ", name: "Sarah Jenkins", role: "VP of Sales", company: "Acme Corp", gradient: "from-blue-400 to-indigo-500" },
    { initials: "MC", name: "Michael Chen", role: "Head of Growth", company: "TechFlow", gradient: "from-emerald-400 to-teal-500" },
    { initials: "JR", name: "Jessica R.", role: "Dir. of Marketing", company: "InnovateCo", gradient: "from-violet-400 to-purple-500" },
    { initials: "DK", name: "David Kim", role: "VP of Sales", company: "ScaleUp", gradient: "from-amber-400 to-orange-500" },
  ];

  return (
    <WindowChrome url="app.qampi.com/prospects">
      <div className="p-5">
        {/* Search */}
        <div className="flex items-center gap-2.5 bg-slate-50 rounded-xl px-4 py-2.5 border border-slate-200/40 mb-3">
          <svg className="w-3.5 h-3.5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <span className="text-xs text-slate-400">VP of Sales, Head of Growth…</span>
        </div>
        {/* Chips */}
        <div className="flex flex-wrap gap-1.5 mb-4">
          {["SaaS", "51-200", "USA", "C-Level"].map((c) => (
            <span key={c} className="text-[10px] font-medium text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full">{c}</span>
          ))}
          <span className="text-[10px] text-slate-500 ml-1 self-center">1,428 results</span>
        </div>
      </div>
      {/* List */}
      <div className="divide-y divide-slate-100/60">
        {prospects.map((p) => (
          <div key={p.name} className="flex items-center justify-between px-5 py-3 hover:bg-slate-50/50 transition-colors">
            <div className="flex items-center gap-3">
              <div className={`w-8 h-8 rounded-full bg-gradient-to-br ${p.gradient} flex items-center justify-center text-white text-[10px] font-bold`}>
                {p.initials}
              </div>
              <div>
                <div className="text-[13px] font-semibold text-slate-800">{p.name}</div>
                <div className="text-[11px] text-slate-500">{p.role} · {p.company}</div>
              </div>
            </div>
            <button className="text-[10px] font-semibold text-white bg-indigo-500 px-3 py-1 rounded-md">
              + Add
            </button>
          </div>
        ))}
      </div>
    </WindowChrome>
  );
};

/* ═══════════════════════════════════════════════════════════
   MOCKUP 2 — Campaign Builder (visual workflow)
   ═══════════════════════════════════════════════════════════ */
const CampaignBuilderMockup = () => {
  const nodes = [
    { emoji: "👤", label: "Profile Visit", status: "done", wait: null },
    { emoji: "🔗", label: "Send Connection", status: "done", wait: "1 day" },
    { emoji: "⏳", label: "Smart Delay", status: "done", wait: "2 days" },
    { emoji: "💬", label: "Send Message", status: "active", wait: null },
    { emoji: "📧", label: "Email Follow-up", status: "pending", wait: "3 days" },
  ];

  return (
    <WindowChrome url="app.qampi.com/campaigns">
      {/* Campaign header */}
      <div className="px-5 pt-4 pb-3 border-b border-slate-100/60">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-[13px] font-bold text-slate-800">Q4 Decision Makers</div>
            <div className="text-[11px] text-slate-500">5 steps · 287 prospects enrolled</div>
          </div>
          <span className="flex items-center gap-1.5 text-[10px] font-semibold text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-100">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            Active
          </span>
        </div>
      </div>

      {/* Workflow */}
      <div className="p-5 pb-4">
        <div className="space-y-0">
          {nodes.map((node, i) => (
            <div key={i} className="flex items-stretch gap-3.5">
              {/* Timeline */}
              <div className="flex flex-col items-center w-9">
                <div
                  className={`w-9 h-9 rounded-xl flex items-center justify-center text-sm border shrink-0 ${
                    node.status === "done"
                      ? "bg-emerald-50 border-emerald-200"
                      : node.status === "active"
                      ? "bg-violet-50 border-violet-200 ring-2 ring-violet-100"
                      : "bg-slate-50 border-slate-200"
                  }`}
                >
                  {node.emoji}
                </div>
                {i < nodes.length - 1 && (
                  <div className={`w-0.5 flex-1 min-h-[20px] ${
                    node.status === "done" ? "bg-emerald-200" : "bg-slate-200"
                  }`} />
                )}
              </div>
              {/* Label */}
              <div className="flex-1 flex items-center justify-between pb-5">
                <span className={`text-[13px] font-medium ${
                  node.status === "active" ? "text-violet-700" : "text-slate-700"
                }`}>
                  {node.label}
                </span>
                {node.wait && (
                  <span className="text-[10px] text-slate-400 bg-slate-50 px-2 py-0.5 rounded">
                    wait {node.wait}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Bottom stats */}
      <div className="px-5 pb-5">
        <div className="grid grid-cols-3 gap-2 bg-slate-50 rounded-xl p-3 border border-slate-200/40">
          {[
            { value: "287", label: "Enrolled", color: "text-slate-800" },
            { value: "68%", label: "Accept Rate", color: "text-emerald-600" },
            { value: "34%", label: "Reply Rate", color: "text-violet-600" },
          ].map((s) => (
            <div key={s.label} className="text-center">
              <div className={`text-base font-black ${s.color}`}>{s.value}</div>
              <div className="text-[9px] text-slate-500 uppercase tracking-wider">{s.label}</div>
            </div>
          ))}
        </div>
      </div>
    </WindowChrome>
  );
};

/* ═══════════════════════════════════════════════════════════
   MOCKUP 3 — Analytics Dashboard
   ═══════════════════════════════════════════════════════════ */
const AnalyticsMockup = () => {
  const bars = [28, 42, 35, 58, 65, 48, 72, 60, 78, 70, 85, 92];

  return (
    <WindowChrome url="app.qampi.com/analytics">
      {/* Metric cards */}
      <div className="grid grid-cols-4 gap-2 p-5 pb-4">
        {[
          { label: "Invited", value: "287", delta: "+12%", color: "text-indigo-600" },
          { label: "Connected", value: "198", delta: "+8%", color: "text-emerald-600" },
          { label: "Replied", value: "89", delta: "+23%", color: "text-violet-600" },
          { label: "Reply Rate", value: "34%", delta: "+5%", color: "text-amber-600" },
        ].map((m) => (
          <div key={m.label} className="bg-slate-50 rounded-lg p-2.5 text-center border border-slate-200/40">
            <div className={`text-lg font-black ${m.color}`}>{m.value}</div>
            <div className="text-[9px] text-slate-500 uppercase tracking-wider mt-0.5">{m.label}</div>
            <div className="text-[9px] text-emerald-500 font-semibold">{m.delta}</div>
          </div>
        ))}
      </div>

      {/* Bar chart */}
      <div className="px-5 pb-4">
        <div className="text-[11px] font-semibold text-slate-600 mb-2">Weekly Performance</div>
        <div className="flex items-end gap-[6px] h-16">
          {bars.map((h, i) => (
            <div
              key={i}
              className="flex-1 rounded-sm bg-gradient-to-t from-violet-500 to-violet-300 transition-all"
              style={{ height: `${h}%` }}
            />
          ))}
        </div>
        <div className="flex justify-between mt-1.5 text-[8px] text-slate-400">
          <span>Jan</span><span>Feb</span><span>Mar</span><span>Apr</span><span>May</span><span>Jun</span>
          <span>Jul</span><span>Aug</span><span>Sep</span><span>Oct</span><span>Nov</span><span>Dec</span>
        </div>
      </div>

      {/* Sentiment bar */}
      <div className="px-5 pb-5">
        <div className="text-[11px] font-semibold text-slate-600 mb-2">Response Sentiment</div>
        <div className="h-2.5 rounded-full overflow-hidden flex bg-slate-100">
          <div className="bg-emerald-400 rounded-l-full" style={{ width: "68%" }} />
          <div className="bg-amber-400" style={{ width: "22%" }} />
          <div className="bg-rose-400 rounded-r-full" style={{ width: "10%" }} />
        </div>
        <div className="flex justify-between mt-2 text-[10px]">
          <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />Positive 68%</span>
          <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-amber-400" />Neutral 22%</span>
          <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-rose-400" />Negative 10%</span>
        </div>
      </div>
    </WindowChrome>
  );
};

/* ═══════════════════════════════════════════════════════════
   MOCKUP 4 — CRM Integrations
   ═══════════════════════════════════════════════════════════ */
const CRMIntegrationMockup = () => {
  const items = [
    { name: "HubSpot", letter: "H", color: "#FF7A59", bg: "#FFF0ED", synced: "1,284" },
    { name: "Salesforce", letter: "S", color: "#00A1E0", bg: "#E6F6FD", synced: "892" },
    { name: "Pipedrive", letter: "P", color: "#017737", bg: "#E6F5ED", synced: "671" },
    { name: "Zapier", letter: "Z", color: "#FF4A00", bg: "#FFF0E8", synced: "2,000+" },
  ];

  return (
    <WindowChrome url="app.qampi.com/integrations">
      <div className="p-5 space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="text-[13px] font-bold text-slate-800">Connected Apps</div>
          <span className="flex items-center gap-1.5 text-[10px] font-semibold text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-100">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            All Healthy
          </span>
        </div>

        {/* Grid */}
        <div className="grid grid-cols-2 gap-2.5">
          {items.map((item) => (
            <div key={item.name} className="border border-slate-200/50 rounded-xl p-3.5 hover:shadow-md transition-all">
              <div className="flex items-center gap-2.5 mb-2.5">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center text-sm font-black" style={{ background: item.bg, color: item.color }}>
                  {item.letter}
                </div>
                <span className="text-[13px] font-semibold text-slate-800">{item.name}</span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-emerald-500" /><span className="text-[10px] text-emerald-600 font-medium">Active</span></div>
                <span className="text-[10px] text-slate-500">{item.synced} synced</span>
              </div>
            </div>
          ))}
        </div>

        {/* Activity */}
        <div className="bg-slate-50 rounded-xl p-3.5 border border-slate-200/40 space-y-2">
          {[
            { text: "Sarah Jenkins → HubSpot", time: "2m", color: "#FF7A59" },
            { text: "47 leads → Pipedrive", time: "12m", color: "#017737" },
          ].map((a, i) => (
            <div key={i} className="flex items-center gap-2 text-[10px]">
              <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: a.color }} />
              <span className="text-slate-600 flex-1">{a.text}</span>
              <span className="text-slate-400">{a.time} ago</span>
            </div>
          ))}
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-2 bg-gradient-to-r from-violet-50 to-indigo-50 rounded-xl p-3 border border-violet-100/40">
          {[
            { value: "2,847", label: "Synced", color: "text-slate-800" },
            { value: "99.8%", label: "Success", color: "text-emerald-600" },
            { value: "Live", label: "Speed", color: "text-violet-600" },
          ].map((s) => (
            <div key={s.label} className="text-center">
              <div className={`text-base font-black ${s.color}`}>{s.value}</div>
              <div className="text-[9px] text-slate-500 uppercase tracking-wider">{s.label}</div>
            </div>
          ))}
        </div>
      </div>
    </WindowChrome>
  );
};

/* ═══════════════════════════════════════════════════════════
   STEP DATA — Short & crisp
   ═══════════════════════════════════════════════════════════ */
const STEPS = [
  {
    number: 1,
    color: "#6366f1",
    step: "STEP 01",
    title: "Find your ideal buyers",
    description: "Search LinkedIn & Sales Navigator for decision-makers who match your ICP — or import your own CSV. Qampi auto-enriches every contact.",
    bullets: [
      "Target by role, industry, location, and company size",
      "Import from LinkedIn, Sales Navigator, or any CSV file",
      "Auto-enrich with verified emails and profile data",
    ],
    tags: ["LinkedIn Search", "Sales Navigator", "Auto-Enrich"],
    mockup: "prospect" as const,
    sticker: "bird_search",
    reverse: false,
  },
  {
    number: 2,
    color: "#8b5cf6",
    step: "STEP 02",
    title: "Launch smart sequences",
    description: "Build visual multi-step workflows that combine LinkedIn actions with email follow-ups. Every touchpoint is personalized at scale.",
    bullets: [
      "Drag-and-drop campaign builder with conditional logic",
      "Chain profile visits, invites, messages & emails",
      "A/B test variations with smart delays between steps",
    ],
    tags: ["Visual Builder", "Multi-Channel", "A/B Testing"],
    mockup: "campaign" as const,
    sticker: "bird_rocket",
    reverse: true,
  },
  {
    number: 3,
    color: "#a855f7",
    step: "STEP 03",
    title: "Track what converts",
    description: "Real-time dashboard with reply rates, sentiment analysis, and campaign comparisons. Scale what works, fix what doesn't.",
    bullets: [
      "Live metrics for invites, connections, and replies",
      "AI sentiment analysis on every response",
      "Compare campaigns side-by-side to find winners",
    ],
    tags: ["Live Dashboard", "Sentiment AI", "Reports"],
    mockup: "analytics" as const,
    sticker: "bird_analytics",
    reverse: false,
  },
  {
    number: 4,
    color: "#7c3aed",
    step: "STEP 04",
    title: "Sync with your CRM",
    description: "Push leads, conversations, and tags into HubSpot, Salesforce, or Pipedrive — automatically. Plus 2,000+ apps via Zapier and Make.",
    bullets: [
      "Native integrations with HubSpot, Salesforce & Pipedrive",
      "Sync contacts, transcripts, and custom fields",
      "2,000+ apps through Zapier, Make, and n8n",
    ],
    tags: ["HubSpot", "Salesforce", "Zapier"],
    mockup: "crm" as const,
    sticker: "bird_integration",
    reverse: true,
  },
];

/* ═══════════════════════════════════════════════════════════
   MOCKUP RENDERER
   ═══════════════════════════════════════════════════════════ */
const MockupRenderer = ({ type }: { type: string }) => {
  switch (type) {
    case "prospect": return <ProspectMockup />;
    case "campaign": return <CampaignBuilderMockup />;
    case "analytics": return <AnalyticsMockup />;
    case "crm": return <CRMIntegrationMockup />;
    default: return null;
  }
};

/* ═══════════════════════════════════════════════════════════
   MAIN COMPONENT
   ═══════════════════════════════════════════════════════════ */
export function HowItWorks() {
  const containerRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: containerRef });

  const ref1 = useRef<HTMLDivElement>(null);
  const ref2 = useRef<HTMLDivElement>(null);
  const ref3 = useRef<HTMLDivElement>(null);
  const ref4 = useRef<HTMLDivElement>(null);
  const refs = [ref1, ref2, ref3, ref4];

  const s1 = useScroll({ target: ref1, offset: ["start end", "center center"] }).scrollYProgress;
  const s2 = useScroll({ target: ref2, offset: ["start end", "center center"] }).scrollYProgress;
  const s3 = useScroll({ target: ref3, offset: ["start end", "center center"] }).scrollYProgress;
  const s4 = useScroll({ target: ref4, offset: ["start end", "center center"] }).scrollYProgress;

  const o = [
    useTransform(s1, [0, 0.5], [0, 1]),
    useTransform(s2, [0, 0.5], [0, 1]),
    useTransform(s3, [0, 0.5], [0, 1]),
    useTransform(s4, [0, 0.5], [0, 1]),
  ];
  const yt = [
    useTransform(s1, [0, 0.7], [80, 0]),
    useTransform(s2, [0, 0.7], [80, 0]),
    useTransform(s3, [0, 0.7], [80, 0]),
    useTransform(s4, [0, 0.7], [80, 0]),
  ];
  const yi = [
    useTransform(s1, [0, 0.7], [120, 0]),
    useTransform(s2, [0, 0.7], [120, 0]),
    useTransform(s3, [0, 0.7], [120, 0]),
    useTransform(s4, [0, 0.7], [120, 0]),
  ];
  const sc = [
    useTransform(s1, [0, 0.5], [0.9, 1]),
    useTransform(s2, [0, 0.5], [0.9, 1]),
    useTransform(s3, [0, 0.5], [0.9, 1]),
    useTransform(s4, [0, 0.5], [0.9, 1]),
  ];

  return (
    <section ref={containerRef} className="relative w-full bg-white text-slate-900 overflow-hidden">

      {/* ── Messy scribble loops — behind the header text, perfectly aligned with scroll line ── */}
      <div className="absolute top-0 left-0 w-full h-[700px] pointer-events-none z-0">
        <MessyScribble />
      </div>

      {/* ── Flowing line through steps — follows scroll ── */}
      <div className="absolute top-[700px] bottom-0 left-0 w-full pointer-events-none z-0">
        <FlowingScrollLine scrollYProgress={scrollYProgress} />
      </div>

      {/* ═══════════════════════════════
          HEADER
          ═══════════════════════════════ */}
      <div className="relative z-10 min-h-screen flex flex-col items-center justify-center px-4 text-center">
        <span className="inline-flex items-center gap-2 bg-violet-50 text-violet-600 px-5 py-2 rounded-full text-[11px] font-bold uppercase tracking-widest mb-8 border border-violet-200/50">
          <span className="w-1.5 h-1.5 rounded-full bg-violet-500 animate-pulse" />
          How It Works
        </span>

        <div className="relative">
          {/* ── Mascot Sticker: Laptop Bird ── */}
          <motion.div
            className="absolute -top-8 -left-16 md:-left-20 w-14 md:w-16 z-20 pointer-events-none mix-blend-darken hidden md:block opacity-90"
            initial={{ opacity: 0, y: 10 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ duration: 1, ease: "easeOut" }}
          >
            <motion.img
              src="/stickers/bird_laptop.png"
              alt="Laptop Bird Mascot"
              className="w-full h-full object-contain"
              animate={{ y: [0, -4, 0] }}
              transition={{ repeat: Infinity, duration: 6, ease: "easeInOut" }}
            />
          </motion.div>

        <h2 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl xl:text-8xl font-black tracking-tight text-slate-900 leading-[0.92] max-w-4xl relative z-10">
          From cold outreach
          <br />
          <span className="bg-gradient-to-r from-violet-600 via-purple-500 to-indigo-600 bg-clip-text text-transparent">
            to warm conversations
          </span>
        </h2>
        </div>
        <p className="mt-7 text-slate-500 text-base md:text-lg max-w-xl leading-relaxed">
          Qampi turns scattered prospecting into a clean, repeatable pipeline — in 4 steps.
        </p>

        {/* Scroll indicator */}
        <div className="mt-16 md:mt-24 flex flex-col items-center gap-3">
          <span className="text-[9px] font-bold uppercase tracking-[0.25em] text-slate-400">Scroll</span>
          <div className="w-[18px] h-8 rounded-full border-[1.5px] border-slate-300 flex items-start justify-center p-[3px]">
            <motion.div
              className="w-[5px] h-[5px] rounded-full bg-violet-500"
              animate={{ y: [0, 12, 0] }}
              transition={{ repeat: Infinity, duration: 1.5, ease: "easeInOut" }}
            />
          </div>
        </div>
      </div>

      {/* ═══════════════════════════════
          STEPS
          ═══════════════════════════════ */}
      <div className="relative z-10 pb-24 md:pb-40">
        {STEPS.map((step, i) => (
          <div
            key={step.number}
            ref={refs[i]}
            className="min-h-screen flex items-center px-4 sm:px-8 lg:px-16 xl:px-24 py-16 md:py-20 relative"
          >
            {/* Big background number */}
            <span
              className="absolute top-1/2 -translate-y-1/2 pointer-events-none select-none hidden xl:block text-[220px] 2xl:text-[280px] font-black leading-none opacity-[0.025]"
              style={{ [step.reverse ? "right" : "left"]: "-0.5rem" }}
            >
              0{step.number}
            </span>

            <div
              className={`w-full max-w-[1360px] mx-auto flex flex-col gap-10 lg:gap-16 xl:gap-20 items-center ${
                step.reverse ? "lg:flex-row-reverse" : "lg:flex-row"
              }`}
            >
              {/* ── TEXT ── */}
              <motion.div style={{ y: yt[i], opacity: o[i] }} className="w-full lg:w-[40%]">
                {/* Badge */}
                <div className="flex items-center gap-3.5 mb-5">
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center text-white text-sm font-black shadow-md"
                    style={{ background: step.color }}
                  >
                    {step.number}
                  </div>
                  <span className="text-[11px] font-bold uppercase tracking-widest" style={{ color: step.color }}>
                    {step.step}
                  </span>
                </div>

                {/* Title */}
                <h3 className="text-2xl sm:text-3xl md:text-4xl xl:text-[2.75rem] font-black text-slate-900 tracking-tight leading-[1.08] mb-4">
                  {step.title}
                </h3>

                {/* Description */}
                <p className="text-sm md:text-[15px] text-slate-500 leading-relaxed mb-6">
                  {step.description}
                </p>

                {/* Bullets */}
                <ul className="space-y-2.5 mb-6">
                  {step.bullets.map((b, j) => (
                    <li key={j} className="flex items-start gap-2.5">
                      <span className="w-1.5 h-1.5 rounded-full mt-[7px] shrink-0" style={{ background: step.color }} />
                      <span className="text-[13px] text-slate-600 leading-relaxed">{b}</span>
                    </li>
                  ))}
                </ul>

                {/* Tags */}
                <div className="flex flex-wrap gap-1.5">
                  {step.tags.map((tag) => (
                    <span
                      key={tag}
                      className="text-[10px] font-medium px-2.5 py-1 rounded-full border"
                      style={{
                        color: step.color,
                        backgroundColor: `${step.color}0a`,
                        borderColor: `${step.color}18`,
                      }}
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              </motion.div>

              {/* ── MOCKUP ── */}
              <motion.div
                style={{ y: yi[i], opacity: o[i], scale: sc[i] }}
                className="w-full lg:w-[57%] relative"
              >
                {/* ── Mascot Sticker for Step ── */}
                <motion.div
                  className={`absolute z-30 pointer-events-none mix-blend-darken opacity-90 hidden md:block w-14 md:w-16 ${
                    step.reverse ? "-right-6 -top-6" : "-left-6 -top-6"
                  }`}
                  initial={{ opacity: 0, y: 15 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: "-100px" }}
                  transition={{ duration: 1, ease: "easeOut", delay: 0.3 }}
                >
                  <motion.img
                    src={`/stickers/${step.sticker}.png`}
                    alt={`${step.step} Mascot`}
                    className="w-full h-full object-contain"
                    animate={{ y: [0, -3, 0] }}
                    transition={{ repeat: Infinity, duration: 4.5 + i * 0.5, ease: "easeInOut" }}
                  />
                </motion.div>

                <div className="relative group">
                  <div
                    className="absolute -inset-8 rounded-3xl opacity-0 group-hover:opacity-100 transition-opacity duration-700 blur-3xl pointer-events-none"
                    style={{ background: `${step.color}0c` }}
                  />
                  <MockupRenderer type={step.mockup} />
                </div>
              </motion.div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
