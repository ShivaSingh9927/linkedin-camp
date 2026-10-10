"use client";

import { motion, useReducedMotion } from "framer-motion";
import {
  BadgeCheck,
  Bot,
  Eye,
  GitBranch,
  Mail,
  MailSearch,
  MessageSquare,
  Sparkles,
  UserPlus,
} from "lucide-react";
import { AgentStrip } from "./AgentStrip";

// Only tools Qampi actually connects to: LinkedIn, native CRM sync (HubSpot,
// Pipedrive, Notion), sending mailboxes (Gmail, Outlook), and automation
// platforms via the public API + webhooks (Zapier, Make). `wordmark` logos
// are wide text marks that need extra scale to read at tile size.
const INTEGRATIONS: { name: string; src: string; wordmark?: boolean }[] = [
  { name: "LinkedIn", src: "/integrations/linkedin.svg" },
  { name: "HubSpot", src: "/integrations/hubspot.svg", wordmark: true },
  { name: "Pipedrive", src: "/integrations/pipedrive.svg", wordmark: true },
  { name: "Notion", src: "/integrations/notion.svg" },
  { name: "Gmail", src: "/integrations/gmail.svg" },
  { name: "Outlook", src: "/integrations/outlook.svg" },
  { name: "Zapier", src: "/integrations/zapier.svg", wordmark: true },
  { name: "Make", src: "/integrations/make.svg" },
];

const reveal = {
  initial: { opacity: 0, y: 24 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: "-60px" },
  transition: { duration: 0.6, ease: [0.22, 1, 0.36, 1] as const },
};

function Tile({ className = "", children }: { className?: string; children: React.ReactNode }) {
  return (
    <motion.div {...reveal} className={`relative flex flex-col overflow-hidden rounded-3xl ${className}`}>
      {children}
    </motion.div>
  );
}

function TileText({
  icon: Icon,
  label,
  title,
  body,
  dark = false,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  title: string;
  body: string;
  dark?: boolean;
}) {
  return (
    <div className="relative p-7 sm:p-9">
      <div
        className={`inline-flex items-center gap-2 rounded-lg px-2.5 py-1 text-xs font-semibold ${
          dark ? "bg-white/10 text-violet-200" : "bg-white text-primary shadow-sm ring-1 ring-violet-100"
        }`}
      >
        <Icon className="h-3.5 w-3.5" />
        {label}
      </div>
      <h3 className={`mt-5 font-display text-4xl font-semibold leading-[1] sm:text-[2.75rem] ${dark ? "text-white" : "text-slate-900"}`}>
        {title}
      </h3>
      <p className={`mt-3 max-w-md text-[15px] leading-relaxed ${dark ? "text-slate-300" : "text-slate-600"}`}>{body}</p>
    </div>
  );
}

/* ── Visuals ─────────────────────────────────────────────────────────── */

// A screenshot cropped to its top-left corner, bleeding off the tile edge.
// The -top offset skips the app's empty top bar (64px tall at full size,
// ~49px at the 900px width used here).
function ShotCrop({ src, alt }: { src: string; alt: string }) {
  return (
    <div className="relative mt-auto ml-7 h-72 overflow-hidden rounded-tl-2xl border-l border-t border-violet-200/70 bg-white shadow-[0_-12px_40px_-16px_rgba(76,29,149,0.35)] sm:ml-9 sm:h-80">
      <img src={src} alt={alt} loading="lazy" className="absolute left-0 -top-[49px] w-[900px] max-w-none" />
    </div>
  );
}

