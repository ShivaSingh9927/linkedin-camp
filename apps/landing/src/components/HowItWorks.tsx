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
        strokeWidth="35"
        strokeLinecap="round"
        fill="none"
        opacity="0.1"
        style={{ pathLength }}
      />
      {/* Medium glow */}
      <motion.path
        d={flowPath}
        stroke="url(#purpleGrad)"
        strokeWidth="12"
        strokeLinecap="round"
        fill="none"
        opacity="0.3"
        style={{ pathLength }}
      />
      {/* Main crisp line */}
      <motion.path
        d={flowPath}
        stroke="url(#purpleGrad)"
        strokeWidth="1.75"
        strokeLinecap="round"
        fill="none"
        opacity="0.0"
        style={{ pathLength }}
      />
      {/* Bright center highlight */}
      <motion.path
        d={flowPath}
        stroke="#c4b5fd"
        strokeWidth="0.75"
        strokeLinecap="round"
        fill="none"
        opacity="0.3"
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
   STEP DATA — the real Qampi journey
   ═══════════════════════════════════════════════════════════ */
const STEPS = [
  {
    number: 1,
    color: "#6366f1",
    step: "STEP 01",
    title: "Set up in minutes",
    description: "Connect your LinkedIn and tell Qampi about your business — your company, value prop, and ideal customer. That's what the AI writes from.",
    bullets: [
      "Connect your LinkedIn account",
      "Add company info, value prop & ideal customer",
      "Sync HubSpot, Pipedrive, or Notion (optional)",
    ],
    tags: ["LinkedIn", "Business Profile", "CRM Sync"],
    mockup: "crm" as const,
    reverse: false,
  },
  {
    number: 2,
    color: "#8b5cf6",
    step: "STEP 02",
    title: "Import your leads",
    description: "Pull prospects straight from LinkedIn with the Qampi extension, or upload a CSV / Excel. Every lead is enriched with profile data.",
    bullets: [
      "Capture profiles from LinkedIn with the extension",
      "Upload a CSV / Excel, or add leads manually",
      "Auto-enriched with role, company & profile data",
    ],
    tags: ["Extension", "CSV Import", "Auto-Enrich"],
    mockup: "prospect" as const,
    reverse: true,
  },
  {
    number: 3,
    color: "#a855f7",
    step: "STEP 03",
    title: "Launch a campaign",
    description: "Pick the objective, audience, CTA, and tone. Qampi researches each prospect and writes a personal message — then runs it safely, on autopilot.",
    bullets: [
      "Set your goal, CTA & tone in a few clicks",
      "Steps: connect, message, like & comment",
      "AI writes a unique message for every prospect",
    ],
    tags: ["Objective & Scope", "AI-Written", "LinkedIn-Safe"],
    mockup: "campaign" as const,
    reverse: false,
  },
  {
    number: 4,
    color: "#7c3aed",
    step: "STEP 04",
    title: "Watch replies roll in",
    description: "A real-time dashboard tracks every connection, reply, and what's converting — and the moment a lead replies, the automation pauses so you take over.",
    bullets: [
      "Live activity feed for every action",
      "Reply & acceptance rates per campaign",
      "Auto-pauses on reply · results sync to your CRM",
    ],
    tags: ["Live Dashboard", "Reply Rates", "CRM Sync"],
    mockup: "analytics" as const,
    reverse: true,
  },
];

/* ═══════════════════════════════════════════════════════════
   MOCKUP RENDERER — real product screenshots in a browser frame
   (captured from the live Qampi dashboard, see public/screens/)
   ═══════════════════════════════════════════════════════════ */
const SHOTS: Record<string, { src: string; url: string }> = {
  crm: { src: "/screens/onboarding.png", url: "app.qampi.com/onboarding" },
  prospect: { src: "/screens/prospects.png", url: "app.qampi.com/prospects" },
  campaign: { src: "/screens/campaign.png", url: "app.qampi.com/campaigns" },
  analytics: { src: "/screens/analytics.png", url: "app.qampi.com/dashboard" },
};

const MockupRenderer = ({ type }: { type: string }) => {
  const shot = SHOTS[type];
  if (!shot) return null;
  return (
    <WindowChrome url={shot.url}>
      <img src={shot.src} alt="Qampi app screen" className="w-full h-auto block" />
    </WindowChrome>
  );
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
      <div className="relative z-10 flex flex-col items-start justify-start text-left px-4 sm:px-8 lg:px-16 xl:px-24 max-w-[1360px] mx-auto w-full pt-10 pb-12 md:pt-14 md:pb-16">
        <span className="inline-flex items-center gap-2 bg-violet-50 text-violet-600 px-5 py-2 rounded-full text-[11px] font-bold uppercase tracking-widest mb-8 border border-violet-200/50">
          <span className="w-1.5 h-1.5 rounded-full bg-violet-500 animate-pulse" />
          How It Works
        </span>

        <h2 className="font-display text-6xl sm:text-7xl lg:text-8xl font-semibold text-slate-900 leading-[0.92] max-w-3xl relative z-10">
          From messy
          <br />
          <span className="bg-gradient-to-r from-violet-600 via-purple-500 to-indigo-600 bg-clip-text text-transparent">
            to streamlined
          </span>
        </h2>
        <p className="mt-7 text-slate-500 text-base md:text-lg max-w-xl leading-relaxed">
          Qampi turns scattered prospecting into a clean, repeatable pipeline — in 4 steps.
        </p>

        {/* Scroll indicator */}
        <div className="mt-10 md:mt-12 flex flex-col items-center gap-3">
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
            className="min-h-[60vh] flex items-center px-4 sm:px-8 lg:px-16 xl:px-24 py-10 md:py-14 relative"
          >
            {/* Big background number */}
            <span
              className="absolute top-1/2 -translate-y-1/2 pointer-events-none select-none hidden xl:block text-[220px] 2xl:text-[280px] font-black leading-none opacity-[0.025]"
              style={{ [step.reverse ? "right" : "left"]: "-0.5rem" }}
            >
              0{step.number}
            </span>

            <div
              className={`w-full max-w-[1440px] mx-auto flex flex-col gap-10 lg:gap-12 items-center ${
                step.reverse ? "lg:flex-row-reverse" : "lg:flex-row"
              }`}
            >
              {/* ── TEXT ── */}
              <motion.div style={{ y: yt[i], opacity: o[i] }} className="w-full lg:w-[34%]">
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
                <h3 className="font-display text-3xl sm:text-4xl lg:text-5xl font-semibold text-slate-900 leading-[1.08] mb-4">
                  {step.title}
                </h3>

                {/* Description */}
                <p className="text-base md:text-lg text-slate-500 leading-relaxed mb-6">
                  {step.description}
                </p>

                {/* Bullets */}
                <ul className="space-y-2.5 mb-6">
                  {step.bullets.map((b, j) => (
                    <li key={j} className="flex items-start gap-2.5">
                      <span className="w-1.5 h-1.5 rounded-full mt-[7px] shrink-0" style={{ background: step.color }} />
                      <span className="text-[15px] text-slate-600 leading-relaxed">{b}</span>
                    </li>
                  ))}
                </ul>

                {/* Tags */}
                <div className="flex flex-wrap gap-1.5">
                  {step.tags.map((tag) => (
                    <span
                      key={tag}
                      className="text-xs font-medium px-3 py-1 rounded-full border"
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
                className="w-full lg:w-[64%] relative"
              >
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
