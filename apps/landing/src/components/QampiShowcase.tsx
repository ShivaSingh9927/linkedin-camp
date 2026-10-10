'use client';

import { motion } from 'framer-motion';
import { User, Building2, Target, UserSearch, Sparkles, Send, ArrowRight, CheckCircle } from 'lucide-react';

// How the Qampi AI engine works: it reads four real context sources
// (you, your business, your campaign, your target) and writes one message
// no template could. Inputs → engine → output.
const INPUTS = [
  { icon: User, label: 'You', desc: 'Your role & writing voice', color: '#6366f1', bg: 'bg-violet-50', text: 'text-violet-600', border: 'border-violet-100' },
  { icon: Building2, label: 'Your business', desc: 'Company, value prop & ICP', color: '#8b5cf6', bg: 'bg-violet-50', text: 'text-violet-600', border: 'border-violet-100' },
  { icon: Target, label: 'Your campaign', desc: 'Objective, CTA & tone', color: '#a855f7', bg: 'bg-violet-50', text: 'text-violet-600', border: 'border-violet-100' },
  { icon: UserSearch, label: 'Your target', desc: "Their profile & recent activity", color: '#7c3aed', bg: 'bg-violet-50', text: 'text-violet-600', border: 'border-violet-100' },
];

export function QampiShowcase() {
  return (
    <section className="section relative">
      <div className="relative mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="mb-14 max-w-2xl"
        >
          <span className="eyebrow">The engine</span>
          <h2 className="section-title mt-3">
            Four inputs. <span className="accent">One personal message.</span>
          </h2>
          <p className="section-lead mt-5">
            Qampi reads four things before it writes a word — so every message sounds like you, speaks to
            your offer, and lands with that exact person.
          </p>
        </motion.div>

        {/* Inputs → Engine → Output */}
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_auto_1.1fr] gap-8 lg:gap-6 items-center [&>*]:min-w-0">

          {/* ── INPUTS ── */}
          <div className="space-y-4">
            {INPUTS.map((input, i) => (
              <motion.div
                key={input.label}
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1, type: 'spring', stiffness: 120, damping: 18 }}
                className="flex items-center gap-4 bg-white rounded-2xl border border-slate-100 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all p-4"
              >
                <div className={`w-11 h-11 rounded-xl ${input.bg} ${input.text} border ${input.border} flex items-center justify-center shrink-0`}>
                  <input.icon className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <div className="font-bold text-slate-800 text-[15px]">{input.label}</div>
                  <div className="text-[13px] text-slate-500 leading-snug">{input.desc}</div>
                </div>
                <ArrowRight className="w-4 h-4 text-slate-300 ml-auto shrink-0 hidden lg:block" />
              </motion.div>
            ))}
          </div>

          {/* ── ENGINE ── */}
          <motion.div
            initial={{ opacity: 0, scale: 0.85 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            transition={{ delay: 0.4, type: 'spring', stiffness: 120, damping: 16 }}
            className="flex flex-col items-center justify-center py-2"
          >
            <div className="relative w-40 h-40 flex items-center justify-center">
              <div className="absolute inset-0 rounded-full border border-dashed border-violet-200" />
              <div className="relative z-10 flex h-24 w-24 items-center justify-center rounded-full border-4 border-white bg-violet-50 shadow-[0_0_40px_rgba(124,58,237,0.18)]">
                <img src="/logo.png" alt="" className="h-14 w-14 object-contain" />
              </div>
            </div>
            <span className="mt-3 text-[11px] font-semibold uppercase tracking-widest text-primary">Qampi AI</span>
            <ArrowRight className="w-5 h-5 text-violet-400 mt-3 hidden lg:block" />
          </motion.div>

          {/* ── OUTPUT MESSAGE ── */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.6, type: 'spring', stiffness: 120, damping: 18 }}
            className="bg-white rounded-2xl border border-slate-200 shadow-[0_24px_60px_-24px_rgba(76,29,149,0.25)] overflow-hidden"
          >
            {/* header */}
            <div className="flex items-center gap-3 px-5 py-4 bg-slate-50/80 border-b border-slate-100">
              <div className="w-9 h-9 rounded-full bg-violet-100 flex items-center justify-center text-violet-700 text-xs font-bold">DO</div>
              <div className="leading-tight">
                <div className="text-sm font-bold text-slate-800">Daniel Okafor</div>
                <div className="text-[11px] text-slate-500">Founder & CEO · Ledgerly</div>
              </div>
              <span className="ml-auto inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-violet-600 bg-white/80 border border-violet-100 rounded-full px-2.5 py-1">
                <Sparkles className="w-3 h-3" /> AI Composed
              </span>
            </div>
            {/* message */}
            <div className="p-5">
              <div className="bg-primary text-white text-sm leading-relaxed p-4 rounded-2xl rounded-tl-sm">
                Hi Daniel, congrats on closing the Series A. The next 12 months usually mean a bigger sales team and a board that wants a forecast it can trust. That&apos;s exactly what we do — happy to show you how other post-A founders set it up in a day.
              </div>
              {/* why it works */}
              <div className="mt-4 flex flex-wrap gap-2">
                {['In your voice', 'References his raise', 'Speaks to your offer', 'Clear CTA'].map((tag) => (
                  <span key={tag} className="inline-flex items-center gap-1.5 text-[12px] font-medium text-slate-600 bg-slate-50 border border-slate-100 rounded-full px-3 py-1">
                    <CheckCircle className="w-3.5 h-3.5 text-emerald-500" /> {tag}
                  </span>
                ))}
              </div>
              <div className="mt-4 flex items-center justify-end gap-2 text-[11px] font-bold uppercase tracking-wider text-emerald-600">
                <Send className="w-3.5 h-3.5" /> Sent
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