// "Searching… → verified" — the finder doing its job, on a loop.
function EmailFinderCard() {
  const reduce = useReducedMotion();
  return (
    <div className="relative mx-7 mb-8 mt-auto sm:mx-9 sm:mb-9">
      {/* Stacked cards behind for depth */}
      <div aria-hidden="true" className="absolute inset-x-6 -bottom-3 h-full rounded-2xl bg-white/60 ring-1 ring-slate-200/60" />
      <div aria-hidden="true" className="absolute inset-x-3 -bottom-1.5 h-full rounded-2xl bg-white/80 ring-1 ring-slate-200/70" />
      <div className="relative rounded-2xl bg-white p-5 shadow-[0_20px_40px_-20px_rgba(15,23,42,0.25)] ring-1 ring-slate-200/80">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-full bg-violet-100 text-sm font-bold text-violet-700">PR</div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-slate-900">Priya Raman</p>
            <p className="text-xs text-slate-500">Head of Growth · Cartwheel</p>
          </div>
          <MailSearch className="ml-auto h-5 w-5 text-slate-300" />
        </div>
        <div className="relative mt-4 h-11 overflow-hidden rounded-xl bg-slate-50 ring-1 ring-slate-200/80">
          {/* searching state */}
          <motion.div
            className="absolute inset-0 flex items-center gap-2 px-3.5 text-[13px] text-slate-400"
            animate={reduce ? { opacity: 0 } : { opacity: [1, 1, 0, 0, 1] }}
            transition={{ duration: 5, times: [0, 0.3, 0.36, 0.94, 1], repeat: Infinity }}
          >
            <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-violet-200 border-t-primary" />
            Finding &amp; verifying work email…
          </motion.div>
          {/* found state */}
          <motion.div
            className="absolute inset-0 flex items-center justify-between bg-emerald-50/60 px-3.5"
            animate={reduce ? { opacity: 1 } : { opacity: [0, 0, 1, 1, 0] }}
            transition={{ duration: 5, times: [0, 0.3, 0.36, 0.94, 1], repeat: Infinity }}
          >
            <span className="font-mono text-[13px] text-slate-800">priya@cartwheel.in</span>
            <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-600">
              <BadgeCheck className="h-4 w-4" /> Verified
            </span>
          </motion.div>
        </div>
      </div>
    </div>
  );
}

// The multichannel sequence, drawn as a flow.
const STEPS = [
  { icon: Eye, label: "Visit profile", channel: "LinkedIn" },
  { icon: UserPlus, label: "Invite", channel: "LinkedIn", wait: "1 day" },
  { icon: MessageSquare, label: "AI message", channel: "LinkedIn", wait: "2 days" },
  { icon: Mail, label: "AI email", channel: "Email", wait: "3 days" },
];

function SequenceFlow() {
  return (
    <ol className="relative mx-7 mb-8 mt-auto space-y-2.5 sm:mx-9 sm:mb-9">
      {STEPS.map((s, i) => (
        <motion.li
          key={s.label}
          initial={{ opacity: 0, x: -12 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.15 + i * 0.12, duration: 0.4 }}
        >
          {s.wait && (
            <div className="mb-2.5 ml-[1.3rem] flex items-center gap-3">
              <span className="h-4 w-px bg-violet-200" />
              <span className="text-[11px] font-medium text-slate-400">wait {s.wait}</span>
            </div>
          )}
          <div className="flex items-center gap-3 rounded-xl bg-white px-3 py-2.5 shadow-sm ring-1 ring-slate-200/80">
            <span
              className={`flex h-8 w-8 items-center justify-center rounded-lg ${
                s.channel === "Email" ? "bg-amber-50 text-amber-600" : "bg-violet-50 text-primary"
              }`}
            >
              <s.icon className="h-4 w-4" />
            </span>
            <span className="text-sm font-semibold text-slate-800">{s.label}</span>
            <span className="ml-auto rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-500">{s.channel}</span>
          </div>
        </motion.li>
      ))}
    </ol>
  );
}

/* ── Section ─────────────────────────────────────────────────────────── */

