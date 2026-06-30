'use client';

import { X, Check, Zap } from "lucide-react";
import { motion } from "framer-motion";

// Head-to-head: how typical LinkedIn-outreach tools work vs. how Qampi works.
// Competitor column kept generic ("Other Tools") on purpose — no named claims.
const rows = [
  {
    dim: "Message writing",
    others: "Mail-merge templates with {firstName} — prospects spot them",
    qampi: "AI reads each profile and recent posts, then writes a genuinely personal message",
  },
  {
    dim: "Strategy",
    others: "You write the copy and guess the angle",
    qampi: "Learns your ICP, messaging pillars & best angles, then writes on-strategy",
  },
  {
    dim: "Account safety",
    others: "Shared or datacenter IPs that get flagged",
    qampi: "Dedicated sticky proxy per account, human-like pacing & working hours",
  },
  {
    dim: "Warming up leads",
    others: "Connect & message only",
    qampi: "Auto-likes and leaves AI-written comments on their posts first",
  },
  {
    dim: "When they reply",
    others: "Keep firing scheduled steps",
    qampi: "Instantly pauses so you take over a warm conversation",
  },
  {
    dim: "Data & reach",
    others: "LinkedIn only",
    qampi: "LinkedIn + verified email finder + CRM sync (HubSpot, Pipedrive, Notion)",
  },
  {
    dim: "Built for",
    others: "Big sales teams with ops support",
    qampi: "Founders, reps, recruiters & job seekers — live in minutes",
  },
];

const COLS = "grid grid-cols-1 md:grid-cols-[1.1fr_1.2fr_1.4fr]";

export function OldVsNew() {
  return (
    <section className="py-24 lg:py-32 bg-purple-50/30 relative overflow-hidden">
      {/* Background Decor */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-gradient-to-br from-indigo-500/5 to-purple-500/5 rounded-full blur-[100px] pointer-events-none" />

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <span className="inline-flex items-center gap-2 bg-indigo-50 text-primary px-4 py-1.5 rounded-full text-xs font-black uppercase tracking-widest mb-6 border border-indigo-100 shadow-sm">
            <Zap className="w-4 h-4" /> Qampi vs. the rest
          </span>
          <h2 className="font-display text-5xl sm:text-6xl lg:text-7xl font-semibold text-slate-900 leading-[1.1]">
            Other tools automate.{" "}
            <span className="bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">Qampi converts.</span>
          </h2>
          <p className="mt-6 text-xl text-slate-500 font-medium">
            Same outreach — done the way that actually gets answered.
          </p>
        </motion.div>

        {/* Comparison table */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="max-w-5xl mx-auto rounded-[2rem] border border-slate-200 bg-white shadow-xl overflow-hidden"
        >
          {/* Header row */}
          <div className={COLS}>
            <div className="hidden md:block p-6" />
            <div className="p-6 flex items-center justify-center gap-2 md:border-l border-slate-100">
              <div className="w-7 h-7 rounded-full bg-slate-100 flex items-center justify-center">
                <X className="w-4 h-4 text-slate-400" />
              </div>
              <span className="text-base font-bold text-slate-500">Other Tools</span>
            </div>
            <div className="p-6 flex items-center justify-center gap-2 bg-gradient-to-b from-indigo-50 to-indigo-50/40 md:border-l border-indigo-100">
              <img src="/logo.png" alt="Qampi" className="w-7 h-7 object-contain" />
              <span className="text-base font-black bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">Qampi</span>
            </div>
          </div>

          {/* Rows */}
          {rows.map((row) => (
            <div key={row.dim} className={`${COLS} border-t border-slate-100`}>
              <div className="px-6 py-5 font-bold text-slate-800 text-sm md:text-base flex items-center">
                {row.dim}
              </div>
              <div className="px-6 py-5 flex items-start gap-3 text-slate-500 text-sm leading-relaxed md:border-l border-slate-100">
                <X className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                <span>{row.others}</span>
              </div>
              <div className="px-6 py-5 flex items-start gap-3 text-slate-800 font-medium text-sm leading-relaxed bg-indigo-50/40 md:border-l border-indigo-100">
                <span className="w-5 h-5 rounded-full bg-gradient-to-r from-emerald-400 to-teal-400 flex items-center justify-center shrink-0 mt-0.5 shadow-sm shadow-emerald-500/20">
                  <Check className="w-3 h-3 text-white" />
                </span>
                <span>{row.qampi}</span>
              </div>
            </div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}