export function FeatureGrid() {
  return (
    <section id="features" className="section relative">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-2xl">
            <span className="eyebrow">Everything around the message</span>
            <h2 className="section-title mt-3">
              One tool for the <span className="accent">whole loop</span>
            </h2>
          </div>
          <p className="section-lead lg:max-w-sm">
            Find people, find their email, run LinkedIn and email together, and keep every reply in one place —
            without stitching five tools together.
          </p>
        </div>

        <div className="mt-14 grid gap-5 lg:grid-cols-12">
          {/* Copilot — the hero tile */}
          <Tile className="bg-gradient-to-br from-violet-100 via-violet-50 to-white ring-1 ring-violet-200/60 lg:col-span-7">
            <div
              aria-hidden="true"
              className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-violet-300/40 blur-3xl"
            />
            <TileText
              icon={Sparkles}
              label="Qampi copilot"
              title="Ask. It does the busywork."
              body="Suggest searches, pick the right campaign, check how one is doing. It knows your profile, your leads, and your limits."
            />
            <ShotCrop src="/screens/dashboard.png" alt="Qampi dashboard with the copilot chat and a running campaign" />
          </Tile>

          {/* Email finder */}
          <Tile className="bg-slate-100/80 ring-1 ring-slate-200/70 lg:col-span-5">
            <TileText
              icon={MailSearch}
              label="Email finder"
              title="Verified emails, one click."
              body="Looks up a prospect's work address and verifies it, so cold email reaches a real inbox."
            />
            <EmailFinderCard />
          </Tile>

          {/* Sequences */}
          <Tile className="bg-amber-50/70 ring-1 ring-amber-100 lg:col-span-5">
            <TileText
              icon={GitBranch}
              label="Multichannel sequences"
              title="LinkedIn + email, one flow."
              body="Visit, invite, message, like, comment, and email in one sequence — or start from 43 ready-made templates."
            />
            <SequenceFlow />
          </Tile>

          {/* AI agents — dark for contrast */}
          <Tile className="bg-slate-950 lg:col-span-7">
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_70%_60%_at_100%_0%,rgba(124,58,237,0.45),transparent)]"
            />
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_right,rgba(255,255,255,0.05)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.05)_1px,transparent_1px)] bg-[size:40px_40px] [mask-image:radial-gradient(ellipse_80%_80%_at_100%_0%,black,transparent)]"
            />
            <TileText
              dark
              icon={Bot}
              label="MCP · Claude Code · Codex · Cursor"
              title="Run it from your AI agent."
              body="Your agent can find leads and draft campaigns through Qampi. Launches still wait for your yes."
            />
            <div className="relative mt-auto px-5 pb-6 sm:px-8 sm:pb-8">
              <AgentStrip />
            </div>
          </Tile>
        </div>

        {/* Integrations */}
        <motion.div {...reveal} className="mt-5 rounded-3xl bg-white p-7 ring-1 ring-slate-200/80 sm:p-9">
          <div className="flex flex-col gap-8 lg:flex-row lg:items-center">
            <div className="lg:w-72 lg:shrink-0">
              <h3 className="font-display text-3xl font-semibold leading-none text-slate-900">Works with your stack</h3>
              <p className="mt-3 text-[15px] leading-relaxed text-slate-600">
                Native CRM sync, your own mailbox, and the API + webhooks for everything else.
              </p>
            </div>
            <ul className="grid flex-1 grid-cols-4 gap-x-3 gap-y-5 sm:grid-cols-8">
              {INTEGRATIONS.map((logo) => (
                <li key={logo.name} className="group flex flex-col items-center gap-2">
                  <div className="flex h-14 w-14 items-center justify-center overflow-hidden rounded-2xl bg-slate-50 ring-1 ring-slate-200/70 transition-all duration-200 group-hover:-translate-y-0.5 group-hover:bg-white group-hover:shadow-md">
                    <img src={logo.src} alt="" className={logo.wordmark ? "h-12 w-12 scale-[1.08] object-contain" : "h-7 w-7 object-contain"} />
                  </div>
                  <span className="text-xs font-medium text-slate-500">{logo.name}</span>
                </li>
              ))}
            </ul>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
